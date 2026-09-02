// #585 — the three co-worker slots, as a pure module.
//
// WHY PURE, AND WHY ITS OWN FILE. The love screen compares exactly one person and must keep doing so.
// If `person2` in useCompatibility became an array, love would carry array types for a value it can
// never have more than one of, and every love-side reader would grow a `[0]` that is correct today and
// wrong the first time someone changes the cap. So "many people" lives here, above the single-pair
// primitives, and never inside them.
//
// THE CAP IS NOT OURS. `MAX_CANDIDATES = 3` is the engine's own constant —
// bazi-sft-dataset origin/pdf-dev src/app/api/bazi/work/route.ts:13, and route.ts:36-38 answers 400
// with "เปรียบเทียบได้สูงสุด 3 คน" above it. Figma draws exactly three slots for the same reason.
// 🔴 THIS IS NOT "THE ONE PLACE THAT HAS TO MOVE" — that is what this comment used to say, and it was
// wrong. The cap is mirrored in THREE files: here (the screen's local refusal), `lib/matching/
// bazi-work-client.ts:25` (what the route actually enforces), and `compatibility.ts:96` (`maxCandidates`,
// which decides how many slots are drawn). ตู๋ measured the drift both ways while reviewing
// mootech-fe#589: raising this one reddens the screen suite, raising the SERVER one reddens nothing.
// A sentence claiming a single source of truth is worse than no sentence, because it tells the next
// person the other two do not exist.
// The copies stay — `bazi-work-client` reads `process.env` at module scope and belongs to the server
// lane — and `scripts/colleague-cap-agreement.test.ts` now holds them equal instead of this comment.
import type { CompatPerson } from './compatibility-api'

/** the engine's cap, mirrored. See the note above before changing it. */
export const MAX_CANDIDATES = 3

/** One form row: a chosen person, or an empty slot waiting for one. */
export type CandidateSlot = { index: number; person: CompatPerson | null }

/**
 * The rows to render — ALWAYS `MAX_CANDIDATES` of them, filled first.
 *
 * The screen asks for slots rather than mapping the list, so an empty form and a full one render
 * through the same code path. Figma draws three rows whether or not anyone is chosen (720:25502 vs
 * 720:27969), and a `list.map` plus a separate "and now the empty ones" branch is two code paths for
 * one row.
 */
export function candidateSlots(chosen: readonly CompatPerson[]): CandidateSlot[] {
  return Array.from({ length: MAX_CANDIDATES }, (_, index) => ({
    index,
    person: chosen[index] ?? null,
  }))
}

/**
 * Add someone to the end. Refuses a duplicate and refuses to exceed the cap, and says so by returning
 * the SAME array reference — the caller can compare identity to know nothing happened.
 *
 * 🔴 The duplicate check is not decoration. Figma has no "already chosen" state on the picker rows
 * (720:25549 draws them all alike), so nothing on screen stops a second tap on the same person, and the
 * engine would then be asked to rank someone against themselves twice. Refusing here is cheaper than
 * explaining a duplicate row afterwards.
 */
export function addCandidate(
  chosen: readonly CompatPerson[],
  person: CompatPerson,
): readonly CompatPerson[] {
  if (chosen.length >= MAX_CANDIDATES) return chosen
  if (chosen.some((p) => p.id === person.id)) return chosen
  return [...chosen, person]
}

/**
 * Put someone in a specific slot — what the chevron on a filled row does.
 *
 * Choosing a person who is ALREADY in another slot moves them here rather than duplicating them, and
 * the slot they came from collapses. Anything else leaves the same human on screen twice.
 */
export function setCandidateAt(
  chosen: readonly CompatPerson[],
  index: number,
  person: CompatPerson,
): readonly CompatPerson[] {
  if (index < 0 || index >= MAX_CANDIDATES) return chosen
  const without = chosen.filter((p, i) => p.id !== person.id || i === index)
  const next = [...without]
  if (index < next.length) next[index] = person
  else next.push(person)
  return next.slice(0, MAX_CANDIDATES)
}

/** Remove by id. Later slots move up, because a hole in the middle is not a state the form has. */
export function removeCandidate(
  chosen: readonly CompatPerson[],
  id: string,
): readonly CompatPerson[] {
  const next = chosen.filter((p) => p.id !== id)
  return next.length === chosen.length ? chosen : next
}

/**
 * May the "ดูผลลัพธ์เลย" button fire?
 *
 * ONE person is enough — Figma 720:27747 draws the button ENABLED with a single slot filled and two
 * still empty. Requiring all three would make the empty slots mandatory, which is the opposite of what
 * that frame shows.
 */
export function canCompare(chosen: readonly CompatPerson[]): boolean {
  return chosen.length >= 1
}
