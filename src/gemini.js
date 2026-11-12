import { config } from './config.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// If the main text model is overloaded, these older Flash models are tried next.
const TEXT_FALLBACKS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

async function callGemini(model, body) {
  const models = [model, ...(model === config.textModel ? TEXT_FALLBACKS : [])];
  let lastErr;

  for (const m of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`calling ${m} (attempt ${attempt})...`);
      try {
        const res = await fetch(`${BASE}/${m}:generateContent`, {
          method: 'POST',
          signal: AbortSignal.timeout(60000),
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify(body),
        });
        if (res.ok) return res.json();

        const text = await res.text();
        lastErr = new Error(`Gemini ${m} ${res.status}: ${text}`);
        if (![429, 500, 503, 504].includes(res.status)) throw lastErr;
        console.warn(`${m} returned ${res.status}, retrying...`);
      } catch (e) {
        if (e.name === 'TimeoutError' || e.name === 'AbortError') {
          lastErr = new Error(`${m} timed out after 60s`);
          console.warn(`${m} timed out, retrying...`);
        } else {
          throw e;
        }
      }
      await sleep(attempt * 3000);
    }
    console.warn(`${m} kept failing, trying next model...`);
  }
  throw lastErr;
}

/** Returns { headline, caption, hashtags[], imagePrompt } */
export async function generatePostIdea({ niche, tone, audience, brandName, recentTopics = [] }) {
  const prompt = `You are the social media manager for "${brandName}", a health and wellness information page.
Niche: ${niche}
Audience: ${audience}
Tone: ${tone}

Create ONE Instagram image post.
- headline: a punchy hook of at most 8 words, shown on the image.
- caption: 60-110 words, starts with a hook, gives practical value, ends with a short call to action (save, share, or ask your doctor). Max 2 emojis.
- hashtags: 8 to 12 relevant hashtags, without the # symbol.
- imagePrompt: a description of a realistic, high-quality editorial photograph for this post: natural light, shallow depth of field, calm colours, and everyday objects or scenes (food, water, sleep, walking, nature, a tidy desk). No text, letters, logos or watermarks. No close-up faces, no medical procedures, no pills or syringes, no anatomy, and no before/after.

Health content rules:
- General education only. Never diagnose, never promise cures or results, and never recommend specific medicines, doses or supplements.
- No fear-based, "miracle" or "guaranteed" claims, and no before/after claims.
- Only use well-established guidance (WHO, ICMR, Ministry of Health). If you are not sure a claim is accurate, leave it out.
- For symptoms or conditions, encourage seeing a qualified doctor.

Do NOT repeat or closely resemble these recent topics:
${recentTopics.length ? recentTopics.map((t) => `- ${t}`).join('\n') : '(none yet)'}`;

  const data = await callGemini(config.textModel, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 1.0,
      responseSchema: {
        type: 'OBJECT',
        properties: {
          headline: { type: 'STRING' },
          caption: { type: 'STRING' },
          hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
          imagePrompt: { type: 'STRING' },
        },
        required: ['headline', 'caption', 'hashtags', 'imagePrompt'],
      },
    },
  });

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return JSON.parse(text);
}
/** Returns an image Buffer. Throws if the model/plan does not allow image generation. */
export async function generateImage(imagePrompt) {
  const data = await callGemini(config.imageModel, {
    contents: [{ parts: [{ text: `${imagePrompt}\nSquare 1:1 composition. No text, no letters, no watermark.` }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  });
  const parts = data.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  if (!img) throw new Error('Gemini returned no image');
  const b64 = (img.inlineData || img.inline_data).data;
  return Buffer.from(b64, 'base64');
}