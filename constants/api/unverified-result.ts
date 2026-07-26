// #167 — honest return type for BE endpoints we CANNOT verify live because hitting them fires a real
// side effect on this stack: OTP/register send real SMS via 8x8, check-line calls LINE, calculate saves a
// chart, compatibility writes a log + burns a quota (#184 — the BE's outbound integrations are LIVE; only
// the DB is local). We refuse to fire them (real money / irreversible), so we cannot prove their response
// shape — and per "never claim what you can't prove," we must NOT author an accurate-looking type from a
// guess (that just repackages the old lie the `as RESPONSE_*` cast was).
//
// So these endpoints assert ONLY that the response is an object that MAY carry an `error`; every other
// field is `unknown`. A caller that ASSUMES a specific field type must narrow it — and where a caller was
// silently relying on the old (unverified) shape, tsc now surfaces that drift at the point of misuse,
// which is the whole point of closing this bug-class.
export type UnverifiedApiResult = { error?: unknown; [key: string]: unknown }
