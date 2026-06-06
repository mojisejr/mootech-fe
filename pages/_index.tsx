import Header from "@/components/header";
import { UserRegisterLine } from "@/constants/api/api-user-register-line";
import { CONFIG } from "@/constants/config";
import { CookieKey } from "@/constants/cookie-key";
import { PageRouter } from "@/constants/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from "react-cookie";

export default function HomePage() {

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
  ])

  const router = useRouter();
   const callback = router.query.callback as string || '/';



  const [isLogin, setIsLogin] = useState<boolean>(true)
  const [isCallApi, setIsCallApi] = useState<boolean>(false)
  
  const { data: session, status } = useSession();
  const [displayName, setDisplayName] = useState<string>('')
  const [displaySurname, setDisplaySurname] = useState<string>('')
  const [displayImage, setDisplayImage] = useState<string>('')
  const [resultCode, setResultCode] = useState<string>('')
  const [isRefreshResult, setIsRefreshResult] = useState<boolean>(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(PageRouter.LOGIN)
    }

    if (status === "authenticated") {
      if (isLogin) {

        setIsCallApi(true)
        setIsLogin(false)
      }
    }

  }, [status, session, isLogin]);


    useEffect(() => {
    if (isCallApi == true) {
      setIsCallApi(false)
      callRegister( session?.user?.name ?? '', session?.lineProfile?.sub, session?.user?.image ?? '', callback)
    }

  }, [isCallApi])
  
  
  useEffect(() => {


  
    const dataId = cookies[CookieKey.MEMBER_ID]
    const dataName = cookies[CookieKey.MEMBER_NAME]
    const dataSurName = cookies[CookieKey.MEMBER_SURNAME]
    const dataImage = cookies[CookieKey.MEMBER_IMAGE]

    if (dataId) {
 

      setDisplayName(dataName)
      setDisplaySurname(dataSurName)
      setDisplayImage(dataImage)
    }
    
  
  },  [
        cookies[CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME, CookieKey.MEMBER_SURNAME, CookieKey.MEMBER_IMAGE]
      ]
  )



  const callRegister = async (name: string, line_id: string, image: string, refer_code: string) => {
    const result = await UserRegisterLine(
        line_id, name, image, refer_code    
    )

    if (result && result.refer_code) {
        setCookie(CookieKey.MEMBER_ID, result.user_id, {
          path: '/',
          maxAge: CONFIG.EXPIRED_TIME_COOKIE,
          sameSite: true,
        })

        setCookie(CookieKey.MEMBER_NAME, result.name, {
          path: '/',
          maxAge: CONFIG.EXPIRED_TIME_COOKIE,
          sameSite: true,
        })

        setCookie(CookieKey.MEMBER_SURNAME, result.surname, {
          path: '/',
          maxAge: CONFIG.EXPIRED_TIME_COOKIE,
          sameSite: true,
        })

        setCookie(CookieKey.MEMBER_REFER_CODE, result.refer_code, {
          path: '/',
          maxAge: CONFIG.EXPIRED_TIME_COOKIE,
          sameSite: true,
        })

        setCookie(CookieKey.MEMBER_IMAGE, result.picture_url, {
          path: '/',
          maxAge: CONFIG.EXPIRED_TIME_COOKIE,
          sameSite: true,
        })

        // DEVELOP
        if (result.result_code && result.result_code  != '') {
          setIsRefreshResult(result.is_refresh)
          if (result.is_refresh == false) {
            setResultCode(result.result_code)
          } else {
            // CALL AGAIN
          }
        }

    } else {
      router.replace(PageRouter.LOGIN)
    }
  }

  const gotoWelcome = () => {
    if (resultCode && resultCode != '') {
        router.replace(PageRouter.RESULT.replaceAll(':code', resultCode))

    } else {
      if (isRefreshResult == false) {
        router.replace(PageRouter.WELCOME)
      } else {
        router.replace(PageRouter.WELCOME+'?refresh=1')

      }

    }
  }

  return (
    <div
    className='w-full bg-white min-h-screen  flex justify-center h-fit font-ibm'
    >

      <Head>
        <title>Mumate</title>
      </Head>

      <div className="w-full flex flex-wrap"> 
        <Header 
           displayImage={displayImage}
           displayName={displayName}
           displaySurname={displaySurname}
        />

          <div 
            className="w-full min-h-full bg-cover bg-center pt-[72px]"
            style={{ backgroundImage: "url('/images/mumate/img_bg_home.jpg')" }}>

            <div 
              className=" w-full flex flex-wrap justify-center items-center h-full "
            >


                <div className="w-full max-w-[888px] mx-[16px] lg:mx-0   backdrop-blur-sm bg-white/45 rounded-[32px] py-[32px] px-[24px] ">

                  <div className="w-full flex flex-wrap justify-center">
                    <span className="w-full text-center justify-center uppercase font-semibold flex  font-ibm text-[26px] md:text-[36px] text-moumate_blue">
                      ยินดีต้อนรับสู่ mumate✨
                    </span>
                    <span className="w-full  text-center justify-center flex font-normal font-ibm text-[20px] text-moumate_gray">
                      ที่ที่คำตอบทุกอย่างรออยู่
                    </span>

                    <span className="w-full mt-[12px] font-semibold  text-center justify-center flex  font-ibm text-[18px] text-moumate_black">
                      เตรียมตัวให้พร้อม! เราจะเปิดเผย
                    </span>


                    <div className=" w-full grid grid-cols-1 md:grid-cols-3 gap-[18px] mt-[12px]">

                      <div className="w-full flex   backdrop-blur-sm bg-white/45 flex-nowrap items-center rounded-[16px]  py-[12px] px-[4px] border">

                        <div className="flex-none  w-fit">
                          <Image
                            className=""
                            alt="mootech-icon"
                            src={'/images/mumate/ic_1.png'}
                            width={32}
                            height={32}
                          />
                        </div>
                        <span className="flex grow w-full text-moumate_black font-[16px] font-ibm pl-[8px]">
                          จุดแข็งที่คุณไม่รู้ตัว
                        </span>
                      </div>

                      <div className="w-full   backdrop-blur-sm bg-white/45 flex flex-nowrap items-center rounded-[16px]  py-[12px] px-[4px] border">

                        <div className="flex-none  w-fit">
                          <Image
                            className=""
                            alt="mootech-icon"
                            src={'/images/mumate/ic_2.png'}
                            width={32}
                            height={32}
                          />
                        </div>
                        <span className="flex grow w-full text-moumate_black font-[16px] font-ibm pl-[8px]">
                          โอกาสที่กำลังจะมา
                        </span>
                      </div>
 
                      <div className="w-full flex flex-nowrap   backdrop-blur-sm bg-white/45 items-center rounded-[16px] py-[12px] px-[4px] border">

                        <div className="flex-none  w-fit">
                          <Image
                            className="" 
                            alt="mootech-icon"
                            src={'/images/mumate/ic_3.png'}
                            width={32}
                            height={32}
                          />
                        </div>
                        <span className="flex grow w-full text-moumate_black font-[16px] font-ibm pl-[8px]">
                          ความรักที่รอคุณอยู่
                        </span>
                      </div>

                    </div>


                    <div className="w-full flex flex-wrap text-[18px] justify-center mt-[16px]">

                      <span className=" w-full md:w-fit flex justify-center font-bold font-ibm text-moumate_blue">
                        เพียง 2 นาที...
                      </span>
                      <span className=" w-full md:w-fit text-center flex justify-center font-ibm text-moumate_gray">
                        พร้อมผลลัพธ์ที่จะเปลี่ยนมุมมองของคุณ!
                      </span>
                    </div>


                    <button
                      onClick={() => { gotoWelcome() }}
                      className="w-full md:w-[200px] rounded-[16px] py-[16px] px-[16px] bg-moumate_blue mt-[24px] text-white justify-center"
                    >
                      มาเริ่มต้นกันเลยย
                    </button>
                  </div>

                </div>


            </div>
            
          </div>
      </div>

    
    
      
    </div>
  );
}
