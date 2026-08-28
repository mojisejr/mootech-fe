import withSerwistInit from "@serwist/next";

// PWA (mootech-fe#285 phase 1). Serwist replaces the unmaintained next-pwa (ฟีมเคาะ). It compiles
// sw.ts → public/sw.js at build time and injects the precache manifest.
//   • disable in dev: the SW would cache dev assets and fight HMR. Verify the SW via `next build &&
//     next start` (that is also the real ship path). `next dev` stays SW-free.
//   • register: false → we register in pages/_app.tsx ourselves (Pages Router, explicit control).
const withSerwist = withSerwistInit({
  swSrc: "sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  register: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  publicRuntimeConfig: {
    NEXT_STATIC_ENV: process.env.ENVIRONMENT,
    NEXT_STATIC_HOST: process.env.HOST,
    NEXT_STATIC_NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },
  images: {
    unoptimized: true,
    domains: [
      "cdn.phoenix-stark.com",
      "profile.line-scdn.net",
      "s3-ps-cdn.s3.ap-southeast-1.amazonaws.com",
      "down-th.img.susercontent.com",
      "lh3.googleusercontent.com",
      "pbs.twimg.com",
      "scontent.fbkk8-3.fna.fbcdn.net",
      "api.omise.co",
      "n8n.chatify.cloud"
    ],
  },
};

export default withSerwist(nextConfig);
