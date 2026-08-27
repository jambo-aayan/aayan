# Deploying

This app needs a Neon Postgres database and a Vercel project. Both require
accounts and dashboard steps this agent can't perform — do these manually.

## 1. Database (Neon)

1. Create a free project at [neon.tech](https://neon.tech).
2. Copy the pooled connection string (Neon's dashboard labels it "Connection
   string" — use the `-pooler` host, since Vercel's serverless functions open
   many short-lived connections).
3. You'll set this as `DATABASE_URL` in Vercel (step 3 below).

## 2. Generate the app password hash

The shared login password is never stored in plaintext. Generate a
base64-encoded bcrypt hash locally:

```bash
node -e "console.log(Buffer.from(require('bcryptjs').hashSync(process.argv[1], 10)).toString('base64'))" "your-chosen-password"
```

Copy the output — you'll set it as `APP_PASSWORD_HASH_B64` in Vercel.

## 3. Photo storage (Vercel Blob)

System Checkpoint step photos are stored in Vercel Blob, not the database.

1. In the Vercel dashboard, open your project → Storage → Create Database →
   Blob. This provisions a Blob store and, once connected to the project,
   automatically sets `BLOB_READ_WRITE_TOKEN` as an environment variable —
   no manual token copying needed.
2. For local development, run `vercel env pull .env` after connecting the
   store (or copy `BLOB_READ_WRITE_TOKEN` from the dashboard by hand) so
   photo uploads work outside of Vercel's own deploys too.

## 4. Statement parsing (Gemini)

Bank statement uploads (Finances → Statements) are parsed by Gemini 2.5 Flash
via the `@google/genai` SDK.

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. You'll set this as `GEMINI_API_KEY` in Vercel (step 5 below), same pattern
   as `BLOB_READ_WRITE_TOKEN` above.

## 5. Deploy (Vercel)

1. Import this repo at [vercel.com/new](https://vercel.com/new). Framework
   preset should auto-detect as Next.js.
2. In Project Settings → Environment Variables, add:
   - `DATABASE_URL` — the Neon pooled connection string from step 1
   - `APP_PASSWORD_HASH_B64` — the hash from step 2
   - `BLOB_READ_WRITE_TOKEN` — set automatically once a Blob store is
     connected (step 3); confirm it's present if uploads don't work.
   - `GEMINI_API_KEY` — the API key from step 4
3. Deploy.

## 6. Apply the database schema

After the first deploy (or any schema change), run migrations against the
Neon database from your local machine:

```bash
DATABASE_URL="<neon connection string>" npx prisma migrate deploy
```

## 7. Verify

- Visit the deployed URL — it should redirect to `/login`.
- Enter the password from step 2 — it should redirect to `/` showing the
  blank authenticated shell.
- `GET /api/health` should return `{"ok":true}`, confirming the app can
  reach Neon via Prisma.
- On mobile Chrome/Safari, the browser should offer "Add to Home Screen" /
  "Install app" (PWA manifest + service worker are already wired up).

## Local development

```bash
cp .env.example .env   # fill in DATABASE_URL (a local Postgres works fine)
                        # and APP_PASSWORD_HASH_B64 (see step 2 above)
npm install
npx prisma migrate dev
npm run dev
```
