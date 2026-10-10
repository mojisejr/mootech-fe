<!-- MuMate unified flow — see MUMATE-GITHUB-FLOW.md -->
## Summary


## Type
- [ ] feat
- [ ] fix
- [ ] chore
- [ ] payment ⚠️ (triggers the FE↔BE sync checklist below)

## Hard Gate — run on YOUR machine, not in CI (see #318)
`lint` + `test` are enforced by `.githooks/pre-push` on every push. `build` is not — check it here.

- [ ] `npm run build` green — **paste the output below** (this is the one nothing enforces; 41s–408s depending on `.next/` cache)
      🔐 build ยังรัน **secret gate** ให้เองต่อท้าย ⇒ output ต้องมีบรรทัด `✅ VAPID private key absent from client bundle`
- [ ] `npm run lint` green (0 errors; warnings do not fail the gate)
- [ ] `npm test` green
- [ ] `git config core.hooksPath` prints `.githooks` on my machine

<details><summary>output of `npm run build`</summary>

```
paste here
```
</details>

## Deploy impact — merge ขึ้น staging เอง · production = owner กด
- [ ] เข้าใจว่า merge เข้า `main` = build image แล้ว **ขึ้น staging เอง** (ราว 10 นาที · Discord บอก `🧪 staging พร้อมทดสอบ`) · **production ขึ้นเมื่อ owner กดเท่านั้น** (หลังทดสอบบน staging แล้วบอก owner)
- [ ] migration ของฐาน: ไม่มี — หรือมี และ **รันบนฐาน production แล้วก่อน merge** (additive เท่านั้น) + บอก owner/agent ให้รันบนฐาน staging ด้วย
- [ ] env ใหม่: ไม่มี — หรือมี และบอก owner แล้ว (ต้องวางบนเครื่อง production ก่อนกด)
- [ ] No CLI deploy used (`vercel --prod` is forbidden)

## Payment contract (fill only if `payment` type)
- [ ] Partner repo (FE↔BE) updated in the same change window
- [ ] Deploy ordering respected: **BE first, FE second**
- [ ] Omise webhook raw-body / idempotency unaffected

## Secrets
- [ ] gitleaks is green — no secret in this diff
- [ ] No `.env` or real keys committed
