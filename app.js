const textarea = document.getElementById('input-text');
const charCount = document.getElementById('char-count');
const output = document.getElementById('output');
const checkBtn = document.getElementById('check-btn');
const explanations = document.getElementById('explanations');
const expBody = document.getElementById('exp-body');
const copyBtn = document.getElementById('copy-btn');
const outputFooter = document.getElementById('output-footer');
const errorCount = document.getElementById('error-count');

let lastCorrected = '';

textarea.addEventListener('input', () => {
  charCount.textContent = textarea.value.length + ' / 500';
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
  outputFooter.style.display = 'none';
  lastCorrected = '';
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

async function checkGrammar() {
  const text = textarea.value.trim();
  if (!text) { textarea.focus(); return; }

  checkBtn.disabled = true;
  checkBtn.textContent = 'Checking...';
  output.innerHTML = '<div class="kg-loading"><div class="kg-spinner"></div><span>Analyzing your Korean...</span></div>';
  explanations.classList.remove('visible');
  copyBtn.style.display = 'none';
  outputFooter.style.display = 'none';
  lastCorrected = '';

  const prompt = `You are an expert Korean grammar checker. The user will provide Korean text. Your job:
1. Correct any grammar, spelling, spacing, or punctuation errors
2. Return ONLY a raw JSON object with exactly these fields:
   - "corrected": the fully corrected Korean text (string)
   - "hasErrors": boolean — true if any corrections were made
   - "changes": array of objects, each with:
       "original": the incorrect word or phrase (string)
       "fixed": the corrected version (string)
       "reason": a short English explanation, max 10 words (string)

Rules:
- If the text is already correct, set hasErrors to false and changes to []
- Do NOT wrap in markdown or backticks
- Respond ONLY with the raw JSON object, nothing else

Korean text:
${text}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      agent: new (require('https-proxy-agent'))('http://fixie:mcLCpaN4FcMJU9J@criterium.usefixie.com:80'),
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) throw new Error('API error: ' + res.status);

    const data = await res.json();
    const raw = data.content.map(b => b.text || '').join('').trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    lastCorrected = result.corrected;
    copyBtn.style.display = 'block';
    outputFooter.style.display = 'flex';

    if (!result.hasErrors) {
      output.innerHTML =
        '<div class="kg-no-errors">✓ No errors found — your Korean looks great!</div>' +
        '<div style="padding: 4px 0; font-size: 15px; line-height: 1.75;">' + escapeHtml(result.corrected) + '</div>';
      errorCount.textContent = 'No corrections needed';
    } else {
      const count = result.changes ? result.changes.length : 0;
      output.innerHTML = '<div style="font-size: 15px; line-height: 1.75;">' + buildCorrectedHtml(result.corrected, result.changes) + '</div>';
      errorCount.textContent = count + ' correction' + (count !== 1 ? 's' : '') + ' made';

      if (result.changes && result.changes.length > 0) {
        expBody.innerHTML = result.changes.map((c, i) => `
          <div class="kg-exp-item">
            <div class="kg-exp-num">${i + 1}</div>
            <div class="kg-exp-text">
              <span class="diff-removed">${escapeHtml(c.original)}</span>
              &rarr;
              <span class="diff-added">${escapeHtml(c.fixed)}</span>
              &mdash; ${escapeHtml(c.reason)}
            </div>
          </div>
        `).join('');
        explanations.classList.add('visible');
      }
    }
  } catch (err) {
    console.error(err);
    output.innerHTML = '<div class="kg-error">Something went wrong. Please try again in a moment.</div>';
  }

  checkBtn.disabled = false;
  checkBtn.textContent = 'Check grammar';
}
