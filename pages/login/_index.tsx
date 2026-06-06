import ModalOTP from "@/components/modal-otp";
import ModalRegister from "@/components/modal-register";
import { OTPGet } from "@/constants/api/api-otp-get";
import { CONFIG } from "@/constants/config";
import { CookieKey } from '@/constants/cookie-key';
import { validateTel } from "@/utils/validate";
import { signIn, useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from 'react-cookie';

// 🔁 แทนที่ด้วย Router ของคุณ
const PageRouter = {
  RESULT: "/result/:code",
};

export default function LoginPage() {

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
  ])


  const [isShowOTP, setIsShowOTP] = useState<boolean>(false)
  const [isShowRegister, setIsShowRegister] = useState<boolean>(false)

  const [refCode, setRefCode] = useState<string>('')
  

  const router = useRouter();
  const callback = router.query.callback as string || '/';
  const { data: session, status } = useSession();
  const [tel, setTel] = useState<string>("");


  const clearToken = () => {
    removeCookie(CookieKey.MEMBER_ID)
    removeCookie(CookieKey.MEMBER_NAME)
    removeCookie(CookieKey.MEMBER_SURNAME)
    removeCookie(CookieKey.MEMBER_REFER_CODE)
  }

  useEffect(() => {
      clearToken(   )
  }, [])


  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/?callback='+callback);
    }
  }, [status, session]);

  const handleLogin = () => {
    signIn('line', { callbackUrl: "/auth/after/line" });
  };


  const onChangeTel = (event: any) => {
     if (event.target.value == '') {
      setTel('')
    }
    validateTel(event, setTel)

  };

  const isValid = () => tel !== "";

  const onSubmit = async () => {
    if (isValid()) {

      await callApiGetOtp()

    }
  };


  const onCloseOTP = () => {
    setIsShowOTP(false)

  }

  const onSuccessOTP = (is_new: boolean, user_id: string, name: string, surname: string, refer_code: string) => {
    setIsShowOTP(false)
    if (is_new == true) {
      setIsShowRegister(true)
    } else {
      // cookie

        setCookie(CookieKey.MEMBER_ID, user_id, {
          path: '/',
          maxAge: CONFIG.EXPIRED_TIME_COOKIE,
          sameSite: true,
        })

        setCookie(CookieKey.MEMBER_NAME, name, {
          path: '/',
          maxAge: CONFIG.EXPIRED_TIME_COOKIE,
          sameSite: true,
        })

        setCookie(CookieKey.MEMBER_SURNAME, surname, {
          path: '/',
          maxAge: CONFIG.EXPIRED_TIME_COOKIE,
          sameSite: true,
        })

        setCookie(CookieKey.MEMBER_REFER_CODE, refer_code, {
          path: '/',
          maxAge: CONFIG.EXPIRED_TIME_COOKIE,
          sameSite: true,
        })

          router.replace(PageRouter.RESULT.replaceAll(':code', callback))
    }
  }


  const onCloseRegister = () => {
    setIsShowRegister(false)
  }

  const onSuccessRegister = (user_id: string, name: string, surname: string, refer_code: string) => {
    setIsShowRegister(false)
    setCookie(CookieKey.MEMBER_ID, user_id, {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    setCookie(CookieKey.MEMBER_NAME, name, {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    setCookie(CookieKey.MEMBER_SURNAME, surname, {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    setCookie(CookieKey.MEMBER_REFER_CODE, refer_code, {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })
    router.replace(PageRouter.RESULT.replaceAll(':code', callback))
  }



  const callApiGetOtp = async () => {
    const result = await OTPGet(tel)
    if (result && result.ref_code) {
      setRefCode(result.ref_code);
      setIsShowOTP(true)
    }
  }

  // ✅ Loading
  if (status === "loading") {
    return <p>Loading...</p>;
  }



  return (
    <div 
    style={{
      background: 'linear-gradient(0deg, rgba(75, 150, 229, 0.05) 0%, rgba(251, 217, 226, 0.5) 132.05%)'
    }}
    className="w-full  min-h-screen flex justify-center h-fit font-prompt">
      <Head>
        <title>Mumate</title>
      </Head>

      <div className="w-full flex flex-wrap p-[24px]">
        <div className="flex justify-center w-full flex-wrap">
          <div className="w-full lg:w-[400px] flex items-center px-[32px] flex-wrap">
            <div className="w-full flex-wrap">
              {/* Logo */}
              <div className="flex justify-center w-full">
                <Image
                  className="rounded"
                  alt="mootech-icon"
                  src={"/images/mumate/ic_logo_app.svg"}
                  width={72}
                  height={72}
                />
              </div>

              <div className="flex justify-center w-full">
                <span className="hidden lg:flex w-fit text-center font-bold text-black text-[24px] md:text-[40px] font-ibm mt-4">
                  เข้าสู่ระบบ/<br />สมัครสมาชิก
                </span>
                <span className="flex lg:hidden w-fit text-center font-bold text-black text-[24px] md:text-[40px] font-ibm mt-4">
                  เข้าสู่ระบบ/สมัครสมาชิก
                </span>
              </div>

              {/* Tel input */}
              <div className="w-full flex flex-wrap mt-[24px]">
                <div className="w-full flex flex-wrap">
                  <span className="font-ibm font-medium text-[16px] text-moumate_black">
                    เบอร์โทรศัพท์
                  </span>
                  <span className="font-ibm font-medium text-[16px] text-moumate_red pl-1">
                    *
                  </span>
                </div>
                <div className="w-full flex flex-wrap">
                  <input
                    value={tel}
                    onChange={onChangeTel}
                    className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                    type="text"
                  />
                </div>
              </div>

              {/* ถัดไป */}
              <button
                disabled={!isValid()}
                onClick={onSubmit}
                className={
                  (isValid()
                    ? " bg-moumate_blue "
                    : " bg-gray-200 ") +
                  " w-full rounded-[16px] py-[16px] px-[16px] mt-[24px] text-white justify-center"
                }
              >
                ถัดไป
              </button>

              {/* Divider */}
              <div className="w-full flex flex-nowrap mt-[24px]">
                <div className="w-full flex flex-wrap grow items-center">
                  <div className="w-full flex flex-wrap border-b-bg_gray border-b"></div>
                </div>
                <div className="w-fit flex flex-none grow px-4">
                  <span>หรือ</span>
                </div>
                <div className="w-full flex flex-wrap grow items-center">
                  <div className="w-full flex flex-wrap border-b-bg_gray border-b"></div>
                </div>
              </div>

              {/* LINE Login */}
              <div
                onClick={() => { handleLogin() }}
                className="cursor-pointer w-full justify-center flex flex-wrap border rounded-[16px] border-border_gray py-[16px] px-[16px] mt-[24px]"
              >
                <Image
                  className="rounded"
                  alt="mootech-icon"
                  src={"/images/mumate/ic_line.svg"}
                  width={24}
                  height={24}
                />
                <span className="text-black text-[14px] pl-4">
                  ดำเนินการต่อด้วย Line
                </span>
              </div>
            </div>
          </div>

          {/* Responsive images */}
          <div className="w-fit flex flex-wrap">
            <div className="flex md:hidden lg:hidden w-full">
              <Image
                alt="mootech-icon"
                src={"/images/mumate/ic_login_mobile.png"}
                width={600}
                height={240}
              />
            </div>

            <div className="hidden md:flex lg:hidden w-full">
              <Image
                alt="mootech-icon"
                src={"/images/mumate/ic_login_mobile.png"}
                width={600}
                height={240}
              />
            </div>

            <div className="hidden lg:flex w-full">
              <Image
                alt="mootech-icon"
                src={"/images/mumate/ic_login.png"}
                width={322}
                height={448}
              />
            </div>
          </div>
        </div>
      </div>


      {
        isShowOTP ? 

      <ModalOTP 
          tel={tel}
          refCode={refCode}
          onClose={onCloseOTP}
          onSubmitOK={onSuccessOTP} />      
        :
        null
      }

      {
        isShowRegister ? 

          <ModalRegister 
            tel={tel}
            onSubmitOK={onSuccessRegister} 
            onClose={onCloseRegister} />
        :
        null
      }

      
      
    </div>
  );
}
