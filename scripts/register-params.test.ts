// Deterministic unit tests for the pure register-login param builder
// (#mumate-line-webview-oauth, Fix B). React-free / API-free — mirrors the home
// register derivation (pages/index.tsx:337-366) so the global self-heal rebuilds
// the exact same request. Run: npx tsx scripts/register-params.test.ts
import assert from "node:assert/strict";
import { buildRegisterParamsFromSession } from "../lib/auth/register-params";

// Fake sessions cast to the augmented next-auth Session shape.
const s = (o: any) => o as any;

let pass = 0;
function t(name: string, fn: () => void) {
  try {
    fn();
    pass++;
  } catch (e: any) {
    console.error(`✗ ${name}\n  ${e?.message ?? e}`);
    process.exitCode = 1;
  }
}

// ── LINE: lineProfile.sub is the id_token, provider forced "LINE", empty email ──
t("LINE session -> lineProfile.sub id_token, provider LINE, empty email", () => {
  const p = buildRegisterParamsFromSession(
    s({ user: { name: "A", image: "img" }, lineProfile: { sub: "U123" }, provider: "line" }),
  );
  assert.deepEqual(p, {
    id_token: "U123",
    image: "img",
    name: "A",
    refer_code: "",
    email: "",
    provider: "LINE",
  });
});

// ── Google/others: STABLE providerId is the id_token (never the access token) ──
t("Google session -> providerId id_token, user email, provider from session", () => {
  const p = buildRegisterParamsFromSession(
    s({ user: { name: "B", image: "bimg", email: "b@x.com" }, providerId: "acc_1", provider: "google" }),
  );
  assert.deepEqual(p, {
    id_token: "acc_1",
    image: "bimg",
    name: "B",
    refer_code: "",
    email: "b@x.com",
    provider: "google",
  });
});

t("LINE takes precedence over providerId when lineProfile.sub is present", () => {
  const p = buildRegisterParamsFromSession(
    s({ user: { name: "C" }, lineProfile: { sub: "L" }, providerId: "acc", provider: "line" }),
  );
  assert.equal(p?.id_token, "L");
  assert.equal(p?.provider, "LINE");
});

// ── not-usable sessions -> null (never register with a missing id) ──
t("no user -> null", () => {
  assert.equal(buildRegisterParamsFromSession(s({ providerId: "x" })), null);
  assert.equal(buildRegisterParamsFromSession(null), null);
  assert.equal(buildRegisterParamsFromSession(undefined), null);
});

t("non-LINE without providerId -> null (no garbage id to the BE)", () => {
  assert.equal(buildRegisterParamsFromSession(s({ user: { name: "D" }, provider: "google" })), null);
});

t("missing image/name/email default to empty string", () => {
  const p = buildRegisterParamsFromSession(s({ user: {}, providerId: "id1", provider: "google" }));
  assert.equal(p?.image, "");
  assert.equal(p?.name, "");
  assert.equal(p?.email, "");
});

if (!process.exitCode) console.log(`✓ all ${pass} register-params assertions passed`);
else console.error(`\n${pass} passed, FAILURES above`);
