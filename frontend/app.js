const textarea = document.getElementById('input-text');
const charCount = document.getElementById('char-count');
const output = document.getElementById('output');
const checkBtn = document.getElementById('check-btn');
const explanations = document.getElementById('explanations');
const expBody = document.getElementById('exp-body');
const copyBtn = document.getElementById('copy-btn');
const listenBtn = document.getElementById('listen-btn');

let lastCorrected = '';
let currentMode = 'grammar';

function isKorean(text) {
  return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text);
}

textarea.addEventListener('input', () => {
  const len = textarea.value.length;
  charCount.textContent = len + ' / 500';

  const text = textarea.value.trim();
  if (text.length === 0) {
    checkBtn.textContent = 'Check Grammar';
    currentMode = 'grammar';
  } else if (isKorean(text)) {
    checkBtn.textContent = 'Check Grammar';
    currentMode = 'grammar';
  } else {
    checkBtn.textContent = 'Translate to Korean';
    currentMode = 'translate';
  }
});

textarea.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    checkGrammar();
  }
});

function copyResult() {
  if (!lastCorrected) return;
  navigator.clipboard.writeText(lastCorrected).then(() => {
    copyBtn.textContent = 'Copied!';
    setTimeout(() => copyBtn.textContent = 'Copy', 1800);
  });
}

function clearAll() {
  textarea.value = '';
  charCount.textContent = '0 / 500';
  output.innerHTML = '<span class="kg-placeholder">Corrections will appear here...</span>';
  explanations.classList.remove('visible');
  copyBtn.style.display = 'none';
  listenBtn.style.display = 'none';
  lastCorrected = '';
  checkBtn.textContent = 'Check Grammar';
  currentMode = 'grammar';
  textarea.focus();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCorrectedHtml(corrected, changes) {
  let html = escapeHtml(corrected);
  if (!changes || changes.length === 0) return html;
  changes.forEach(c => {
    if (!c.fixed) return;
    const escaped = escapeHtml(c.fixed);
    const regex = new RegExp(escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    html = html.replace(regex, `<span class="diff-added">${escaped}</span>`);
  });
  return html;
}

function listenKorean() {
  if (!lastCorrected) return;
  const utterance = new SpeechSynthesisUtterance(lastCorrected);
  utterance.lang = 'ko-KR';
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

async function checkGrammar() {
  const text = textarea.value.trim();
  if (!text) { textarea.focus(); return; }

  const mode = currentMode;

  checkBtn.disabled = true;
  checkBtn.textContent = mode === 'translate' ? 'Translating...' : 'Checking...';
  output.innerHTML = '<div class="kg-loading"><div class="kg-spinner"></div><span>' + (mode === 'translate' ? 'Translating to Korean...' : 'Analyzing your Korean...') + '</span></div>';
  explanations.classList.remove('visible');
  copyBtn.style.display = 'none';
  listenBtn.style.display = 'none';
  lastCorrected = '';

  try {
    const res = await fetch('https://kgrammar.onrender.com/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mode })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'API error');
    }

    const result = await res.json();
    lastCorrected = result.corrected;
    copyBtn.style.display = 'block';
    listenBtn.style.display = 'block';

    if (mode === 'translate') {
      output.innerHTML = '<div style="font-size: 17px; line-height: 1.75;">' + escapeHtml(result.corrected) + '</div>';
    } else {
      if (!result.hasErrors) {
        output.innerHTML =
          '<div class="kg-no-errors">✓ No errors found — your Korean looks great!</div>' +
          '<div style="padding: 4px 0; font-size: 17px; line-height: 1.75;">' + escapeHtml(result.corrected) + '</div>';
      } else {
        output.innerHTML = '<div style="font-size: 17px; line-height: 1.75;">' + buildCorrectedHtml(result.corrected, result.changes) + '</div>';

        if (result.changes && result.changes.length > 0) {
          expBody.innerHTML = result.changes.map((c, i) => `
            <div class="kg-exp-item">
              <div class="kg-exp-num">${i + 1}</div>
              <div class="kg-exp-text">
                <div style="margin-bottom: 6px;">
                  <span class="diff-removed">${escapeHtml(c.original)}</span>
                  &rarr;
                  <span class="diff-added">${escapeHtml(c.fixed)}</span>
                  &nbsp;<strong>${escapeHtml(c.reason)}</strong>
                </div>
                <div class="kg-exp-detail">${escapeHtml(c.explanation)}</div>
              </div>
            </div>
          `).join('');
          explanations.classList.add('visible');
        }
      }
    }
  } catch (err) {
    console.error(err);
    output.innerHTML = '<div class="kg-error">' + (err.message || 'Something went wrong. Please try again.') + '</div>';
  }

  checkBtn.disabled = false;
  checkBtn.textContent = mode === 'translate' ? 'Translate to Korean' : 'Check Grammar';
}
