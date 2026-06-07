const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: [
    'https://kgrammar.com',
    'https://www.kgrammar.com',
    'https://kgrammar-client.onrender.com'
  ]
}));
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please try again in an hour.' }
});

app.use('/api/', limiter);

app.post('/api/extract', async (req, res) => {
  const { base64, mediaType } = req.body;
  if (!base64 || !mediaType) return res.status(400).json({ error: 'No image provided.' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 }
            },
            {
              type: 'text',
              text: 'Extract all Korean or English text from this image. Return ONLY the extracted text, nothing else. No explanations, no formatting, just the raw text.'
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.content.map(b => b.text || '').join('').trim();
    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not extract text from image.' });
  }
});

app.post('/api/check', async (req, res) => {
  const { text, mode } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'No text provided.' });
  }
  if (text.length > 500) {
    return res.status(400).json({ error: 'Text too long.' });
  }

  const prompt = mode === 'translate-to-english'    ? `You are an expert Korean to English translator. Translate the following Korean text to natural, fluent English.Return ONLY a raw JSON object with this field:- "corrected": the English translation (string)Do NOT wrap in markdown or backticks. Respond ONLY with the raw JSON object.Korean text:${text}`    : mode === 'translate'
    ? `You are an expert Korean translator. Translate the following English text to natural, fluent Korean.
Return ONLY a raw JSON object with this field:
- "corrected": the Korean translation (string)
Do NOT wrap in markdown or backticks. Respond ONLY with the raw JSON object.

English text:
${text}`
    : `You are an expert Korean language teacher and grammar checker. The user will provide Korean text. Your job:
1. Correct any grammar, spelling, spacing, or punctuation errors
2. Return ONLY a raw JSON object with exactly these fields:
   - "corrected": the fully corrected Korean text (string)
   - "hasErrors": boolean — true if any corrections were made
   - "changes": array of objects, each with:
       "original": the incorrect word or phrase (string)
       "fixed": the corrected version (string)
       "reason": a short one-line summary of the error, max 10 words (string)
       "explanation": a full educational explanation (2-4 sentences) covering: what the grammar rule is, why the original was wrong, when to use the correct form, and a tip to remember it. Write this for an English-speaking Korean learner.
Rules:
- If the text is already correct, set hasErrors to false and changes to []
- Do NOT wrap in markdown or backticks
- Respond ONLY with the raw JSON object, nothing else

Korean text:
${text}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error('Anthropic error:', errData);
      return res.status(500).json({ error: 'Anthropic API error.' });
    }

    const data = await response.json();
    const raw = data.content.map(b => b.text || '').join('').trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`kgrammar server running on port ${PORT}`));
