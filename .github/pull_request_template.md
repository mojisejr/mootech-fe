<!-- MuMate unified flow — see MUMATE-GITHUB-FLOW.md -->
## Summary


## Type
- [ ] feat
- [ ] fix
- [ ] chore
- [ ] payment ⚠️ (triggers the FE↔BE sync checklist below)

## Hard Gate (must be green before merge)
- [ ] Build passes (`npm run build`)
- [ ] Static check passes (`npx tsc --noEmit`)
- [ ] Tests pass (`tsx scripts/*.test.ts`)

## Deploy impact
- [ ] I understand: **merge into `main` = production deploy** (no separate deploy step)
- [ ] No CLI deploy used (`vercel --prod` is forbidden — deploy = merge)

## Payment contract (fill only if `payment` type)
- [ ] Partner repo (FE↔BE) updated in the same change window
- [ ] Deploy ordering respected: **BE first, FE second**
- [ ] Omise webhook raw-body / idempotency unaffected

## Secrets
- [ ] gitleaks is green — no secret in this diff
- [ ] No `.env` or real keys committed
