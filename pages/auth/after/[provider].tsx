import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { GetServerSideProps } from "next";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
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
  useEffect(() => {
    if (session) {
      const expireDate = new Date(session?.expires || new Date());
      if(provider.toLocaleUpperCase() == "GOOGLE" || provider.toLocaleUpperCase() == "FACEBOOK"){
        setCookie(CookieKey.MEMBER_ID, session?.accessToken || "", { path: "/", expires: expireDate })
        setCookie(CookieKey.MEMBER_IMAGE,session?.user?.image , {path:"/", expires: expireDate})
        setCookie(CookieKey.MEMBER_NAME,session?.user?.name , {path:"/", expires: expireDate})
        setCookie(CookieKey.MEMBER_EMAIL,session?.user?.email , {path:"/", expires: expireDate})
      }

      if(provider.toLocaleUpperCase() == "LINE" || provider.toLocaleUpperCase() == "TWITTER"){
        setCookie(CookieKey.MEMBER_ID, session?.accessToken || "", { path: "/", expires: expireDate })
        setCookie(CookieKey.MEMBER_IMAGE,session?.user?.image , {path:"/", expires: expireDate})
        setCookie(CookieKey.MEMBER_NAME,session?.user?.name , {path:"/", expires: expireDate})
        setCookie(CookieKey.MEMBER_EMAIL,null , {path:"/", expires: expireDate}) // login LINE,TWITTER ไม่ได้อีเมล์
      }
      
      router.replace('/');
    }
  }, [session, setCookie, router]);

  // Transient page: sets cookies then redirects to "/". Show a clean loading
  // screen instead of dumping the raw session (which contains tokens) to the UI.
  return <ScreenLoading label="กำลังเข้าสู่ระบบ..." />;
}
