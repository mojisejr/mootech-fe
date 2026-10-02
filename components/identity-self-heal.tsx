import { useSelfHealIdentity } from "@/lib/auth/use-self-heal-identity";
import { useUnsealedMemberCheck } from "@/lib/auth/use-unsealed-member-check";

// Renders nothing. Mounts the global identity self-heal hook ONCE at the app root
// (#mumate-line-webview-oauth, Fix B) so any auth-gated page reached via deep-link
// (bypassing "/") recovers a missing MEMBER_ID instead of hanging on ScreenLoading.
// See lib/auth/use-self-heal-identity.ts for the full rationale.
// Also mounts the member check (hardening slice 1): a MEMBER_ID the server no longer accepts (no session
// and no seal, or left over from another account) is cleared once instead of being refused by every route.
export default function IdentitySelfHeal(): null {
  useSelfHealIdentity();
  useUnsealedMemberCheck();
  return null;
}
