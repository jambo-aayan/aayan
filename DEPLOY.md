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

## 3. Deploy (Vercel)

1. Import this repo at [vercel.com/new](https://vercel.com/new). Framework
   preset should auto-detect as Next.js.
2. In Project Settings → Environment Variables, add:
   - `DATABASE_URL` — the Neon pooled connection string from step 1
   - `APP_PASSWORD_HASH_B64` — the hash from step 2
3. Deploy.

## 4. Apply the database schema

After the first deploy (or any schema change), run migrations against the
Neon database from your local machine:

```bash
DATABASE_URL="<neon connection string>" npx prisma migrate deploy
```

## 5. Verify

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
