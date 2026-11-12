import crypto from 'node:crypto';

/** Uploads a JPEG buffer to Cloudinary (free tier) and returns a public https URL. */
export async function uploadJpeg(buffer) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'autoposter';

  // Signature: alphabetically sorted params + secret, SHA-1
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${secret}`)
    .digest('hex');

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'post.jpg');
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(`Cloudinary ${res.status}: ${JSON.stringify(json)}`);
  return json.secure_url;
}
