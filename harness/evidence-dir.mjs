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
import { dirname, join, resolve, sep } from 'node:path'
import { mkdirSync, lstatSync } from 'node:fs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const ROOT = join(REPO, 'harness', '.tmp')

/**
 * Absolute path to the ignored evidence root, created if missing. Pass a name to get a subdir.
 * Throws if `name` would land outside the root.
 *
 * 🔴 THE ARGUMENT IS CHECKED BECAUSE THE FIRST VERSION OF THIS FUNCTION DID NOT CHECK IT, and ตู๋
 * walked out through it while adversarially reviewing #417 — the review I asked for precisely because
 * I should not certify my own gate:
 *     evidenceDir('../pixel-proof')       → harness/pixel-proof   (back inside the TRACKED dir)
 *     evidenceDir('a/../../pixel-proof')  → harness/pixel-proof   (same, past a naive '..' check)
 *     evidenceDir('../../..')             → the parent of the repo — and mkdirSync CREATED it there,
 *                                           in the directory every worktree on this machine sits in.
 * One function holds the whole rule, so one unchecked argument was the whole rule being optional.
 * `resolve` first (it normalises the `a/../..` form that a substring check misses), then require the
 * root prefix WITH a separator — 'harness/.tmpX' must not pass a bare startsWith. Validate BEFORE
 * mkdirSync: a guard that throws after creating the directory has already done the damage.
 *
 * 🔴 CONTAINMENT IS LEXICAL, AND THAT IS NOT THE WHOLE STORY. ตู๋ went through it a second time on the
 * same review: `resolve` reads the STRING, so if the root itself is a symlink the check passes while
 * the bytes land somewhere else — he proved it with `ln -s /tmp/x harness/.tmp`, and the direction that
 * actually costs us is `.tmp -> pixel-proof`, which puts output back in the TRACKED tree while the guard
 * reports everything is fine. So the root is refused outright when it is a symlink. What is still NOT
 * covered: a symlink at an intermediate component created between this check and the write. That is a
 * real remaining gap, it is filed as #420, and it is written here rather than left for the next person
 * to discover — a guard whose limits are undocumented gets trusted past them.
 */
export function evidenceDir(name = '') {
  // the root must be a real directory, never a link — see the symlink note above
  try {
    if (lstatSync(ROOT).isSymbolicLink()) {
      throw new Error(`evidenceDir: ${ROOT} is a symlink. The evidence root must be a real directory — a link makes the containment check below true about the path and false about where the bytes land.`)
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e   // not existing yet is fine; mkdirSync creates it
  }
  const out = name ? resolve(ROOT, name) : ROOT
  if (out !== ROOT && !out.startsWith(ROOT + sep)) {
    throw new Error(`evidenceDir: "${name}" resolves outside the evidence root (${out}). Harness output must stay under ${ROOT} — that is the only path .gitignore knows about.`)
  }
  mkdirSync(out, { recursive: true })
  return out
}

/** Repo root — every harness derives it the same way, so it lives here too. */
export const REPO_ROOT = REPO
