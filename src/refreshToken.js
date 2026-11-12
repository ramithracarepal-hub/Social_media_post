import { db, Timestamp } from './firebase.js';
import { getToken } from './instagram.js';
import { config } from './config.js';

// Long-lived Instagram tokens last 60 days. Refreshing (allowed once the token is >24h old) gives another 60 days.
const token = await getToken();
const res = await fetch(
  `https://graph.instagram.com/refresh_access_token?` +
    new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token })
);
const json = await res.json();
if (!res.ok || json.error) {
  console.error('Refresh failed:', JSON.stringify(json));
  process.exit(1);
}
await db.collection('config').doc('instagram').set({
  token: json.access_token,
  refreshedAt: Timestamp.now(),
  expiresInSeconds: json.expires_in,
});
console.log(`Token refreshed, valid for ~${Math.round(json.expires_in / 86400)} days`);
