# Life

Personal life-management app (Health + Finances). See `CONTEXT.md` for
domain vocabulary and `docs/adr/0001-stack-choice.md` for the stack
decision.

## Local development

```bash
cp .env.example .env   # fill in DATABASE_URL and APP_PASSWORD_HASH_B64
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to
`/login`; enter the password corresponding to `APP_PASSWORD_HASH_B64`.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build/serve
- `npm test` — run the unit test suite (Vitest)
- `npm run typecheck` — TypeScript, no emit
- `npm run lint` — ESLint

## Deploying

See [DEPLOY.md](./DEPLOY.md) for the Vercel + Neon setup steps.
