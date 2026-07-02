// Pure register-login param derivation (#mumate-line-webview-oauth, Fix B).
//
// Extracted from the home register-login effect (pages/index.tsx:337-366) so a
// GLOBAL self-heal can rebuild the SAME request a deep-link page needs when it
// lands authenticated-but-without-MEMBER_ID (having bypassed "/", the only page
// that mints it). React-free / API-free so it is unit-tested headless — see
// scripts/register-params.test.ts.
//
// Mirrors home EXACTLY: LINE uses lineProfile.sub as the id_token; other providers
// use the STABLE per-provider id (session.providerId = account.providerAccountId) —
// NEVER the short-lived OAuth access token (ya29...), which overflowed
// log_calculate. Returns null when the session is not usable (no user, or a
// non-LINE session whose stable id has not landed yet) so we never register with a
// missing/garbage id.
import type { Session } from "next-auth";

export interface RegisterParams {
  id_token: string;
  image: string;
  name: string;
  refer_code: string;
  email: string;
  provider: string;
}

export function buildRegisterParamsFromSession(
  session: Session | null | undefined,
): RegisterParams | null {
  const user = session?.user;
  if (!session || !user) {
    return null;
  }

  // LINE: the id_token is the LINE profile subject.
  const lineProfile = (session as any).lineProfile;
  if (lineProfile && lineProfile.sub) {
    return {
      id_token: lineProfile.sub,
      image: user.image ?? "",
      name: user.name ?? "",
      refer_code: "",
      email: "", // LINE does not return an email
      provider: "LINE",
    };
  }

  // Google / Facebook / Twitter: stable per-provider id.
  const providerId = (session as any).providerId;
  if (!providerId) {
    return null;
  }
  return {
    id_token: providerId,
    image: user.image ?? "",
    name: user.name ?? "",
    refer_code: "",
    email: user.email ?? "",
    provider: (session as any).provider ?? "",
  };
}
