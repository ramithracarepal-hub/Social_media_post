import { pathToFileURL } from 'node:url';
import { db, Timestamp } from './firebase.js';
import { config } from './config.js';
import { publishImage } from './instagram.js';
import { publishToFacebook, facebookEnabled } from './facebook.js';

const MAX_ATTEMPTS = 3;
const STALE_MS = 12 * 3600 * 1000;

export async function publishDue() {
  const snap = await db.collection('posts').where('status', '==', 'scheduled').get();
  const now = Date.now();
  const due = snap.docs
    .filter((d) => d.data().scheduledAt.toMillis() <= now)
    .sort((a, b) => a.data().scheduledAt.toMillis() - b.data().scheduledAt.toMillis());

  console.log(`${due.length} post(s) due`);
  const fbOn = facebookEnabled();

  for (const doc of due) {
    const data = doc.data();

    if (config.dryRun) {
      console.log(`[DRY_RUN] would post ${doc.id} to instagram${fbOn ? ' + facebook' : ''}:\n${data.caption}\n${data.imageUrl}\n`);
      continue;
    }

    if (now - data.scheduledAt.toMillis() > STALE_MS) {
      await doc.ref.update({ status: 'missed' });
      console.log(`${doc.id} too old, marked missed`);
      continue;
    }

    // claim it so two runs never post the same thing
    const claimed = await db.runTransaction(async (tx) => {
      const s = await tx.get(doc.ref);
      if (s.data().status !== 'scheduled') return false;
      tx.update(doc.ref, { status: 'publishing' });
      return true;
    });
    if (!claimed) continue;

    // only attempt platforms that haven't succeeded yet, so retries never double-post
    const update = {};
    const errors = [];
    const jobs = [];

    if (!data.igMediaId) {
      jobs.push(
        publishImage({ imageUrl: data.imageUrl, caption: data.caption })
          .then((id) => { update.igMediaId = id; console.log(`instagram ok ${doc.id} -> ${id}`); })
          .catch((e) => { errors.push(`IG: ${e.message}`); console.error(`instagram failed ${doc.id}:`, e.message); })
      );
    }
    if (fbOn && !data.fbPostId) {
      jobs.push(
        publishToFacebook({ imageUrl: data.imageUrl, caption: data.caption })
          .then((id) => { update.fbPostId = id; console.log(`facebook ok ${doc.id} -> ${id}`); })
          .catch((e) => { errors.push(`FB: ${e.message}`); console.error(`facebook failed ${doc.id}:`, e.message); })
      );
    }
    await Promise.all(jobs);

    const igDone = Boolean(data.igMediaId || update.igMediaId);
    const fbDone = !fbOn || Boolean(data.fbPostId || update.fbPostId);

    if (igDone && fbDone) {
      await doc.ref.update({ ...update, status: 'posted', postedAt: Timestamp.now(), lastError: null });
    } else {
      const attempts = (data.attempts || 0) + 1;
      await doc.ref.update({
        ...update,
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'scheduled',
        attempts,
        lastError: errors.join(' | ').slice(0, 500),
      });
      console.error(`${doc.id} incomplete (attempt ${attempts})`);
    }
  }
}

// run directly: node src/publish.js
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  publishDue().catch((e) => { console.error(e); process.exit(1); });
}