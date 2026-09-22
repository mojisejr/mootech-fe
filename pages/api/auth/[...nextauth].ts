import type { NextAuthOptions } from "next-auth"; // Import type
import NextAuth from "next-auth";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import LineProvider from "next-auth/providers/line";
import TwitterProvider from "next-auth/providers/twitter";
import CredentialsProvider from "next-auth/providers/credentials";

// DEV-ONLY login bypass (no OAuth, no old server). Active only under `next dev`
// (NODE_ENV !== production) — auto-disabled in any production build/deploy.
// Lets local testing pass the useSession gate; user_id flows via cookie (see /dev-login).
const isDev = process.env.NODE_ENV !== "production";

export const authOptions: NextAuthOptions = {
  providers: [
    ...(isDev
      ? [
          CredentialsProvider({
            id: "dev",
            name: "Dev Login (no OAuth)",
            credentials: {
              user_id: { label: "user_id", type: "text" },
              name: { label: "name", type: "text" },
            },
            async authorize(credentials) {
              if (!credentials?.user_id) return null;
              return {
                id: credentials.user_id,
                name: credentials.name || "Dev User",
                email: "",
              } as any;
            },
          }),
        ]
      : []),
    LineProvider({
      clientId: process.env.LINE_CLIENT_ID as string,
      clientSecret: process.env.LINE_CLIENT_SECRET as string,
      // 🔴 เอ็ม/Janjarat 2026-09-20 (error3.mp4): ต้นเหตุ "กด login แล้วเด้งกลับหน้า welcome ไม่ login" บน iPhone
      // คือ LINE "auto login" สลับไปเปิดแอป LINE (iOS ถาม "เปิดใน LINE?") ระหว่าง authorize → cookie jar เปลี่ยน
      // (Safari/LINE-webview → แอป LINE) → state/pkce cookie ที่ตั้งไว้ตอน authorize หาย → callback ไม่เจอ state →
      // next-auth ปฏิเสธ → เด้งกลับ signIn (จอดำแวบ→หน้า welcome). วิดีโอยืนยันครบ flow.
      // แก้: disable_ios_auto_login=true — ปิด "การสลับไปแอป LINE" เฉพาะ iOS (LINE docs) → ทำ OAuth จบใน browser
      // เดียว → state/pkce ไม่หาย → callback ผ่าน. ต่างจาก disable_auto_login (#728, กว้างทุกแพลตฟอร์ม บังคับหน้า
      // email/QR เมื่อไม่มี SSO — ผู้ใช้ปฏิเสธ) — ตัวนี้เจาะจง iOS และคง SSO ไว้ถ้ามี session LINE บนเว็บ.
      // คง checks default (state/pkce) ไว้ — LINE บังคับต้องมี state (บทเรียน #731/#735). scope คงเดิม.
      authorization: { params: { scope: "openid profile", disable_ios_auto_login: true } },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID as string,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
      authorization: "https://www.facebook.com/v19.0/dialog/oauth",
    }),
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID as string,
      clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
      version: "2.0", // ใช้ OAuth 2.0
      // authorization: { params: { scope: "openid profile offline.access" } },
    }),
  ],
  // Optional: กำหนด callbacks สำหรับการจัดการ token และ session
  callbacks: {
    async jwt({ token, account, profile }) {
      // account จะมี access_token และ id_token ที่ได้จากผู้ให้บริการ
      // profile จะมีข้อมูลจาก provider (ถ้า scope ขอไว้)
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token; // เก็บ id_token ถ้าคุณต้องการตรวจสอบ
        // Stable per-provider account id for EVERY provider (not the OAuth access token).
        // Google/FB/Twitter previously had no stable id, so the app fell back to the
        // short-lived access token (ya29...) as the user identifier -> /api/user 400 +
        // log_calculate varchar(255) overflow. providerAccountId is the stable fix.
        token.providerId = account.providerAccountId;
        token.provider = account.provider;
      }
      if (profile && account?.provider === "line") {
        // เก็บ profile จาก LINE ไว้ใน token เมื่อจำเป็น
        token.lineProfile = profile;
      }
      return token;
    },
    async session({ session, token }) {
      // ทำให้ accessToken และ idToken สามารถเข้าถึงได้ใน session
      session.accessToken = token.accessToken as string;
      session.idToken = token.idToken as string;
      session.lineProfile = token.lineProfile; // ส่ง profile ไปยัง session ด้วย
      session.providerId = token.providerId as string; // stable id for non-LINE lookups
      session.provider = token.provider as string;
      return session;
    },
  },
  // Session cookie SameSite=Lax (เอ็ม 2026-09-22 — login ล่มทุก provider ทั้ง LINE/Google + "เด้งเหมือนเดิม"):
  // 🔴 ย้อนจาก None → Lax. ของเดิม (1d2f0db 2026-09-12) ตั้ง None+Secure เพื่อแก้ iPad calendar getServerSession
  // เห็น no-identity — แต่ SameSite=None ถูก "webview ในแอป LINE + มือถือหลายตัว บล็อก/แยก partition" → หลัง
  // OAuth callback เซ็ต session-token (None) แล้ว webview ทิ้ง cookie → โหลดหน้า /v2 ถัดไปไม่เห็น session →
  // เด้งกลับ login (ทุก provider เพราะเป็น cookie session ร่วม ไม่ใช่ปัญหาราย provider). บนเบราว์เซอร์ปกติ None
  // ทำงานได้ (จึง reproduce ไม่เจอบน desktop). Lax = ค่า default ที่ webview รับได้ และ login เป็น same-origin
  // (Lax ส่ง cookie บน top-level nav รวมถึงเปิดจาก LINE). login ล่มทั้งระบบ >> เคส iPad calendar SSR (ถ้ากลับมา
  // ค่อยแก้ด้วย MEMBER_ID fallback #391 แทนการเปิด None ทั้งระบบ). แตะเฉพาะ session-token; คง __Secure- prefix
  // + secure ใน prod → ชื่อ cookie เดิม ผู้ที่ล็อกอินอยู่ไม่หลุด (แค่ attribute อัปเดตรอบ set ถัดไป).
  useSecureCookies: !isDev,
  cookies: {
    sessionToken: {
      name: `${!isDev ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: !isDev,
      },
    },
  },
  // กำหนด secret
  secret: process.env.NEXTAUTH_SECRET,
  // คุณสามารถกำหนดหน้าสำหรับ Sign in, Sign out, Error ได้
  pages: {
    // เอ็มพบ 2026-09-20: OAuth ที่พลาด (หรือ session ยังไม่ตั้ง) ถูก next-auth เด้งมาที่ pages.signIn —
    // เดิม "/login" (ดีไซน์ v1 เก่า) ทำให้ผู้ใช้ v2 "เด้งไปหน้า version เก่า". หลัง launch (/ → /v2) หน้า
    // login จริงคือ /v2/login → ชี้มาที่นี่ ผู้ใช้จึงอยู่ในดีไซน์ใหม่เสมอ (v2 gate เปิดแล้ว ไม่ loop).
    signIn: "/v2/login",
    signOut: "/signout",
    error: "/auth/error",
  },
};

export default NextAuth(authOptions);
