<!-- MuMate unified flow — see MUMATE-GITHUB-FLOW.md -->
## Summary


## Type
- [ ] feat
- [ ] fix
- [ ] chore
- [ ] payment ⚠️ (triggers the FE↔BE sync checklist below)

## Hard Gate — run on YOUR machine, not in CI (see #318)
`lint` + `test` are enforced by `.githooks/pre-push` on every push. `build` is not — check it here.

- [ ] `npm run build` green — **paste the output below** (this is the one nothing enforces; ≈ 4m11s)
- [ ] `npm run lint` green (0 errors; warnings do not fail the gate)
- [ ] `npm test` green
- [ ] `git config core.hooksPath` prints `.githooks` on my machine

<details><summary>output of `npm run build`</summary>

```
paste here
```
</details>

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
