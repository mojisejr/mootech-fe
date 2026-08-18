# mootech-fe

## Setup — run this once per clone

```bash
npm ci
git config core.hooksPath .githooks    # ⚠️ required — see below
```

### ⚠️ `core.hooksPath` is NOT installed by cloning

It is a **local git config value**, not a file in the repo. Committing `.githooks/pre-push` does nothing
on your machine until you run that one line. There is no check that catches a missing hook — if you skip
it, everything looks normal and the gate simply never runs.

Verify it took:

```bash
git config core.hooksPath        # must print: .githooks
```

## Hard gate — what must be green, and where

Decided in #318 (2026-08-18). `ci.yml` is being retired: merge into `main` is a production deploy and
GitHub Actions minutes are paid, so the checks moved onto your machine.

| when | what | cost here |
|---|---|---|
| every `git push` | `npm run lint` + `npm test` — enforced by `.githooks/pre-push` | ≈ 30s, stable |
| before opening a PR | `npm run build` — paste the output into the PR body | **41s – 408s** |

`build` is deliberately **not** in the hook, and the reason is the **variance**, not the average.
Five runs on the same commit (2026-08-18): `41s · 71s · 134s · 251s · 408s` — a 10× spread depending on
what `.next/` happens to hold. Anyone who just ran `npm ci`, or switched between distant branches, pays
the 400s end.

An unpredictable wait in front of every push is what teaches people to reach for `--no-verify` — and that
would take `lint` and `test` down with it, since they share the hook. `lint` + `test` sit at ~30s and
barely move; that stability is why they can live there and `build` cannot.

### What the gate does and does not catch

`npm run lint` is `eslint .` over the whole repo — **including root-level files** like `middleware.ts`
and `sw.ts`. The earlier `next lint --dir …` form silently skipped those, and returned
`✔ No ESLint warnings or errors` with exit 0 when a directory name was misspelled (#319).

Only **errors** fail the gate. Warnings are reported and do not block.

### If the hook blocks you

Fix the red thing. `git push --no-verify` bypasses every hook — it is not a wall — but bypassing means the
next person to touch `main` inherits whatever you skipped, and `main` deploys straight to production.

If the cost is genuinely too slow to live with, **say so in #320** rather than quietly bypassing. Someone
reaching for `--no-verify` is the agreed signal that this cost was set wrong.
