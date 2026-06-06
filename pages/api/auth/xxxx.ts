// import NextAuth from 'next-auth';
// import LineProvider from 'next-auth/providers/line';

// // ✅ Force NEXTAUTH_URL ที่นี่
// process.env.NEXTAUTH_URL = 'https://bazichart-dev.mumate.co';

// export default NextAuth({
//   providers: [
//     LineProvider({
//       clientId: '2007665208',
//       clientSecret: '7a1d728dabdf2a2d489b343b40d3aadb',
//       authorization: {
//         url: 'https://access.line.me/oauth2/v2.1/authorize',
//         params: {
//           scope: 'openid profile',
//           response_type: 'code',
//         },
//       },
//       token: 'https://api.line.me/oauth2/v2.1/token',
//       userinfo: 'https://api.line.me/v2/profile',
//       profile(profile) {
//         return {
//           id: profile.userId,
//           name: profile.displayName,
//           image: profile.pictureUrl,
//         };
//       },
//     }),
//   ],
//   secret: 'w+XwAKYVmp9a7b3Nv3F4jKt1gh2eLx56ByXwfPzL1Y8=',


//   callbacks: {
//   async redirect({ url, baseUrl }) {
  
//     return url.startsWith('/') ? `${baseUrl}${url}` : url;
//   },
// }

// });
import type { NextApiRequest, NextApiResponse } from 'next'
import NextAuth from 'next-auth'
process.env.NEXTAUTH_URL = 'https://bazichart-dev.mumate.co';
const options:any = {
  providers: [
    {
      id: 'line',
      name: 'Line',
      type: 'oauth',
      version: '2.0',
      scope: 'profile openid',
      params: {
        grant_type: 'authorization_code'
      },
      accessTokenUrl: 'https://api.line.me/oauth2/v2.1/token',
      authorizationUrl: 'https://access.line.me/oauth2/v2.1/authorize?response_type=code',
      profileUrl: 'https://api.line.me/v2/profile',
      openId: true,
      profile: (profile: any) => {
        return {
          id: profile.userId,
          name: profile.displayName,
          image: profile.pictureUrl
        }
      },
      clientId: '2007665208',
      clientSecret: '7a1d728dabdf2a2d489b343b40d3aadb',
    },
  ],
  secret: 'w+XwAKYVmp9a7b3Nv3F4jKt1gh2eLx56ByXwfPzL1Y8=',
  pages: {
    signIn: '/auth/signin', // << ใช้ custom หน้าแทน default ของ /api/auth/signin/*
  },
  callbacks: {
    async redirect({ url, baseUrl }: any) {
      return `${baseUrl}/line`; // success แล้วไปหน้าไหน
    },
  },
  
}


export default (req: NextApiRequest, res: NextApiResponse) => NextAuth(req, res, options)