import ModalLoginSuccess from '@/components/modal-login-success';
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
  if (router.query.fromLogout === 'true') {
    // ถ้ามาจาก logout จริงๆ ค่อย clear
    clearToken()
    signOut({ redirect: false })
  }
}, [router.query])

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(`/?callback=${callback}`);
    }
  }, [status]);

  const handleLogin = (provider: string) => {
    signIn(provider, { callbackUrl: `/auth/after/${provider}` });
  };


  // ✅ Loading
  if (status === "loading") {
    return <p>Loading...</p>;
  }


  const gotoLoginWith = () => {
    router.push(PageRouter.LOGIN_WITH)
  }

  return (
    <div 
    style={{
      background: 'linear-gradient(180deg, #1B9AAF 0%, #3A78A9 100%)'
    }}
    className="w-full  min-h-screen flex justify-center h-fit font-prompt">
      <Head>
        <title>Mumate</title>
      </Head>

      <div className="w-full flex flex-wrap">

        <div className='w-full z-50 fixed top-0 left-0 h-[60px] flex items-center px-4 flex-nowrap'>
          <div className='w-fit flex flex-none'>
            <Image
              src={'/images/mumate/ic_menu.svg'}
              width={32}
              height={32}
              className=' cursor-pointer '
              alt='icon-menu' />
          </div>

          <div className='w-full grow flex pl-4'>
            <Image
              src={'/images/mumate/ic_logo.svg'}
              width={103}
              height={24}
              alt='icon-app' />
          </div>

          <div className='w-fit flex  flex-none'>
            <span
              onClick={ () => { gotoLoginWith() }}
              className=' text-white text-md cursor-pointer'
            >เข้าสู่ระบบ</span>
          </div>


          
        </div>


        <div className="flex justify-center w-full flex-wrap mt-[60px]">
          <div className="w-full lg:w-[400px] flex items-center px-[32px] flex-wrap">
            <div className="w-full flex-wrap">


              <div className='w-full flex flex-wrap'>
                <div className='w-full flex justify-end'>
                  <Image
                    src={'/images/mumate/ic_sparkles.svg'}
                    width={37}
                    height={37}
                    alt='icon-sparkles' />
                </div>

                <div className='w-full flex flex-wrap'>
                  <span className='w-full flex flex-wrap justify-center text-white text-[32px] font-semibold'>Mumate ดูดวงแบบ</span>
                  <span className='w-full flex flex-wrap justify-center text-[#F3FCA2] text-[32px] font-semibold'>Personal Destiny</span>
                  <span className='w-full flex flex-wrap justify-center text-center text-white text-[16px]'>
                    AI อัจฉริยะ ดูดวงละเอียด การงาน เงิน ความรัก <br/>รู้ลึก รู้จริง ไม่ต้องรอคิว!
                  </span>
                </div>

                <div className='w-full flex flex-wrap mt-4'>

                  <div className='w-full relative'>
                    <div className=' cursor-pointer w-full bg-white rounded-[40px] p-4 flex items-center flex-nowrap mt-[20px]'>

                      <span
                        className=' text-[18px] font-bold text-[#1B9AAF] ml-[30px] flex grow w-full'
                      >เช็คพื้นดวงและธาตุของคุณ</span> 


                      <div className='w-fit  '>

                        <Image
                          src={'/images/mumate/ic_arrow_next.svg'}
                          width={46}
                          height={46}
                          alt='icon-next' />

                      </div>

                    </div>

                    <div className='w-fit z-40 absolute top-0 left-0 '>
                        <Image
                          src={'/images/mumate/ic_sparkles.svg'}
                          width={37}
                          height={37}
                          alt='icon-sparkles' />
                      </div>

                  </div>
                  
                </div>


              </div>



              {/* LINE Login */}
              <div className="w-full hidden justify-center">
                <div
                  onClick={() => { handleLogin('line') }}
                  className="cursor-pointer w-[237px] justify-center flex flex-wrap border rounded-[16px] bg-[#06C755]  py-[16px] px-[16px] mt-[24px]"
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

              {/* Google Login */}
              <div className="w-full hidden justify-center">
                <div
                  onClick={() => { handleLogin('google') }}
                  className="cursor-pointer w-[237px] justify-center flex flex-wrap border rounded-[16px] bg-[#ffffff]  py-[16px] px-[16px] mt-[24px]"
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

              {/* Facebook Login */}
              <div className="w-full hidden justify-center">
                <div
                  onClick={() => { handleLogin('facebook') }}
                  className="cursor-pointer w-[237px] justify-center flex flex-wrap border rounded-[16px] bg-[#ffffff]  py-[16px] px-[16px] mt-[24px]"
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
              </div>


              {/* Twitter Login */}
              <div className="w-full hidden justify-center">
                <div
                  onClick={() => { handleLogin('twitter') }}
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
                    ดำเนินการต่อด้วย X
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Responsive images */}
          <div className="w-fit flex lg:flex flex-wrap lg:items-center mb-[90px]">
            <div className="w-full flex lg:hidden items-end">
              <div className="flex md:hidden lg:hidden w-full">
                <Image
                  alt="mootech-icon"
                  src={"/images/mumate/img_footer_login.png"}
                  width={600}
                  height={240}
                />
              </div>

              <div className="hidden md:flex lg:hidden w-full">
                <Image
                  alt="mootech-icon"
                  src={"/images/mumate/img_footer_login.png"}
                  width={600}
                  height={240}
                />
              </div>
            </div>

            <div className="hidden lg:flex w-full h-fit">
              <Image
                alt="mootech-icon"
                src={"/images/mumate/img_footer_login.png"}
                width={322}
                height={420}
              />
            </div>
          </div>
        </div>


          <div className='flex md:hidden h-[60px] bg-[#1B9AAF] w-full fixed bottom-0 left-0'>

            <Image
            src={'/images/mumate/img_path_login.svg'}
            width={600}
            height={40}
            alt='path'
            />


          </div>

      </div>

      {
        isShowModalSuccess ? 
          <ModalLoginSuccess />
        :
          null
      }
      
      
    </div>
  );
}
