// The v2 first-run onboarded gate (#233). Called in useV2Home AFTER the user row has settled and its
// chart is confirmed: a charted user whose onboarded_at is empty has not finished first-run → route there.
//
// 🔴 CONTRACT DEPENDENCY: this reads onboarded_at off the GET /user response (pages/api/user.ts, raw
// SELECT *). If that endpoint ever returns a FIELD PROJECTION that omits the column, onboarded_at becomes
// undefined for everyone → needsFirstRun() returns true → even long-onboarded users get bounced into
// first-run (this is exactly the stale-fixture class that broke the home harness on #233). The test pins
// it: an onboarded row must NOT need first-run, and a row missing the field is treated as not-onboarded.
export function needsFirstRun(u: { onboarded_at?: string | null }): boolean {
  return !u.onboarded_at
}
