// harness/evidence-dir.mjs — the ONE place that decides where a harness run writes its images.
//
// WHY THIS FILE EXISTS AT ALL, rather than one `join(REPO, 'harness', 'pixel-proof')` per script:
// `.gitignore` already carries this lesson in its own words, written for `harness/out/_frames/`:
//
//     "ONE ignored root for every run dump. The first version of this listed dirs by name and the
//      very next card's runs walked straight past it — a rule that has to be updated every time it
//      is used is a rule that will be forgotten exactly once."
//
// `harness/pixel-proof/` WAS that very next card's runs. Six harnesses each hard-coded the path, so
// the rule had no way to reach them, and #414 alone put 23 PNGs / 9.91 MB into a PR — against a
// `pixel-proof/` on main that was already 75 files / 19.24 MB, inside a 488 MB `.git`. Nobody skipped
// a step; the path was spelled out six times and the ignore rule knew about none of them.
//
// So the path is a value now, imported from here. A seventh harness gets it by importing, and the day
// the root moves, it moves once. That is the whole point: the thing you must not forget should not be
// a thing you have to remember.
//
// The images stay REPRODUCIBLE, not preserved — the numbers are the evidence and they live in the PR
// body, next to the command that regenerates the picture. That is ฟีม's ruling on #417 (2026-08-23):
// evidence images are test output, not something the app serves.
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))

/** Absolute path to the ignored evidence root, created if missing. Pass a name to get a subdir. */
export function evidenceDir(name = '') {
  const out = name ? join(REPO, 'harness', '.tmp', name) : join(REPO, 'harness', '.tmp')
  mkdirSync(out, { recursive: true })
  return out
}

/** Repo root — every harness derives it the same way, so it lives here too. */
export const REPO_ROOT = REPO
