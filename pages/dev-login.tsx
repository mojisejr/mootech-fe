// DEV-ONLY login bypass page (no OAuth, no old server). Renders only when
// ENVIRONMENT=develop. Signs in via the "dev" CredentialsProvider (passes the
// useSession gate) AND sets the MEMBER_* cookies the app reads for backend calls.
// LOGIN_PROVIDER='DEV' tells index.tsx to skip the old-server register-or-login.
import { useState } from "react";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import { useCookies } from "react-cookie";
import { CookieKey } from "@/constants/cookie-key";

const SAMPLE_USERS = [
  { user_id: "07fb9a8b-8f71-4559-89fe-b5e5a0b62a6f", name: "เกวลิน" },
  { user_id: "2b247d09-a19a-4a3c-887f-c1f403d23394", name: "สุติมา" },
  { user_id: "2c0701a7-4ae7-481a-87d9-b7632d94adc0", name: "nisachon" },
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
    router.push("/");
  };

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "sans-serif", padding: 16 }}>
      <h2>🛠️ Dev Login (no OAuth)</h2>
      <p style={{ color: "#666" }}>
        Local testing only. Logs in as a real Supabase user without OAuth / the old server.
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
        <p style={{ fontWeight: 600 }}>Quick pick (real users w/ reading):</p>
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
