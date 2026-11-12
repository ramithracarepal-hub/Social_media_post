import 'dotenv/config';

export const config = {
  brandName: process.env.BRAND_NAME || 'My Brand',
  niche: process.env.NICHE || 'productivity tips',
  tone: process.env.TONE || 'friendly and concise',
  audience: process.env.AUDIENCE || 'general audience',
  tzOffsetMin: Number(process.env.TZ_OFFSET_MIN ?? 330), // IST = +330
  postHours: (process.env.POST_HOURS || '9,19').split(',').map((h) => Number(h.trim())),
  daysAhead: Number(process.env.DAYS_AHEAD || 3),
  imageMode: process.env.IMAGE_MODE || 'card',
  dryRun: process.env.DRY_RUN === 'true' || process.argv.includes('--dry'),
  textModel: process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite',
  imageModel: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
  graphVersion: process.env.IG_GRAPH_VERSION || 'v23.0',
};
