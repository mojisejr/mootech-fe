import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { GetServerSideProps } from "next";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import { useCookies } from "react-cookie";
import { CookieKey } from "../../../constants/cookie-key";
import ScreenLoading from "@/components/screen-loading";

type AfterProviderPageProps = {
  sessionFromServer: Session | null;
};

export const getServerSideProps: GetServerSideProps<AfterProviderPageProps> = async (
  ctx,
) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const serializableSession = JSON.parse(JSON.stringify(session)) as Session;

  return {
    props: {
      sessionFromServer: serializableSession,
    },
  };
};

export default function AfterProviderPage({
  sessionFromServer,
}: AfterProviderPageProps) {
  const { query } = useRouter();
  const provider = String(query.provider || "");

  const { data: clientSession, status } = useSession();
  const session = clientSession ?? sessionFromServer;  


  const [cookies, setCookie, removeCookie] = useCookies([
    CookieKey.MEMBER_ID,
    CookieKey.MEMBER_NAME,
    CookieKey.MEMBER_SURNAME,
    CookieKey.MEMBER_REFER_CODE,
    CookieKey.MEMBER_IMAGE,
    CookieKey.MEMBER_EMAIL,
  ])

  const router = useRouter();
  // One-shot guard (#mootech-login-coldstart-fix). The effect deps used to
  // include the unstable `setCookie`/`session` identities, so this effect re-ran
  // and called `router.replace('/')` MULTIPLE times. Those repeated navigations
  // ("Abort fetching component for route: /") cancelled the in-flight
  // register-login on home -> identity landed late -> login appeared to need a
  // second attempt + the avatar briefly vanished. Fire the cookie-set + redirect
  // exactly ONCE per mount. (mirrors the defensive useRef single-fire pattern.)
  const didRedirectRef = useRef(false);
  useEffect(() => {
    if (session && !didRedirectRef.current) {
      didRedirectRef.current = true;
      const expireDate = new Date(session?.expires || new Date());
      // NOTE: do NOT set MEMBER_ID here. It used to be set to session.accessToken
      // (a short-lived OAuth token), which leaked into /api/user and log_calculate as a
      // bogus user_id (400 + varchar overflow). The single source of truth for MEMBER_ID is
      // the register-login step on "/" which sets it to the internal user_id. We only
      // pre-populate display fields (name/image/email) here.
      if(provider.toLocaleUpperCase() == "GOOGLE" || provider.toLocaleUpperCase() == "FACEBOOK"){
        setCookie(CookieKey.MEMBER_IMAGE,session?.user?.image , {path:"/", expires: expireDate})
        setCookie(CookieKey.MEMBER_NAME,session?.user?.name , {path:"/", expires: expireDate})
        setCookie(CookieKey.MEMBER_EMAIL,session?.user?.email , {path:"/", expires: expireDate})
      }

      if(provider.toLocaleUpperCase() == "LINE" || provider.toLocaleUpperCase() == "TWITTER"){
        setCookie(CookieKey.MEMBER_IMAGE,session?.user?.image , {path:"/", expires: expireDate})
        setCookie(CookieKey.MEMBER_NAME,session?.user?.name , {path:"/", expires: expireDate})
        setCookie(CookieKey.MEMBER_EMAIL,null , {path:"/", expires: expireDate}) // login LINE,TWITTER ไม่ได้อีเมล์
      }
      
      router.replace('/');
    }
    // Only re-evaluate when the session resolves; the ref guarantees a single
    // fire so unstable setCookie/router identities can no longer cause churn.
  }, [session]);

  // Transient page: sets cookies then redirects to "/". Show a clean loading
  // screen instead of dumping the raw session (which contains tokens) to the UI.
  return <ScreenLoading label="กำลังเข้าสู่ระบบ..." />;
}
