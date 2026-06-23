import HeaderMuMate from '@/components/header-v2';
import Menu from '@/components/menu';
import ModalEmail from '@/components/modal-email';
import ModalLoginSuccess from '@/components/modal-login-success';
import ScreenLoading from '@/components/screen-loading';
import { MemberWithFriendGetNewFriendApi } from '@/constants/api/api-member-with-friend-get-new-friend';
import { UserCheckLine } from '@/constants/api/api-user-check-line';
import { UserRegisterOrLogin } from '@/constants/api/api-user-register-or-login';
import { UserGetById } from '@/constants/api/api-user-get';
import { CONFIG } from '@/constants/config';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { shouldClearToken, shouldRegister } from '@/lib/auth/login-state';
import { signIn, signOut, useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useCookies } from 'react-cookie';


export default function HomePage() {

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
    CookieKey.REFCODE_FGF,
    CookieKey.LOGIN_PROVIDER
  ])


  const [isLogin, setIsLogin] = useState<boolean>(false)
  const [isRegistering, setIsRegistering] = useState<boolean>(false)
  // In-flight guard: idempotent register may re-evaluate on every authed render
  // tick — this ref prevents firing the network round-trip twice concurrently
  // (mirrors the promptpay/createSubmitGuard defensive pattern). Reset to false
  // when the round-trip settles so a later genuine cookie-wipe can re-register.
  const registerInFlightRef = useRef<boolean>(false)

  const router = useRouter();
  const callback = router.query.callback as string || '/';
  const { data: session, status } = useSession();


  const [isShowModalEmail, setIsShowModalEmail] = useState<boolean>(false)


  const [infoUserId, setInfoUserId] = useState<any>('')
  const [infoToken, setInfoToken] = useState<any>('')
  const [infoName, setInfoName] = useState<any>('')
  const [infoImage, setInfoImage] = useState<any>('')
  const [infoProvider, setInfoProvider] = useState<any>('')
  const [infoRefCode, setInfoRefCode] = useState<any>('')
  const [infoEmail, setInfoEmail] = useState<any>('')



  const [resultCode, setResultCode] = useState<string>('')
  const [isRefreshResult, setIsRefreshResult] = useState<boolean>(false)


  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)


  const fallback = '/images/mumate/ic_logo.svg'
  const [imgSrc, setImgSrc] = useState(infoImage || fallback)

  const [message, setMessage] = useState("");
  const [show, setShow] = useState(false);

  const showNotification = (text: string) => {
    setMessage(text);
    setShow(true);

    setTimeout(() => {
      setShow(false);
    }, 2500);
  };

  useEffect(() => {

    const data = cookies[CookieKey.LOGIN_PROVIDER]
    if (data) {
      setInfoProvider(data.toUpperCase())
    }

   const data2 = cookies[CookieKey.REFCODE_FGF]
    if (data) {
      setInfoRefCode(data2)
    }

  }, [ cookies[CookieKey.LOGIN_PROVIDER, CookieKey.REFCODE_FGF]])



  // useEffect(() => {

  //   if (callback) {
  //    setCookie(CookieKey.REFCODE_FGF, callback, {
  //       path: '/',
  //       maxAge: CONFIG.EXPIRED_TIME_COOKIE,
  //       sameSite: true,
  //     })
  //   }

  // }, [callback])

  const [isShowModalSuccess, setIsShowModalSuccess] = useState<boolean>(false)


  const clearToken = () => {
    removeCookie(CookieKey.MEMBER_ID)
    removeCookie(CookieKey.MEMBER_NAME)
    removeCookie(CookieKey.MEMBER_SURNAME)
    removeCookie(CookieKey.MEMBER_REFER_CODE)
    removeCookie(CookieKey.MEMBER_IMAGE)
    // removeCookie(CookieKey.REFCODE_FGF)
    removeCookie(CookieKey.LOGIN_PROVIDER)
  }

