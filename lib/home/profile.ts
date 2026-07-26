// Pure (React-free) header-profile derivation so the กติกา-ค upgrade-badge rule is unit-testable and
// anchorable — same reason toComputeSource lives in a pure module. useV2Home derives this from the single
// user fetch and hands `profile` to Lamun's header. The rule MUST match v1 `header-v2.tsx` exactly (the
// two versions must never disagree about whether a member has paid).
export type HomeProfile = { pictureUrl: string | null; showUpgrade: boolean }

type ProfileSource = {
  picture_url?: string | null
  payment?: { is_not_expired?: boolean | null } | null
} | null

// กติกา ค (ฟีมเคาะ): hide the upgrade badge ONLY for a paid member whose plan is still valid
// (`payment.is_not_expired === true`). Everyone else — free, expired, no payment row, or no user yet —
// SHOWS the badge. Strict `=== true` (not truthy) so a stray non-boolean can never silently hide it.
// Avatar: real `picture_url` else null (Lamun falls back to the first-letter tile).
export function deriveHomeProfile(user: ProfileSource): HomeProfile {
  return {
    pictureUrl: (user?.picture_url && String(user.picture_url)) || null,
    showUpgrade: !(user?.payment?.is_not_expired === true),
  }
}
