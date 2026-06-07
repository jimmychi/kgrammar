const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(cors({
  origin: [
    'https://kgrammar.com',
    'https://kgrammar-client.onrender.com'
  ]
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please try again in an hour.' }
});

app.use('/api/check', limiter);

app.post('/api/check', async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'No text provided.' });
  }

  if (text.length > 500) {
    return res.status(400).json({ error: 'Text too long.' });
  }

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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

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
