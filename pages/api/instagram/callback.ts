import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const code = (req.query.code as string) ?? "";
    if (!code) return res.status(400).json({ error: "Missing code" });

    const clientId = process.env.IG_CLIENT_ID!;
    const clientSecret = process.env.IG_CLIENT_SECRET!;
    const redirectUri = process.env.IG_REDIRECT_URI!; // ex: http://localhost:3000/api/instagram/callback

    // 1) exchange code -> token
    const tokenRes = await fetch(
      "https://api.instagram.com/oauth/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        }),
      }
    );

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      return res
        .status(tokenRes.status)
        .json({ error: "token exchange failed", detail: txt });
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return res.status(500).json({ error: "no access_token", tokenJson });
    }

    // 2) fetch profile
    const fields = "user_id,username,profile_picture_url,name,account_type";
    const meUrl = `https://graph.instagram.com/v23.0/me?fields=${encodeURIComponent(
      fields
    )}&access_token=${encodeURIComponent(tokenJson.access_token)}`;
    const meRes = await fetch(meUrl);
    const profile = await meRes.json();

    return res.status(200).json({ token: tokenJson, profile });
  } catch (e: any) {
    return res
      .status(500)
      .json({ error: "Unhandled error", detail: e?.message });
  }
}
