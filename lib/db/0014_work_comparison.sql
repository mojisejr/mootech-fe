-- 0014 · work_comparison + work_comparison_candidate: storage for the colleague lane (mootech-fe#585)
-- HAND-AUTHORED per the DRIZZLE WORKFLOW CONTRACT (schema.ts header): reviewed, applied BY HAND.
-- NEVER run blind / via drizzle push.
--
-- 🔴 WHY NEW TABLES INSTEAD OF WRITING log_matching. That table is pair-shaped in its COLUMNS, not merely
-- by convention: name/dob/time/is_remember_time/gender describe the caller and your_name/your_dob/
-- your_time/your_is_remember_time/your_gender describe ONE friend, all NOT NULL (schema.ts:426-442).
-- A colleague run compares up to three people at once. Writing it there means picking one friend and
-- discarding the other two — literally, not as a figure of speech. ฟีม decided 2026-09-01: do not touch
-- the old table; store the new thing in new tables, and keep the relationship and the safety identical.
--
-- WHAT STAYS IDENTICAL TO THE OLD LANE
--   the join key   work_comparison.matching_id = user_matching.id, exactly the shape log_matching uses,
--                  so "one press = one matching_id" still holds
--   the quota      the meter row still goes into user_matching, and compat-quota.ts:46-52 counts every
--                  row in the month without filtering matching_type ⇒ it is counted with no change there
--   atomicity      the meter row, both rows below, the point deduction and log_activity all commit in
--                  ONE transaction under the same advisory lock (calculate-flow.ts:171-241)
--
-- SAFETY. Additive only: two CREATE TABLE IF NOT EXISTS and their indexes. No ALTER, no DROP, no data
-- movement, nothing that touches an existing table or column. Re-running it is a no-op.

CREATE TABLE IF NOT EXISTS "work_comparison" (
    "matching_id" varchar(36)  PRIMARY KEY NOT NULL,   -- = user_matching.id (1:1 with the meter row)
    "user_id"     text         NOT NULL,
    "result"      text         NOT NULL,               -- the TRIMMED comparison block, never the 7MB body
    "create_at"   varchar(255) NOT NULL
);

-- 1..3 rows per press. `slot` is the order the user typed them, NOT the rank — ranking lives in `result`
-- and must be read from comparison.ranking, never re-derived from this table (DoD: "แสดงอันดับจาก
-- comparison.ranking ❌ ไม่ใช่เรียงเอง").
CREATE TABLE IF NOT EXISTS "work_comparison_candidate" (
    "matching_id" varchar(36)      NOT NULL,
    "slot"        integer          NOT NULL,
    "friend_id"   text             NOT NULL,
    "rank_score"  double precision,
    CONSTRAINT "work_comparison_candidate_pkey" PRIMARY KEY ("matching_id", "slot")
);

CREATE INDEX IF NOT EXISTS "idx_work_comparison_user_id"
    ON "work_comparison" USING btree ("user_id" text_ops);

CREATE INDEX IF NOT EXISTS "idx_work_comparison_candidate_friend_id"
    ON "work_comparison_candidate" USING btree ("friend_id" text_ops);
