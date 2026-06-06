import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { GetServerSideProps } from "next";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useCookies } from "react-cookie";
import { CookieKey } from "../../../constants/cookie-key";

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
      console.debug(`session`,session)
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

  return (
    <main style={{ padding: 24 }}>
      <h1><b>{provider.toUpperCase()}</b> login success</h1>
      <p>หน้านี้รองรับทั้ง Google และ LINE</p>

      <section style={{ marginTop: 16 }}>
        <h2>Session status</h2>
        <p>สถานะปัจจุบัน: <code>{status}</code></p>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2>ข้อมูลใน session</h2>
        {session ? (
          <pre style={{ marginTop: 8 }}>
            {JSON.stringify(session, null, 2)}
          </pre>
        ) : (
          <p>ยังไม่พบข้อมูล session</p>
        )}
      </section>
    </main>
  );
}
