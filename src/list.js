import { db } from './firebase.js';
const snap = await db.collection('posts').orderBy('createdAt', 'desc').limit(8).get();
for (const d of snap.docs) {
  const x = d.data();
  console.log(d.id, '|', x.status, '|', x.scheduledAt.toDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), '|', x.headline);
}
process.exit(0);
