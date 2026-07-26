// DEV-ONLY login bypass page (no OAuth, no old server). Renders only when
// ENVIRONMENT=develop. Signs in via the "dev" CredentialsProvider (passes the
// useSession gate) AND sets the MEMBER_* cookies the app reads for backend calls.
// LOGIN_PROVIDER='DEV' tells index.tsx to skip the old-server register-or-login.
import { useState } from "react";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import { useCookies } from "react-cookie";
import { CookieKey } from "@/constants/cookie-key";

// ⚠️ TEST-DB users ONLY — these user_ids come from the LOCAL anonymized test DB (testenv/), NOT real
// people. Names/emails/phones in that DB are already scrubbed (testenv/scripts/anonymize.sql), so these
// are fake. Forward-fix of the old real-customer UUIDs that used to live here (private repo → no history
// rewrite; ฟีม's call). Chosen to cover /v2 edge cases. NEVER paste a real prod UUID here.
const SAMPLE_USERS = [
  { user_id: "5c7befb3-ebd3-4740-989e-fd6a1cca9662", name: "Dev · complete profile" }, // dob+time+gender+chart
  { user_id: "b54b765a-c01b-471f-bf7c-0c2a1a448bdd", name: "Dev · returning w/ fortune" }, // result_code + dob
  { user_id: "1b48125d-a68c-4682-a318-84f93f79baf9", name: "Dev · no birthdate (fallback)" }, // dob empty
];

export default function DevLogin() {
  const router = useRouter();
  const [, setCookie] = useCookies([
    CookieKey.MEMBER_ID,
    CookieKey.MEMBER_NAME,
    CookieKey.LOGIN_PROVIDER,
  ]);
  const [userId, setUserId] = useState(SAMPLE_USERS[0].user_id);
  const [name, setName] = useState(SAMPLE_USERS[0].name);
  const [busy, setBusy] = useState(false);

  if (process.env.NODE_ENV === "production") {
    return <p style={{ padding: 24 }}>Not available.</p>;
  }

  const doLogin = async () => {
    setBusy(true);
    const opts = { path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: true as const };
    setCookie(CookieKey.MEMBER_ID, userId, opts);
    setCookie(CookieKey.MEMBER_NAME, name, opts);
    setCookie(CookieKey.LOGIN_PROVIDER, "DEV", opts);
    await signIn("dev", { user_id: userId, name, redirect: false });
    // FULL reload (not router.push) so cookies are committed before any page's
    // useCookies reads them — avoids the my-destiny user_id=undefined race.
    await new Promise((r) => setTimeout(r, 300));
    window.location.href = "/";
  };

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "sans-serif", padding: 16 }}>
      <h2>🛠️ Dev Login (no OAuth)</h2>
      <p style={{ color: "#666" }}>
        Local testing only. Logs in as an ANONYMIZED test-DB user (no OAuth, no prod). testenv only.
      </p>
      <div style={{ margin: "12px 0" }}>
        <label>user_id</label>
        <input value={userId} onChange={(e) => setUserId(e.target.value)} style={{ width: "100%", padding: 8 }} />
      </div>
      <div style={{ margin: "12px 0" }}>
        <label>name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: 8 }} />
      </div>
      <button onClick={doLogin} disabled={busy} style={{ padding: "10px 18px", fontSize: 16 }}>
        {busy ? "..." : "Dev Login →"}
      </button>
      <div style={{ marginTop: 20 }}>
        <p style={{ fontWeight: 600 }}>Quick pick (anonymized test-DB users):</p>
        {SAMPLE_USERS.map((u) => (
          <button
            key={u.user_id}
            onClick={() => { setUserId(u.user_id); setName(u.name); }}
            style={{ display: "block", margin: "6px 0", padding: 6, textAlign: "left" }}
          >
            {u.name} — {u.user_id.slice(0, 8)}…
          </button>
        ))}
      </div>
    </div>
  );
}
