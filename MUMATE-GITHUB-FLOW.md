# MuMate — Unified GitHub Flow & Guardrails

> **Canonical cross-repo contract** for the MuMate product (สายมู / ดวงจีน).
> Single source of truth for how the 3 sibling repos branch, review, and deploy together.
> Per-repo specifics live in each repo's `project_map.md` → "🔀 GitHub Flow" section, which links back here.

**Owner:** mojisejr (Non) · **Last ratified:** 2026-06-21 · **Mission:** `#mumate-github-flow-guardrails`

---

## 1. The Three Repos

| Repo | Role | Remote (deploy) | Platform | Ownership |
|------|------|-----------------|----------|-----------|
| **mootech-fe** | Consumer FE, `bazichart.mumate.co` | `origin` = mojisejr/mootech-fe | Vercel | Non (full) |
| **mootech-be** | Backend (auth, horoscope, payment, LINE) | `mootech` = mojisejr/mootech-be | Render | Non (full) |
| **bazi-sft-dataset** | Bazi engine + chat brain | `origin` = mojisejr/bazi-sft-dataset | Vercel | **Shared with friend** |

`bazi` has **no code dependency** on BE (domain overlap only). Payment lives in **FE + BE only**.

---

## 2. Branch Model (respect each repo's reality + shared protocol on top)

| Repo | Flow | Deploy branch | PR target |
|------|------|---------------|-----------|
| **FE** | `feat/*` → PR → `main` | `main` | `main` |
| **BE** | `feat/*` → PR → `main` | `main` (Render watches `main` — migration done 2026-06-21) | `main` |
| **bazi** | `chat/*` → PR → `pdf-dev` | friend-controlled | `pdf-dev` (friend reviews) |

- FE & BE are twins: `main` = production, owner controls via merge.
- bazi is a special case: `pdf-dev` is the friend's de-facto hub. We land chat work via PR into `pdf-dev`; the friend owns deploy. **We never impose repo-wide rules on bazi unilaterally.**

### Branch naming (all repos)
`feat/<scope>` · `fix/<scope>` · `chore/<scope>` · `payment/<scope>` (payment changes — triggers the FE↔BE sync checklist)

### Branch Hygiene (local discipline — prevents wrong-base mistakes)

The fear: editing on a stale or already-merged local branch, then shipping from the wrong base.

1. **Branch fresh, always.** Before starting new work: `git fetch`, then branch from the latest
   deploy base — `git checkout <base> && git pull && git checkout -b <type>/<scope>`. Never branch
   off a leftover feature branch.
2. **Verify before delete / before "done".** Never delete a branch or report a fix as shipped on
   assumption. Confirm the merge is real: `gh pr view <n>` shows `MERGED` **or** the commit is in
   `origin/<base>`. A PR still `OPEN` = **not live** → do not clean up, do not say "done".
3. **Return to base after merge.** When the operator says a PR is merged:
   `git checkout <base> → git pull → git branch -d <merged-branch>`. Prefer `-d` (it refuses
   unmerged branches as a safety net); use `-D` only after explicitly confirming the commits are in
   `<base>` (e.g. `git cherry <base> <branch>` shows none). End every cleanup back on `<base>` at
   latest, ready for the next mission.
4. **Base per repo:** `main` for FE/BE. **bazi is exempt** — its base is `pdf-dev` (friend-owned);
   branch from and return to `pdf-dev`, never force bazi onto `main`.

---

## 3. Deploy Rule — **deploy = merge into the deploy branch. Never CLI.**

Both platforms are git-integration driven:

| Repo | Platform | Trigger |
|------|----------|---------|
| FE | Vercel | merge → `main` → Vercel builds + ships prod |
| BE | Render | merge → `main` → `autoDeploy: yes` (`trigger: commit`) builds + ships prod |

**Because merge = instant production ship, the gate is the merge — not a separate deploy step.**

- 🚫 **Never deploy via CLI** (`vercel --prod`, manual Render deploy). CLI ships from a local working tree, bypassing git/PR/CI → prod drifts from `main`. Deploy = merge to `main`, full stop.
- 🚫 **AI never merges its own PR and never deploys.** AI opens the PR; the operator reviews and merges. The merge IS the operator's deploy decision.
- ✅ After a deploy, verify: Vercel deployment status (FE) / Render deploy id (BE).

