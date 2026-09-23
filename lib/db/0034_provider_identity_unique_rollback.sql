-- 0034 ROLLBACK · undo the STRUCTURE added by 0034_provider_identity_unique.sql.
--
-- 🔴 READ THIS FIRST. This file restores the schema, NOT the data. Steps 2 and 3 of
--    the forward migration DELETE rows, and no SQL here brings them back. The only
--    recovery is the output of forward STEP 0, which is why running step 0 and
--    keeping its output is not optional. Step 4's spelling change is reversible in
--    principle but is NOT reversed here: the pre-migration spelling of each row is
--    not recoverable from the row itself, and the normalised spelling is what the
--    live writers already produce, so reverting it would recreate the drift.
--
-- What this undoes: the unique index and the CHECK. That is enough to return the
-- table to a state where the legacy path and a rolled-back application both work.

DROP INDEX IF EXISTS user_provider_identity_unique;

ALTER TABLE user_provider DROP CONSTRAINT IF EXISTS user_provider_provider_not_blank;
