/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  publicRuntimeConfig: {
    NEXT_STATIC_ENV: process.env.ENVIRONMENT,
    NEXT_STATIC_HOST: process.env.HOST,
    NEXT_STATIC_NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXT_STATIC_OMISE_PUBLIC_KEY: process.env.OMISE_PUBLIC_KEY,
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

export default nextConfig;
