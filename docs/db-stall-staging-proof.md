# FE database stall proof

This proof covers bounded database waits and recovery of the FE pool. A timed-out
write or COMMIT has an **unknown outcome**: the facade must never replay it.
Only an explicitly side-effect-free call site may request a read retry.

## Discovered blocker: QI engine concurrency

The optional `scripts/db-stall-bazi-audit.test.ts` reads the exact deployed bazi
revision `366b9437e66511de09eccb49274c5877fff6513b` from a supplied local
`BAZI_SOURCE_ROOT`. It runs that revision's actual grant route and `applyLedger`
against two synthetic tables, substituting only the database connection and the
unrelated first-buy bonus. A barrier holds two completed idempotency reads so
both requests reach the write path concurrently.

Observed on disposable PostgreSQL 17.6: sequential duplicate requests credited
100 QI once, but two concurrent requests with the same charge reference both
returned 200, credited **200 QI**, and inserted **two ledger rows**. Both forensic
assertions passed; that means the existing defect was reproduced, not repaired.
The route checks the ledger before writing; wallet increment and ledger insert
are separate statements, without a unique purchase-reference constraint in the
pinned schema. The existing QI engine unit suite mocks the ledger and does not
prove this boundary.

The FE facade does not replay writes, and its money tests establish FE settlement
invariants. They do not establish safe concurrent QI repair at the actual engine.
Do not promote this evidence as end-to-end QI safety. Fixing the separate bazi
grant boundary and deciding its deployment scope requires an owner decision;
no bazi application change is part of this FE patch. Customer impact from the
pre-existing race has not been measured.

## Isolation before execution

- Use a disposable PostgreSQL database named `stall_proof`, reachable only over
  loopback in the proof environment. Set `DB_STALL_TEST_DATABASE_URL` and
  `DB_STALL_REQUIRE_DB=1`; the tests refuse other database names or non-loopback
  hosts. Keep the URL out of reports and tracked files.
- The database contains synthetic fixtures only. The socket proof creates marker
  tables; the money proof creates a unique schema with three synthetic payment
  tables. Dispose of the dedicated test environment afterward. No restored member
  database, production database, or shared staging schema is a test target.
- The money test stubs gateway transport, blocks global `fetch`, and models the QI
  engine's deduplication contract with an in-memory set. It tests the real FE
  settlement and reconciliation functions, **not** the engine's ledger or a real
  provider webhook delivery. Do not claim that distinction away.
- Do not run the old `payment-webhook-db`, `reconcile-cron-db`, or
  `beam-webhook-db` suites against restored staging: they rebuild payment tables
  and select existing member rows. They need their own disposable fixtures.

## Required evidence

Run the registered `db-resilient-sql`, `db-stall-pg`, and `db-stall-money` tests.
The opt-in database suites must actually run, not skip. Record their exit status
and assertions, without database URLs, SQL parameters, or customer data.

The evidence must establish:

1. A socket that stops answering produces a bounded error and retires its pool;
   a later read succeeds through a new pool. Concurrent stalls replace a generation
   once. Neither queued writes nor running writes are replayed.
2. When PostgreSQL commits but the proxy discards the COMMIT reply, the caller sees
   an unknown outcome and the committed marker/payment appears once.
3. A transaction callback resuming after its deadline cannot write through either
   its old handle or the replacement pool.
4. Concurrent webhook settlement and reconciliation produce one membership and
   one shadow record. A duplicate QI settlement calls the engine once. A lost
   QI COMMIT response leaves an approved payment without confirmation; the real
   FE QI repair loop can subsequently mark it confirmed using the same charge ref.
5. Ordinary errors, transaction rollback, savepoints, Drizzle values/parsers, and
   existing health behavior still pass their regression tests.

The synthetic fixture omits unrelated foreign keys and business scenarios; this
is evidence for the changed DB boundary and selected payment invariants, not a
claim that every checkout, refund, discount, or engine flow was exercised.

## Shared staging deployment

The infrastructure runbook `runbooks/05-staging-data.md` says staging uses a
restored member database and **live Beam credentials**. Its name does not make
payment actions safe. The deploy operator must verify the intended image, DB
binding, internal bazi destination, and scheduled-job configuration without
printing credentials before activating the candidate.

For the hosted smoke, use health and agreed synthetic/read-only paths. Do not
invoke checkout, refund, payment reconciliation, QI grant, notification, or provider
login actions with restored customer records. Do not cut the shared FE's network
or alter its DB to inject a fault: the TCP fault proof belongs in the isolated
disposable environment, which has no gateway credentials or customer data.

After deployment observe multiple healthy intervals, response latency, image SHA,
and bounded stall logs. A green probe alone is not proof of every authenticated
flow. Production release requires the owner's later decision after reviewing the
staging evidence; this document does not authorize it.
