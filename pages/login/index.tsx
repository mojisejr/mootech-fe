import ScreenLoading from '@/components/screen-loading';
import HeaderMuMate from '@/components/header-v2';
import { CONFIG } from '@/constants/config';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { signIn, signOut, useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useCookies } from 'react-cookie';
export default function LoginPage() {

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
    CookieKey.REFCODE_FGF,
    CookieKey.LOGIN_PROVIDER,
  ])


  const [isShowOTP, setIsShowOTP] = useState<boolean>(false)
  const [isShowRegister, setIsShowRegister] = useState<boolean>(false)

  const [refCode, setRefCode] = useState<string>('')
  

  const router = useRouter();
  const callback = router.query.callback as string || '/';
  const { data: session, status } = useSession();
  const [tel, setTel] = useState<string>("");



  const [isShowModalSuccess, setIsShowModalSuccess] = useState<boolean>(false)

const hasSignedOut = useRef(false);
  const clearToken = () => {
    removeCookie(CookieKey.MEMBER_ID)
    removeCookie(CookieKey.MEMBER_NAME)
    removeCookie(CookieKey.MEMBER_SURNAME)
    removeCookie(CookieKey.MEMBER_REFER_CODE)
    removeCookie(CookieKey.MEMBER_IMAGE)
  }


useEffect(() => {
  if (callback) {
    setCookie(CookieKey.REFCODE_FGF, callback, {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })
  } else {
        setCookie(CookieKey.REFCODE_FGF, '', {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })
  }
}, [callback])



useEffect(() => {
  if (router.query.fromLogout === 'true') {
    clearToken()
    signOut({ redirect: false })
  }
}, [router.query])

  const handleLogin = (provider: string) => {

     setCookie(CookieKey.LOGIN_PROVIDER, provider, {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    if(provider==="instagram"){
      router.replace("https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=1513079686516451&redirect_uri=https://bazichart-dev.mumate.co/api/instagram/callback&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights")
    }else{
      signIn(provider, { callbackUrl: `/auth/after/${provider}` });
    }
  };


  // ✅ Loading
  if (status === "loading") {
    return <ScreenLoading />;
  }


  const onGotoBack = () => {
    router.replace(PageRouter.HOME)
  }


  return (
    <div
    className="w-full  min-h-screen flex justify-center h-fit font-prompt bg-[#F8FAFC]">
      <Head>
        <title>Mumate</title>
      </Head>

      <div className="w-full  flex-wrap">
        <div className='w-full flex flex-wrap'>
          <HeaderMuMate isShowMenu={false} isLogin={false} image={''} isShowProfile={false}  />
        </div>
        

        {/* <div className='w-full z-50 fixed top-0 left-0 h-[60px] flex items-center px-4 flex-nowrap'>
          <div className='w-fit flex flex-none'>
              <Image
                src={'/images/mumate/ic_arrow_prev.svg'}
                width={46}
                className=' cursor-pointer '
                height={46}
                onClick={ () => { onGotoBack() }}
                alt='icon-prev' />
          </div>


        </div> */}


        <div className="flex justify-center w-full flex-wrap mt-[60px] pt-[60px]">
          <div className="w-full lg:w-[400px] flex  px-[32px] flex-wrap">
            <div className="w-full flex-wrap">


              <div className='w-full flex flex-wrap'>
     
                <div className='w-full flex flex-wrap'>
                  <span className='w-full flex flex-wrap justify-center text-[#1B9AAF] text-[32px] font-semibold'>เข้าสู่ระบบ</span>
                </div>


              </div>




              {/* Google Login */}
              <div className="w-full flex justify-center">
                <div
                  onClick={() => { handleLogin('google') }}
                  className="cursor-pointer w-full justify-center flex flex-wrap border rounded-[16px] bg-[#ffffff]  py-[16px] px-[16px] mt-[24px]"
                >
                  <Image
                    className="rounded"
                    alt="mootech-icon"
                    src={"/images/mumate/ic_google.svg"}
                    width={24}
                    height={24}
                  />
                  <span className="text-black text-[14px] pl-4">
                    ดำเนินการต่อด้วย google
                  </span>
                </div>
              </div>


              {/* LINE Login (#mootech-ship-option1-deploy): re-enabled — uses LINE_CLIENT_ID/SECRET of the real LINE Login channel */}
              <div className="w-full flex justify-center">
                <div
                  onClick={() => { handleLogin('line') }}
                  className="cursor-pointer w-full justify-center flex flex-wrap border rounded-[16px] bg-[#06C755]  py-[16px] px-[16px] mt-[24px]"
                >
                  <Image
                    className="rounded"
                    alt="mootech-icon"
                    src={"/images/mumate/ic_line.svg"}
                    width={24}
                    height={24}
                  />
                  <span className="text-white text-[14px] pl-4">
                    ดำเนินการต่อด้วย Line
                  </span>
                </div>
              </div>

              {/* Facebook Login */}
              {/* <div className="w-full flex justify-center">
                <div
                  onClick={() => { handleLogin('facebook') }}
                  className="cursor-pointer w-full justify-center flex flex-wrap border rounded-[16px] bg-[#ffffff]  py-[16px] px-[16px] mt-[24px]"
                >
                  <Image
                    className="rounded"
                    alt="mootech-icon"
                    src={"/images/mumate/ic_fb.svg"}
                    width={24}
                    height={24}
                  />
                  <span className="text-black text-[14px] pl-4">
                    ดำเนินการต่อด้วย Facebook
                  </span>
                </div>
              </div> */}

              {/* Instagram Login */}
              {/* <div className="w-full flex justify-center">
                <div
                  onClick={() => { handleLogin('instagram') }}
                  className="cursor-pointer w-[237px] justify-center flex flex-wrap border rounded-[16px] bg-[#ffffff]  py-[16px] px-[16px] mt-[24px]"
                >
                  <Image
                    className="rounded"
                    alt="mootech-icon"
                    src={"/images/mumate/ic_x.svg"}
                    width={24}
                    height={24}
                  />
                  <span className="text-black text-[14px] pl-4">
                    ดำเนินการต่อด้วย instagram
                  </span>
                </div>
              </div> */}

              {/* Twitter Login */}
              {/* <div className="w-full flex justify-center">
                <div
                  onClick={() => { handleLogin('twitter') }}
                  className="cursor-pointer  w-full justify-center flex flex-wrap border rounded-[16px] bg-[#ffffff]  py-[16px] px-[16px] mt-[24px]"
                >
                  <Image
                    className="rounded"
                    alt="mootech-icon"
                    src={"/images/mumate/ic_x.svg"}
                    width={24}
                    height={24}
                  />
                  <span className="text-black text-[14px] pl-4">
                    ดำเนินการต่อด้วย X
                  </span>
                </div>
              </div> */}

            </div>
          </div>

        </div>



      </div>


      
    </div>
  );
}