> **Deploy-trigger reality note (updated 2026-06-22):** FE Vercel git auto-deploy is now confirmed working — merge → `main` ships prod automatically (operator verified). BE Render `autoDeploy: yes` on `main`. "merge = ship" now holds for both. (History: FE's PR #1 release once needed an explicit `vercel --prod` before auto-deploy was enabled.)

---

## 4. Payment Contract (FE ↔ BE) — fear: version skew

Payment spans **FE** (`pages/payment/*`, `pages/api/payment-package.ts`) and **BE** (`member-payment-code/*`, Omise webhook). They must not deploy out of sync.

- **Deploy ordering: BE first, FE second.** BE ships the new contract; FE follows (behind a feature flag where possible).
- Any PR touching the payment request/response shape, Omise flow, or webhook **must update the partner repo in the same change window** (see PR checklist).
- Omise webhook needs **raw body** (`BE src/main.ts` `express.raw` for `/callback/omise`). Do not move payment to a serverless/body-parsed target without re-verifying webhook signature handling.
- Live Omise = real money → deploy payment **last**, sandbox → live, with webhook idempotency.

---

## 5. Secret Hygiene — fear: key leak

- **No secrets in git, PRs, or logs.** Real values live only in platform dashboards (`sync: false` on Render; Vercel env).
- `.env*` is gitignored in all repos; `.env.example` (masked) is the contract.
- **gitleaks** runs on every PR (FE/BE) scanning the **diff only** (not full history — historical secrets are handled by rotation, not history rewrite).
- ⚠️ **Known exposure:** real OAuth/LINE/Omise secrets exist in early git history (FE init commit, BE init commit). They **cannot** be removed by force-push (violates append-only history). **Rotation is a required go-live gate** (separate workstream), not solved by this flow.

---

## 6. bazi Friend-Zone Protocol — fear: touching the friend's work

bazi is shared. Respect the split:

- 🔒 **FROZEN (friend's engine — consumers only):** `src/lib/bazi/**`, `src/app/api/reading/**`, doctrine, symbolic-engine, pdf/print.
- ✅ **OURS (chat layer):** `src/features/open-webui/**`, `src/app/api/v1/chat/**`. The seam is `reading-bridge.ts` → `/api/reading/topic`.
- A **local pre-commit hook** blocks edits to frozen paths on our machines.
- CODEOWNERS / CI / branch-protection on bazi are **proposed to the friend, never imposed** by us.
- Our work lands via `chat/*` → PR → `pdf-dev`. We do not push to friend branches directly.

---

## 7. CI Hard Gate (FE / BE only — bazi proposed, not imposed)

CI runs on PR **before merge** — the safety net between "merge" and "live". Lightweight, fast-fail.

| Repo | Build | Static | Test |
|------|-------|--------|------|
| **FE** | `npm run build` | `npx tsc --noEmit` (⚠️ **not** `next lint` — eslint not installed) | loop `tsx scripts/*.test.ts` |
| **BE** | `npm run build` (`nest build`) | eslint **no-fix** variant | `npm test` (jest unit `.spec.ts`, no DB) |
| **bazi** | (proposal) `npm run gate:default` | included | needs test DB → keep heavy lane nightly |

Plus **gitleaks** secret-scan on FE/BE PRs. CI is independent of Vercel/Render — it does not change how deploy works, it only adds a required check on the PR.

---

## 8. Branch Protection (operator-applied — AI is classifier-blocked)

On FE `main` and BE `main`:
- Require a pull request before merging
- Require status checks to pass (CI + gitleaks) before merging
- Require ≥1 approval
- Block force-push, block branch deletion

> Branch protection is **meaningful only with CI** — "require status checks" needs a check to require. AI provides the `gh api` commands; the operator (admin on both repos) runs them.

---

## 9. Operator-Only Steps (consolidated)

These cannot be done by AI (classifier-blocked or live-infra):
1. ✅ **DONE** — Vercel git auto-deploy + production branch = `main` (FE) verified working.
2. ✅ **DONE** — Render deploy branch switched to `main` (BE).
3. Apply **branch protection** on FE/BE `main` (AI provides commands). *(pending)*
4. **Rotate secrets** present in git history (go-live gate). *(pending)*
5. Decide on **bazi proposal** (accept CODEOWNERS/gitleaks/CI or keep hands-off) — friend's repo. *(pending)*

---

## 10. Sources

- bazi 2-person collaboration runbook (the seed of this contract) — Oracle memory `ψ/memory/logs/bazi/2026-06-15_collab-workflow-runbook.md`
- Distilled learning — `ψ/memory/learnings/mumate/github-flow-guardrails.md`
- Per-repo specifics — each repo's `project_map.md` → "🔀 GitHub Flow"
- Mission plan — `ψ/memory/logs/mumate/2026-06-21_21-56_unified-github-flow-guardrails-plan.md`

> Superseded for this group: the older `staging-centric-fleet-workflow` learning (staging hub model) does **not** apply to MuMate — we are **main-centric** (Vercel/Render PR previews are staging; no long-lived staging branch).
