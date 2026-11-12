import { db } from './firebase.js';
const snap = await db.collection('posts').where('status', '==', 'scheduled').get();
for (const d of snap.docs) { await d.ref.delete(); console.log('deleted', d.id); }
console.log(`removed ${snap.size}`);
process.exit(0);
