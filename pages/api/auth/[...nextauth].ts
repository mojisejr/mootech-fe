import type { NextAuthOptions } from "next-auth"; // Import type
import NextAuth from "next-auth";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import LineProvider from "next-auth/providers/line";
import TwitterProvider from "next-auth/providers/twitter";

export const authOptions: NextAuthOptions = {
  providers: [
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
