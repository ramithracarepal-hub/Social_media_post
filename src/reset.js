import { db, Timestamp } from './firebase.js';

const id = process.argv[2];
if (!id) { console.error('usage: node src/reset.js <postId>'); process.exit(1); }

const ref = db.collection('posts').doc(id);
const snap = await ref.get();
if (!snap.exists) { console.error(`no such post: ${id}`); process.exit(1); }

await ref.update({
  status: 'scheduled',
  scheduledAt: Timestamp.fromMillis(Date.now() - 60 * 1000), // due 1 minute ago
  attempts: 0,
});
console.log(`reset ${id}, now due`);