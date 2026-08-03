// Pure (React-free) header-profile derivation so the กติกา-ค upgrade-badge rule is unit-testable and
// anchorable — same reason toComputeSource lives in a pure module. useV2Home derives this from the single
// user fetch and hands `profile` to Lamun's header. The rule MUST match v1 `header-v2.tsx` exactly (the
// two versions must never disagree about whether a member has paid).
import { isPaidMember } from '@/lib/v2/tier'

export type HomeProfile = { pictureUrl: string | null; showUpgrade: boolean }

type ProfileSource = {
  picture_url?: string | null
  payment?: { is_not_expired?: boolean | null } | null
} | null

// กติกา ค (ฟีมเคาะ): hide the upgrade badge ONLY for a paid member whose plan is still valid. The paid
// test is the SINGLE shared rule (lib/v2/tier isPaidMember, strict `=== true`) so the header badge and the
// v2 tier gate can never disagree — showUpgrade is exactly its negation. Everyone else (free, expired, no
// payment row, no user) shows the badge. Avatar: real `picture_url` else null (Lamun's first-letter tile).
export function deriveHomeProfile(user: ProfileSource): HomeProfile {
  return {
    pictureUrl: (user?.picture_url && String(user.picture_url)) || null,
    showUpgrade: !isPaidMember(user),
  }
}
