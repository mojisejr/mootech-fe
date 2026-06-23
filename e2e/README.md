# Auth E2E Smoke (`#mootech-auth-e2e-smoke`)

A committed Playwright smoke test that guards the **login-loop regression**: a
logged-in user must **never** be bounced to `/login` because the refer-code
cookie is empty.

- Bug history: FE PR #13 (`menu` `resolveMatchingTarget` / `backfillAndRoute`) +
  BE PR #5 (`ensureReferCode`) fixed the v2 loop:
  `logged-in + empty MEMBER_REFER_CODE → menu ดวงสมพงศ์ → /login?refresh=2 → loop`.
- The vow: see `learnings/mootech-fe/authed-branch-loading.md`
  ("fail to loading, redirect to /login only when truly anon").

## What it asserts

`e2e/auth-loop.spec.ts`:

- **Case A** — authed + refer-code present → tap ดวงสมพงศ์ → lands `/matching`.
- **Case B** (the regression) — authed + **empty** refer-code → tap ดวงสมพงศ์ →
  the menu **backfills** (`UserGetById` → `refer_code`) and routes to `/matching`,
  **never** `/login`.

Both cases also assert a stability window so a transient bounce-to-`/login`
loop is caught, not just the final URL.

## How auth is seeded (no OAuth)

The spec drives the existing **`/dev-login`** page, which uses the `dev`
`CredentialsProvider` (gated on `NODE_ENV !== "production"`). This mints a real
NextAuth session **and** sets the `MEMBER_*` cookies, with no OAuth/consent. We
do not forge a JWT. OAuth providers (LINE/Google) cannot be automated and are
out of scope — this smoke is **not** a substitute for operator LINE-prod
verification of timing-sensitive races; it guards the **refer-code-empty** class.

## Prerequisites (LOCAL ONLY)

This test is **local-only** and is **not wired into CI** (CI has no BE/DB). It
needs the full local stack running against the **dev** database:

1. **Backend** (`projects/mootech-be`):
   ```bash
   npm run env:dev      # point .env at dev Supabase (verify with npm run env:which)
   npm run start:dev    # serves :4000
   ```
2. **Frontend** (this repo): `.env` / `.env.local` must set
   `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000` and `NEXTAUTH_URL=http://localhost:3000`.
   ```bash
   npm run dev          # serves :3000
   ```
3. The seeded `E2E_DEV_USER_ID` must be a **real dev-DB user** (so the backfill
   `UserGetById` resolves a `refer_code`).

## Run

```bash
npm run test:e2e:auth
```

### Env overrides

| Var | Default | Purpose |
|-----|---------|---------|
| `E2E_DEV_USER_ID` | first `SAMPLE_USERS` id in `pages/dev-login.tsx` | dev-DB user to seed |
| `E2E_DEV_USER_NAME` | `เกวลิน` | display name |

## Notes / constraints

- **Self-contained specs**: helpers are co-located in the spec file. The app
  `tsconfig.json` uses `moduleResolution: "bundler"`, which makes Playwright
  1.61 throw `context.conditions?.includes is not a function` on cross-file
  relative imports; importing only `@playwright/test` avoids it without touching
  the production tsconfig. Extract shared helpers only once that is resolved.
- Specs live under `e2e/*.spec.ts` so the CI `for f in scripts/*.test.ts` loop
  never picks them up. Do not place e2e files under `scripts/`.
- Failure artifacts (screenshots/trace) land in `test-results/` (gitignored).

## Future scope (not done here)

- Wiring e2e into CI requires provisioning BE + a disposable DB in the workflow —
  a separate tooling task, intentionally deferred.