useEffect(() => {
  if (router.query.fromLogout === 'true') {
    // ถ้ามาจาก logout จริงๆ ค่อย clear
    clearToken()
    signOut({ redirect: false })
  }
}, [router.query])

  const getNotify = async (userId: any) => {
    const result = await MemberWithFriendGetNewFriendApi(userId)
    if (result && result.length > 0) {
      result.forEach((item: any, index: number) => {
        setTimeout(() => {
          showNotification(
            `🎉 ${item.name} ${item.surname} แอดคุณเป็นเพื่อนใหม่`
          );
        }, index * 3000);
      });
    }
  }

    const callApiRegister = async (
      id_token: any,
      image: any, 
      name: any,
      refer_code: any,
      email: any,
      provider: any,
    ) => {
      
    if(isRegistering == true) {
        setIsRegistering(false)
        const result = await UserRegisterOrLogin(
          id_token,
          image,
          name,
          refer_code,
          email,
          provider
        )
        if (result && result.ok == false) {
          // Explicit BE rejection (real auth failure) — safe to clear + sign out.
          registerInFlightRef.current = false
          clearToken()
          signOut({ redirect: false })

          return
        }
          if (result && result.user_id) {
            registerInFlightRef.current = false
              getNotify(result.user_id)
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
            // register-login returns the refer code as `ref_code`, but a BE edge
            // branch can return it null/empty. An empty MEMBER_REFER_CODE cookie
            // is what later bounced the logged-in user to /login?refresh=2 and
            // caused the loop. BACKFILL from get-user (UserGetById -> field
            // `refer_code`) so the cookie is reliably populated post-login.
            // (#mootech-login-loop-fix-v2)
            let referCode = result.ref_code
            if (!referCode || referCode === '') {
              try {
                const fetched = await UserGetById(result.user_id)
                if (fetched && fetched.refer_code) {
                  referCode = fetched.refer_code
                }
              } catch {
                // non-fatal: leave referCode as-is; never block login on backfill
              }
            }
            setCookie(CookieKey.MEMBER_REFER_CODE, referCode, {
              path: '/',
              maxAge: CONFIG.EXPIRED_TIME_COOKIE,
              sameSite: true,
            })

            setCookie(CookieKey.MEMBER_IMAGE, result.picture_url, {
              path: '/',
              maxAge: CONFIG.EXPIRED_TIME_COOKIE,
              sameSite: true,
            })

            setInfoImage(result.picture_url)
            setImgSrc(result.picture_url)
            // DEVELOP
            if (result.result_code && result.result_code  != '') {
              setIsRefreshResult(result.is_refresh)
              if (result.is_refresh == false) {
                setResultCode(result.result_code)
              } else {
                // CALL AGAIN
              }
            }
            setInfoUserId(result.user_id)

          } else {
            // Defensive: response present but NO user_id (should not happen per BE
            // logs). Do NOT clearToken or redirect-loop — release the in-flight
            // guard and let the idempotent authed effect retry on the next render
            // (MEMBER_ID still absent -> shouldRegister stays true). Never wipe.
            registerInFlightRef.current = false
          }
    }
    }
    

