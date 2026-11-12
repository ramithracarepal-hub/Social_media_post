# Social Autoposter

This project generates a post idea with Gemini, creates an image, stores the scheduled post in Firestore, and publishes it to Instagram when the time arrives.

The working flow in this repo is:

- `node src/generate.js` creates future post slots for the next `DAYS_AHEAD` days
- each slot is saved in Firestore as a `posts` document with `status: "scheduled"`
- `node src/publish.js` finds due posts and publishes them to Instagram
- `node src/scheduler.js` runs a local cron loop for testing

## Why this setup exists

Cloud Functions / Cloud Scheduler / Cloud Storage are not available on Firebase Spark, so this project keeps everything simple and free:

- Firestore for scheduled posts and config
- Cloudinary for public image URLs
- Instagram Graph API for publishing
- GitHub Actions for cron-based automation

## Project layout

```text
src/config.js         environment defaults: brand, niche, tone, hours, timezone
src/firebase.js       Firestore admin connection
src/gemini.js         Gemini text + image generation
src/image.js          local fallback card image generator
src/cloudinary.js     upload image to Cloudinary and return public URL
src/instagram.js      publish image to Instagram
src/generate.js       generate upcoming scheduled posts
src/publish.js        publish scheduled posts that are due
src/refreshToken.js   refresh long-lived Instagram token
src/scheduler.js      local cron runner for testing
.github/workflows/    GitHub Actions automation
```

## Step 1 – Install dependencies

Use Node.js 20+.

```bash
cd social-autoposter
npm install
```

Create your local env file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## Step 2 – Fill in the environment

Edit `.env` and set the values from `.env.example`.

Required values for a working local setup:

```env
GEMINI_API_KEY=...
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
IMAGE_MODE=card
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

IG_USER_ID=...
IG_ACCESS_TOKEN=...
IG_GRAPH_VERSION=v23.0

BRAND_NAME=My Brand
NICHE=productivity tips for students
TONE=friendly, motivating, concise
AUDIENCE=college students in India
TZ_OFFSET_MIN=330
POST_HOURS=9,19
DAYS_AHEAD=3
DRY_RUN=false
```

Notes:

- `IMAGE_MODE=card` is the safest default because it creates a local gradient-card image without paying for Gemini image generation.
- `GEMINI_TEXT_MODEL` and `GEMINI_IMAGE_MODEL` can be changed if Google retires a model.
- `TZ_OFFSET_MIN` is in minutes. `330` = IST.
- `POST_HOURS` is a comma-separated list of hourly slots like `9,19`.

## Step 3 – Firebase setup

1. Create a Firestore database in Firebase.
2. Go to Project settings → Service accounts → Generate new private key.
3. Save the JSON as `serviceAccountKey.json` in the project root.
4. Make sure the local env file points to it:

```env
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
```

Optional security rule:

```bash
firebase deploy --only firestore:rules
```

The Admin SDK still works even if client rules are locked down.

## Step 4 – Cloudinary setup

1. Create a free Cloudinary account.
2. Copy your Cloud name, API key, and API secret into `.env`.
3. Instagram requires a public image URL, so this is required for publishing.

## Step 5 – Instagram setup

1. Convert the account to a Professional account (Business or Creator).
2. Go to Meta for Developers → Create App → Business → add the Instagram product.
3. Generate an Instagram access token and copy:
   - `IG_ACCESS_TOKEN`
   - `IG_USER_ID`
4. Required permissions are normally:
   - `instagram_business_basic`
   - `instagram_business_content_publish`
5. While the app is in Development mode, it works for your own business/creator account.
6. Validate the token:

```bash
curl "https://graph.instagram.com/v23.0/me?fields=user_id,username&access_token=YOUR_TOKEN"
```

## Step 6 – Sanity check without posting

Run the dry generation test first:

```bash
npm run generate:dry
```

This prints a draft caption and writes a local file named `preview.jpg`. Nothing is saved to Firestore and nothing is posted.

Edit the values in `.env` until the result looks good.

## Step 7 – First real local run

Generate scheduled posts:

```bash
npm run generate
```

This creates upcoming post docs in the Firestore `posts` collection using the configured `POST_HOURS` and `DAYS_AHEAD` values.

Preview what would publish without posting anything:

```bash
npm run publish:dry
```

Actually publish due posts:

```bash
npm run publish
```

If you want a local scheduler that checks for due posts every minute:

```bash
npm run dev
```

Tip: to test quickly, edit an existing Firestore document, set `scheduledAt` to a time in the past, and then run `npm run publish`.

## Step 8 – GitHub Actions

1. Push this repo to GitHub.
2. Generate a base64 string for the Firebase service account JSON:

   macOS / Linux:

   ```bash
   base64 -w0 serviceAccountKey.json
   ```

   Windows PowerShell:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("serviceAccountKey.json"))
   ```

3. In GitHub, add these repository secrets:

   - `FIREBASE_SERVICE_ACCOUNT_B64`
   - `GEMINI_API_KEY`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `IG_USER_ID`
   - `IG_ACCESS_TOKEN`

4. Add optional repository variables with defaults if you want to override them:

   - `BRAND_NAME`
   - `NICHE`
   - `TONE`
   - `AUDIENCE`
   - `POST_HOURS`
   - `TZ_OFFSET_MIN`
   - `DAYS_AHEAD`
   - `IMAGE_MODE`

5. In the Actions tab, run the workflows manually once:
   - `Generate upcoming posts`
   - `Publish due posts`

The project already includes these workflow files:

- `.github/workflows/generate.yml`
- `.github/workflows/publish.yml`
- `.github/workflows/refresh-token.yml`

## Notes and gotchas

- For local runs, `GOOGLE_APPLICATION_CREDENTIALS` is used. In GitHub Actions, the project uses `FIREBASE_SERVICE_ACCOUNT_B64` instead.
- Cloudinary is required because Instagram only accepts a public JPEG URL.
- The Instagram access token is long-lived for about 60 days; the refresh workflow renews it and stores the new value in Firestore.
- If a post is still scheduled but is more than 12 hours late, the publisher marks it `missed`.
- Failed posts retry up to 3 times, then they become `failed` with the last error stored in Firestore.
- GitHub scheduled workflows can pause after long inactivity; a push or manual re-run is enough to resume them.

## Extending the project

This repo is designed so each social platform can be added separately. The pattern is:

- create a new module like `src/facebook.js`
- expose a `publishImage({ imageUrl, caption })` function
- store a platform-specific field on the Firestore post
- update `publish.js` to route the post to the right platform

Instagram is the first working platform, and the app is structured to add the others one by one.
