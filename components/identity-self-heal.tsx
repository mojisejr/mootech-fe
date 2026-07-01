import { useSelfHealIdentity } from "@/lib/auth/use-self-heal-identity";

// Renders nothing. Mounts the global identity self-heal hook ONCE at the app root
// (#mumate-line-webview-oauth, Fix B) so any auth-gated page reached via deep-link
// (bypassing "/") recovers a missing MEMBER_ID instead of hanging on ScreenLoading.
// See lib/auth/use-self-heal-identity.ts for the full rationale.
export default function IdentitySelfHeal(): null {
  useSelfHealIdentity();
  return null;
}
