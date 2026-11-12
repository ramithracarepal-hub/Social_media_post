import fs from 'node:fs';
import { db, Timestamp } from './firebase.js';
import { config } from './config.js';
import { generatePostIdea, generateImage } from './gemini.js';
import { makeCard, toJpeg } from './image.js';
import { uploadJpeg } from './cloudinary.js';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const i = args.indexOf('--days');
const DAYS = i >= 0 ? Number(args[i + 1]) : config.daysAhead;
const pad = (n) => String(n).padStart(2, '0');

/** Future posting slots for the next N days (in the configured timezone). */
function upcomingSlots(days) {
  const offsetMs = config.tzOffsetMin * 60000;
  const nowMs = Date.now();
  const localNow = new Date(nowMs + offsetMs);
  const y = localNow.getUTCFullYear(), m = localNow.getUTCMonth(), d = localNow.getUTCDate();
  const slots = [];
  for (let n = 0; n < days; n++) {
    const day = new Date(Date.UTC(y, m, d + n));
    for (const h of config.postHours) {
      const utcMs = Date.UTC(y, m, d + n, h, 0, 0) - offsetMs;
      if (utcMs > nowMs + 10 * 60000) {
        const id = `ig_${day.getUTCFullYear()}${pad(day.getUTCMonth() + 1)}${pad(day.getUTCDate())}_${pad(h)}`;
        slots.push({ id, when: new Date(utcMs) });
      }
    }
  }
  return slots;
}

async function main() {
  const recentSnap = await db.collection('posts').orderBy('createdAt', 'desc').limit(15).get();
  const recent = recentSnap.docs.map((d) => d.data().headline).filter(Boolean);

  for (const slot of upcomingSlots(DAYS)) {
    const ref = db.collection('posts').doc(slot.id);
    if (!DRY && (await ref.get()).exists) { console.log(`skip ${slot.id} (already exists)`); continue; }

    console.log(`generating ${slot.id} for ${slot.when.toISOString()}`);
    const idea = await generatePostIdea({ ...config, recentTopics: recent });

    let img;
    if (config.imageMode === 'gemini') {
      try { img = await generateImage(idea.imagePrompt); }
      catch (e) { console.warn('Gemini image failed, using card instead:', e.message.slice(0, 200)); }
    }
    if (!img) img = await makeCard(idea.headline, config.brandName);
    const jpeg = await toJpeg(img);

        const DISCLAIMER = 'General information only, not medical advice. Please consult a qualified doctor for your health concerns.';
        const tags = idea.hashtags.map((h) => '#' + h.replace(/^#/, '').replace(/\s+/g, '')).join(' ');
        const caption = `${idea.caption.trim()}\n\n${DISCLAIMER}\n\n${tags}`.slice(0, 2200);

    if (DRY) {
      fs.writeFileSync('preview.jpg', jpeg);
      console.log('--- DRY RUN (nothing saved) ---\nHeadline:', idea.headline, '\n\n' + caption, '\n\nImage saved to preview.jpg');
      return;
    }

    const imageUrl = await uploadJpeg(jpeg);
    await ref.set({
      platform: 'instagram',
      status: 'scheduled',
      headline: idea.headline,
      caption,
      imageUrl,
      scheduledAt: Timestamp.fromDate(slot.when),
      createdAt: Timestamp.now(),
      attempts: 0,
    });
    recent.unshift(idea.headline);
    console.log(`saved ${slot.id}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
