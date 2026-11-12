import { config } from './config.js';
import { db } from './firebase.js';

const GRAPH = () => `https://graph.facebook.com/${config.graphVersion}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Token lives in Firestore (config/instagram) so it can be refreshed automatically; falls back to .env */
export async function getToken() {
  const snap = await db.collection('config').doc('instagram').get();
  return snap.exists && snap.data().token ? snap.data().token : process.env.IG_ACCESS_TOKEN;
}

async function graph(method, url, params) {
  const opts = { method };
  if (method === 'POST') {
    opts.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    opts.body = new URLSearchParams(params);
  } else {
    url += '?' + new URLSearchParams(params);
  }
  const res = await fetch(url, opts);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`Instagram ${res.status}: ${JSON.stringify(json.error || json)}`);
  return json;
}

/** Publishes a single image post. Returns the Instagram media id. */
export async function publishImage({ imageUrl, caption }) {
  const token = await getToken();
  const igId = process.env.IG_USER_ID;

  // 1) create media container
  const { id: creationId } = await graph('POST', `${GRAPH()}/${igId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: token,
  });

  // 2) wait until the container is ready
  for (let i = 0; i < 12; i++) {
    const { status_code } = await graph('GET', `${GRAPH()}/${creationId}`, {
      fields: 'status_code',
      access_token: token,
    });
    if (status_code === 'FINISHED') break;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Container ${status_code}`);
    await sleep(5000);
  }

  // 3) publish
  const { id } = await graph('POST', `${GRAPH()}/${igId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  });
  return id;
}
