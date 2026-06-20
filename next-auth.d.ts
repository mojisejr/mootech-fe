// types/next-auth.d.ts หรือ root/next-auth.d.ts
import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    idToken?: string;
    lineProfile?: any; // หรือกำหนด type ให้ละเอียดกว่านี้ถ้ารู้โครงสร้าง
    providerId?: string; // stable per-provider account id (account.providerAccountId)
    provider?: string; // login provider name (google | line | facebook | twitter | dev)
  }

  interface JWT {
    accessToken?: string;
    idToken?: string;
    lineProfile?: any;
    providerId?: string;
    provider?: string;
  }
}