useEffect(() => {
  if (isRegistering) {
    callApiRegister(
      infoToken,
      infoImage, 
      infoName,
      infoRefCode,
      infoEmail,
      infoProvider

    )

  }

}, [isRegistering, infoToken, infoImage, infoName, infoRefCode, infoEmail, infoProvider])


  useEffect(() => {
    const hasMemberId = !!cookies[CookieKey.MEMBER_ID]

    if (status === "authenticated") {
      // DEV bypass: /dev-login already set MEMBER_ID cookie -> skip old-server register-or-login
      if (cookies[CookieKey.LOGIN_PROVIDER] === "DEV") {
        if (hasMemberId) {
          setIsLogin(true)
          setInfoUserId(cookies[CookieKey.MEMBER_ID])
        }
        return
      }

      // Already have a resolved identity -> nothing to do (avatar shows).
      if (hasMemberId) {
        setIsLogin(true)
        return
      }

      // IDEMPOTENT register: fire the round-trip whenever authenticated AND the
      // MEMBER_ID cookie is not present (first login OR after any wipe). The
      // in-flight ref prevents firing twice concurrently while the network call
      // is still pending.
      if (session && shouldRegister(status, hasMemberId) && !registerInFlightRef.current) {
        const user = session.user
        const lineProfile = session.lineProfile

        if (user) {
          registerInFlightRef.current = true
          if (lineProfile && lineProfile.sub) {
            setIsLogin(true)
            setInfoToken(lineProfile.sub)
            setInfoName(user?.name)
            setInfoImage(user.image)
            setImgSrc(user.image)
            setInfoProvider('LINE')
            // setInfoRefCode(callback.length > 5 ? callback : '')
            setInfoEmail('')
            setIsRegistering(true)
          } else {
            setIsLogin(true)
            // Use the STABLE per-provider id, not the short-lived OAuth access token.
            // Passing session.accessToken (ya29...) caused /api/user 400 + log_calculate
            // varchar(255) overflow. providerId = account.providerAccountId.
            setInfoToken(session.providerId)
            setInfoName(user?.name)
            setInfoImage(user.image)
            setImgSrc(user.image)
            setInfoProvider(session.provider ?? infoProvider)
            // setInfoRefCode(callback.length > 5 ? callback : '')
            setInfoEmail(user.email)
            setIsRegistering(true)
          }
        }
      }
    } else if (shouldClearToken(status)) {
      // ONLY on a genuine settled logout ("unauthenticated") — NEVER on the
      // "loading" tick. The loading-tick wipe is what raced the register
      // round-trip and caused the login loop.
      clearToken()
    }
  }, [status , session, callback, cookies[CookieKey.MEMBER_ID], cookies[CookieKey.LOGIN_PROVIDER]]);

 
  // ✅ Loading
  if (status === "loading") {
    return <ScreenLoading />;
  }

  const onCloseModalEmail = () => {
    setIsShowModalEmail(false)
  }
  const onSubmitModalEmail = (email: any) => {
    setIsShowModalEmail(false)

    callApiRegister(
      infoToken,
      infoImage, 
      infoName,
      infoRefCode,
      email,
      infoProvider

    )

  }


  const gotoWelcome = (resultCode: string, isRefreshResult: boolean) => {

    if (isLogin == false || infoUserId == '') {
        router.replace(PageRouter.LOGIN_WITH)
        return
    }

    
    if (resultCode && resultCode != '') {
        router.replace(PageRouter.RESULT.replaceAll(':code', resultCode))

    } else {
    
      if (isRefreshResult == false) {
        router.replace(PageRouter.REGISTER)
      } else {
        router.replace(PageRouter.REGISTER+'?refresh=1')

      }

    }
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
        {/* <div className='w-full relative'>
          <div className='w-full z-50  bg-[#1B9AAF] fixed top-0 left-0 h-[60px] flex items-center px-4 flex-nowrap'>
            <div className='w-fit flex flex-none'>
              <Image
                src={isShowMenu ? '/images/icons/x.svg' : '/images/mumate/ic_menu.svg'}
                width={32}
                height={32}
                onClick={() => { setIsShowMenu(!isShowMenu)}}
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
              {
                isLogin ? 
                <Image
                src={imgSrc}
                width={40}
                height={40}
                className=' rounded-full cursor-pointer '
                alt='icon-app' 
                onClick={() => { router.push(PageRouter.PROFILE)}}
                onError={() => setImgSrc(fallback)}
                
                />
                :

                <span
                  onClick={ () => { gotoLoginWith() }}
                  className=' text-white text-md cursor-pointer '
                >เข้าสู่ระบบ</span>
              }
            </div>


            
          </div>
          
          {
              isShowMenu ?
              <div className=' w-full flex flex-wrap absolute top-0 left-0  z-50 '>
                
                <Menu is_show={isShowMenu} />
              

              </div>
              :
              null
          }

        </div> */}
        <div className='w-full flex flex-wrap'>
          <HeaderMuMate isShowMenu={isShowMenu} isLogin={isLogin} image={imgSrc}  />
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
                    <div 
                    onClick={() => { gotoWelcome(resultCode, isRefreshResult) }}
                    className=' cursor-pointer w-full bg-white rounded-[40px] p-4 flex items-center flex-nowrap mt-[20px]'>

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

      {
        isShowModalEmail ?
          <ModalEmail 
            onClose={onCloseModalEmail}
            onSubmitOK={onSubmitModalEmail} 
            id_token={infoToken} 
            name={infoName} 
            image={infoImage} 
            refer_code={infoRefCode} 
            provider={infoProvider}      
          />
        :
          null
      }

      
      {message && (
        <div
          className={`
            fixed top-0 right-10 z-50 mt-12
            rounded-2xl
            bg-white
            border border-white/10
            px-5 py-4
            shadow-2xl
            backdrop-blur-md
            transition-all duration-1000
            ${
              show
                ? "translate-y-0 opacity-100"
                : "-translate-y-4 opacity-0"
            }
          `}
        >
          {message}
        </div>
      )}
    </div>
  );
}
