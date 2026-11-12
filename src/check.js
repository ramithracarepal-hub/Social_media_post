import { db } from './firebase.js';
const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(5).get();
for (const d of snap.docs) {
  const x = d.data();
  console.log(d.id, '|', x.status, '| ig:', x.igMediaId || '-', '| fb:', x.fbPostId || '-', '| attempts:', x.attempts || 0, '|', x.lastError || '');
}
process.exit(0);
