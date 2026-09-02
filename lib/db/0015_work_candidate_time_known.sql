-- 0015 · work_comparison_candidate.time_known: remember whether the hour was real (mootech-fe#585)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND.
--
-- 🔴 WHY A NEW FILE INSTEAD OF EDITING 0014. 0014 has already run against prod. A migration file is a
-- record of what ran; rewriting it would make the file describe a statement nobody executed. Same rule
-- 0013 was written under.
--
-- WHY THE COLUMN EXISTS AT ALL. `/api/bazi/work` has no "unknown hour" mode — measured 2026-09-02 by
-- firing the real endpoint: an omitted `birthTime` is a 400 ("expected string, received undefined") and
-- `''` is a 400 ("too_small"). Its sibling `/api/bazi/pair-match` DOES have one: the key is optional,
-- the route substitutes noon, and the response carries `timeKnown` (pair-match/route.ts:41,119,159).
-- So the BFF substitutes the same noon and must carry the flag itself.
--
-- 🔴 AND IT MUST BE STORED, NOT RE-DERIVED. Reading `member_with_friend.time` at display time would
-- answer "does this person have an hour TODAY", not "did we know it when this reading was computed". A
-- friend who fills in their birth hour next week would silently relabel every old reading as exact.
--
-- SAFETY. One ADD COLUMN IF NOT EXISTS with a DEFAULT on a table created hours ago that holds no rows in
-- production. No rewrite, no backfill of anything anyone has read. Re-running it is a no-op.
--
-- DEFAULT true is the conservative choice for rows written between 0014 and this file: on prod there are
-- none (verified: zero rows), and on any dev box such a row predates the flag entirely, so marking it
-- "hour known" keeps it out of the "we guessed" bucket it was never in.

ALTER TABLE "work_comparison_candidate"
    ADD COLUMN IF NOT EXISTS "time_known" boolean NOT NULL DEFAULT true;
