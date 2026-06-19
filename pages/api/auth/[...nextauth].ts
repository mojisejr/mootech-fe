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
  // กำหนด secret
  secret: process.env.NEXTAUTH_SECRET,
  // คุณสามารถกำหนดหน้าสำหรับ Sign in, Sign out, Error ได้
  pages: {
    signIn: "/login",
    signOut: "/signout",
    error: "/auth/error",
  },
};

export default NextAuth(authOptions);
