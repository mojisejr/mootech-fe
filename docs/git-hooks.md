# Git hooks — pre-push main-guard

A client-side **pre-push** hook that refuses an **accidental** push straight to this repo's protected branch.

## What it does

- On `git push`, if any ref being pushed targets the repo's **default/protected branch** (read from git —
  `main` here, `pdf-dev` in bazi; never hardcoded), the push is **rejected** with a message telling you to open a
  PR instead.
- A normal feature-branch push (`git push origin feat/…`) is unaffected.

## Install (once — covers every worktree)

```bash
bash scripts/install-git-hooks.sh
```

This sets `core.hooksPath` to the **main checkout's** `.githooks/` using an absolute path. Because worktrees share
`.git/config`, a single run covers the main checkout **and every worktree** — existing and future — with no
per-worktree setup. Re-run it any time to re-point.

To confirm: `git config core.hooksPath` should print the absolute `.githooks` path.

## ⚠️ What it does NOT do (read this)

This is a **guard, not a hard block**. It stops the "เผลอ push main" mistake — nothing more:

- **`git push --no-verify` bypasses it entirely** (it skips all hooks). It is not an enforcement layer.
- It only runs on machines where the installer has been run (it is local config, not committed enforcement).
- It cannot stop a determined direct push.

The real protection is still the team rule — **PR only, ฟีม merges** — plus the server-side `main-guard`
workflow (which goes red *after* a direct push lands). Those layers matter precisely *because* this one can be
bypassed. We have no "บังคับ" layer (GitHub Pro was declined); the net is **รู้ + ดัก**, and this is a ดัก.
