#!/usr/bin/env bash
# Install this repo's git hooks by pointing core.hooksPath at the MAIN checkout's .githooks/.
#
# Run ONCE, from anywhere inside the repo (main checkout or any worktree). Worktrees SHARE .git/config,
# and we set an ABSOLUTE hooksPath to the main checkout's .githooks — so this single run covers every
# worktree, existing and future, even ones whose branch predates .githooks/ (they don't need the files
# in their own tree; they all resolve to the main checkout's hooks).
set -euo pipefail

# The main checkout root = parent of the COMMON git dir (shared by all worktrees).
common_dir="$(git rev-parse --git-common-dir)"
main_root="$(cd "$(dirname "${common_dir}")" && pwd)"
hooks_dir="${main_root}/.githooks"

if [ ! -d "${hooks_dir}" ]; then
  echo "✗ ${hooks_dir} not found — run this from a checkout that has .githooks/ (after this PR merges)." >&2
  exit 1
fi

git config core.hooksPath "${hooks_dir}"
chmod +x "${hooks_dir}"/* 2>/dev/null || true

echo "✓ core.hooksPath → ${hooks_dir}"
echo "  shared via .git/config → covers this checkout AND every worktree (existing + future)."
echo "  active hooks: $(ls "${hooks_dir}" | tr '\n' ' ')"
echo "  note: 'git push --no-verify' still bypasses hooks — this is a guard, not a hard block."
