# lib/db/_archive — superseded drizzle artifacts (kept, not deleted)

Archived on 2026-06-25 during the drizzle snapshot re-baseline (#mootech-drizzle-rebaseline).

These files were the ORIGINAL introspected baseline whose snapshot had drifted from `schema.ts`
(the 7 log tables' `createAt` column was stale as `create_at`), which turned `drizzle-kit generate`
into a rename/drop data-loss trap. They are preserved here for history (Nothing-is-Deleted); the
live snapshot now lives in `lib/db/meta/` and matches `schema.ts` ≡ live DB.

| file | what it was |
|------|-------------|
| `0000_polite_venus.sql` | original introspected baseline DDL (stale `createat`) |
| `0001_add_user_id_indexes.sql` | hand-authored index migration (applied dev+prod; folded into the new baseline) |
| `meta/0000_snapshot.json` | stale snapshot that caused the generate conflict prompt |
| `meta/_journal.json` | old journal (knew only 0000) |

Do not run anything in here. Current truth: `lib/db/schema.ts` + `lib/db/meta/` + `lib/db/0000_baseline_current.sql` (reference-only).
