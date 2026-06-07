const textarea = document.getElementById('input-text');
const charCount = document.getElementById('char-count');
const output = document.getElementById('output');
const checkBtn = document.getElementById('check-btn');
const explanations = document.getElementById('explanations');
const expBody = document.getElementById('exp-body');
const copyBtn = document.getElementById('copy-btn');
const listenBtn = document.getElementById('listen-btn');
const dropZone = document.getElementById('drop-zone');
const dropOverlay = document.getElementById('drop-overlay');

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
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') checkGrammar();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropOverlay.classList.add('active');
});

dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) {
    dropOverlay.classList.remove('active');
  }
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropOverlay.classList.remove('active');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    extractTextFromImage(file);
  }
});

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (file) extractTextFromImage(file);
}

async function extractTextFromImage(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result.split(',')[1];
    const mediaType = file.type;

    textarea.value = '';
    textarea.placeholder = 'Extracting text from image...';
    checkBtn.disabled = true;

    try {
      const res = await fetch('https://kgrammar.onrender.com/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType })
      });

      const data = await res.json();
      if (data.text) {
        textarea.value = data.text;
        charCount.textContent = data.text.length + ' / 500';
        // Set mode to translate-to-english since image likely contains Korean
        currentMode = 'translate-to-english';
        checkBtn.textContent = 'Translate';
      } else {
        textarea.placeholder = 'Could not extract text. Try another image.';
      }
    } catch (err) {
      console.error(err);
      textarea.placeholder = 'Error extracting text. Please try again.';
    }

    textarea.placeholder = '여기에 한국어를 입력하거나 붙여넣으세요...';
    checkBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

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
  checkBtn.textContent = mode === 'translate' ? 'Translating...' : mode === 'translate-to-english' ? 'Translating...' : 'Checking...';
  output.innerHTML = '<div class="kg-loading"><div class="kg-spinner"></div><span>' + (mode === 'translate-to-english' ? 'Translating to English...' : mode === 'translate' ? 'Translating to Korean...' : 'Analyzing your Korean...') + '</span></div>';
  explanations.classList.remove('visible');
  copyBtn.style.display = 'none';
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
    if (mode === 'translate-to-english') {
      listenBtn.disabled = true;
      listenBtn.style.opacity = '0.4';
      listenBtn.style.cursor = 'not-allowed';
    } else {
      listenBtn.disabled = false;
      listenBtn.style.opacity = '1';
      listenBtn.style.cursor = 'pointer';
    }

    if (mode === 'translate' || mode === 'translate-to-english') {
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
  checkBtn.textContent = mode === 'translate' ? 'Translate to Korean' : mode === 'translate-to-english' ? 'Translate' : 'Check Grammar';
}

function translateText() {
  const text = textarea.value.trim();
  if (!text) { textarea.focus(); return; }
  if (isKorean(text)) {
    currentMode = 'translate-to-english';
  } else {
    currentMode = 'translate';
  }
  checkGrammar();
}
