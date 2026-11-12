import { config } from './config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const facebookEnabled = () => Boolean(process.env.FB_PAGE_ID && process.env.FB_PAGE_TOKEN);

/** Publishes a photo to the Facebook Page. Returns the post id. */
export async function publishToFacebook({ imageUrl, caption }) {
  const url = `https://graph.facebook.com/${config.graphVersion}/${process.env.FB_PAGE_ID}/photos`;
  const body = new URLSearchParams({
    url: imageUrl,
    message: caption,
    access_token: process.env.FB_PAGE_TOKEN,
  });

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (e) {
      // network error (e.g. connect timeout): the request never reached Facebook, safe to retry
      lastErr = e;
      console.warn(`facebook network error (attempt ${attempt}), retrying...`);
      await sleep(3000 * attempt);
      continue;
    }
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(`Facebook ${res.status}: ${JSON.stringify(data.error || data)}`);
    return data.post_id || data.id;
  }
  throw new Error(`Facebook network failure: ${lastErr?.cause?.code || lastErr?.message}`);
}