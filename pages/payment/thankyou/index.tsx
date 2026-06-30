"use client";
import ScreenLoading from '@/components/screen-loading';
import HeaderMuMate from '@/components/header-v2';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from 'react-cookie';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useHasMounted } from '@/lib/hooks/use-has-mounted';
import { shouldRenderScreenLoading } from '@/lib/auth/render-gate';


export default function PaymentThankyouPage() {

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
    CookieKey.REFCODE_FGF,
    CookieKey.LOGIN_PROVIDER,
    CookieKey.PAYMENT_PLAN,
    CookieKey.PAYMENT_PACKAGE,
    CookieKey.PAYMENT_PACKAGE_NAME,
    CookieKey.PAYMENT_AMOUNT,
    CookieKey.PAYMENT_EMAIL,
  ])



  const [seconds, setSeconds] = useState<number>(330)

  const [isLogin, setIsLogin] = useState<boolean>(false)

  const router = useRouter();
  const callback = router.query.callback as string || '/';
  const { data: session, status } = useSession();
  const { userId: authUserId, status: authStatus } = useCurrentUser();
  const hasMounted = useHasMounted();

  const [userId, setUserId] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')
  const [displaySurname, setDisplaySurname] = useState<string>('')
  const [displayImage, setDisplayImage] = useState<string>('')
  const [accountName, setAccountName] = useState<string>('')

 
        const fallback = '/images/mumate/ic_avatar.svg' 
    const [imgSrc, setImgSrc] = useState(displayImage || fallback)

  const [email, setEmail] = useState<any>('')


  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)

  const [paymentPlan, setPaymentPlan] = useState<string>('')
  const [paymentPackage, setPaymentPackage] = useState<string>('')
  const [paymentPackageName, setPaymentPackageName] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [paymentEmail, setPaymentEmail] = useState<string>('')



  

  // Identity guard: wait while id cookie hydrates, redirect only when truly anon.
  // #mootech-identity-guard-sweep
  useEffect(() => {
    if (authStatus === "anon") {
      router.replace(PageRouter.HOME)
    } else if (authStatus === "authed") {
      setIsLogin(true)
    }
  }, [authStatus]);



  useEffect(() => {
 const omiseKey = process.env.NEXT_PUBLIC_OMISE_KEY;

if (window?.Omise && omiseKey) {
  window.Omise.setPublicKey(omiseKey);
} else {
  console.error("Omise key not found");
}
  }, []);





    useEffect(() => {


  
    if (authStatus !== "authed") return

    setUserId(authUserId)

          // setDisplayName(dataName)
    setDisplaySurname(cookies[CookieKey.MEMBER_SURNAME])
    setDisplayImage(cookies[CookieKey.MEMBER_IMAGE])
    setImgSrc(cookies[CookieKey.MEMBER_IMAGE])
    setAccountName(cookies[CookieKey.MEMBER_NAME])

    setPaymentPlan(cookies[CookieKey.PAYMENT_PLAN])
    setPaymentPackage(cookies[CookieKey.PAYMENT_PACKAGE])
    setPaymentPackageName(cookies[CookieKey.PAYMENT_PACKAGE_NAME])
    setPaymentAmount(cookies[CookieKey.PAYMENT_AMOUNT])
    setPaymentEmail(cookies[CookieKey.PAYMENT_EMAIL])
  },  [
        authStatus, authUserId,
        cookies[CookieKey.PAYMENT_PLAN, CookieKey.PAYMENT_PACKAGE, CookieKey.PAYMENT_PACKAGE_NAME, CookieKey.PAYMENT_AMOUNT, CookieKey.PAYMENT_EMAIL]
      ]
  )

  // ✅ Loading — hold until identity resolves so we never flash/bounce
  if (shouldRenderScreenLoading(hasMounted, authStatus)) {
    return <ScreenLoading />;
  }


  const gotoLoginWith = () => {
    router.push(PageRouter.LOGIN_WITH)
  }
  

 
  const onSubmit = () => {
    router.replace(PageRouter.HOME)

  }


  return (
    <div 

    className="w-full bg-[#F2F7FD]  min-h-screen flex justify-center h-fit font-prompt">
      <Head>
        <title>Mumate</title>
      </Head>

      <div className="w-full block  flex-wrap">
        <div className='w-full flex flex-wrap'>
          <HeaderMuMate isShowMenu={isShowMenu} isLogin={isLogin} image={imgSrc}  />
        </div>


        <div className='w-full flex flex-wrap justify-center'>
            <div 
            className="flex bg-[#F2F7FD] justify-center  w-fit  md:w-full h-full flex-wrap mt-[60px] lg:mt-[60px]">
              <div className="w-full  lg:w-full   pt-[60px] flex-wrap">
                <div className='w-full flex flex-wrap items-start'>


                      <div className="w-full">
                          <div className="w-full flex-wrap px-[32px] md:px-0">
                            <div className="w-full flex-wrap">


                              <div className='w-full flex flex-wrap'>
                  
                                <div className='w-full flex flex-wrap'>

                                  <div className='w-full flex flex-wrap justify-center'>

                                    <Image
                                      src={'/images/mumate/ic_check_green.svg'}
                                      width={56}
                                      height={56}
                                      alt='icon-check'
                                    />

                                  </div>
                                  <span className='w-full flex flex-wrap justify-center text-[#6B7280] text-center  text-[18px] font-normal mt-6'>ชำระสำเร็จเเล้ว</span>
                                  <span className='w-full flex flex-wrap justify-center text-[#1B9AAF] text-center leading-10 text-[28px]  mt-2 font-semibold'>ขอบคุณที่ให้ Mumate ดูเเล</span>


                          



                                
                                </div>



                              </div>



                            </div>

                            {/* CARD COLUMN */}
                            <div className='w-full  justify-center  flex-wrap flex gap-x-6  py-[30px] '>
                        


                                {/* CARD  */}
                                  <div 
                                    style={{
                                      'boxShadow': '0px 12px 40px 0px rgba(25, 33, 61, 0.05)'
                                    }}
                                    className=' cursor-pointer w-full md:w-[500px]  flex flex-wrap p-[16px]  rounded-[16px] bg-gradient-to-t from-[#D6FFC2] to-[#BEEEFC]'>


                                

                                  <div 
                                    onClick={() => { router.replace(PageRouter.FORTUNE_STICK)}}
                                    className=' cursor-pointer w-full  flex flex-wrap mb-4'>

                                      <div className='w-full flex flex-nowrap bg-white rounded-[8px] p-[16px]'>

                                        <div className='w-full grow flex flex-wrap items-center '>

                                          <Image
                                            src={'/images/mumate/thx_1.png'}
                                            height={32}
                                            width={32}
                                            alt='icon-thx'
                                          />
                                          <div className='w-fit flex-wrap  pl-3'>

                                              <span className=' font-bold text-[#1B9AAF] text-[18px]'>
                                                เสี่ยงเซียมซีเดี๋ยวนี้
                                              </span>

                                          </div>

                                        </div>


                                        <div className='w-fit flex-none flex flex-wrap items-center '>

                                            <Image
                                              src={'/images/mumate/grommet-icons_link-next.png'}
                                              height={18}
                                              width={18}
                                              alt='icon-thx'
                                            />
                                        </div>

                                      </div>


                                  </div>


                                  <div 
                                    onClick={() => { router.replace(PageRouter.RESULT)}}
                                    className=' cursor-pointer w-full  flex flex-wrap mb-4'>

                                      <div className='w-full flex flex-nowrap bg-white rounded-[8px] p-[16px]'>

                                        <div className='w-full grow flex flex-wrap items-center '>

                                          <Image
                                            src={'/images/mumate/thx_2.png'}
                                            height={32}
                                            width={32}
                                            alt='icon-thx'
                                          />
                                          <div className='w-fit flex-wrap pl-3 '>

                                              <span className=' font-bold text-[#1B9AAF] text-[18px]'>
                                                ถามดวงกับ AI
                                              </span>

                                          </div>

                                        </div>


                                        <div className='w-fit flex-none flex flex-wrap items-center '>

                                            <Image
                                              src={'/images/mumate/grommet-icons_link-next.png'}
                                              height={18}
                                              width={18}
                                              alt='icon-thx'
                                            />
                                        </div>

                                      </div>


                                  </div>


                                  <div 
                                    onClick={() => { router.replace(PageRouter.MATCHING)}}
                                    className=' cursor-pointer w-full  flex flex-wrap mb-4'>

                                      <div className='w-full flex flex-nowrap bg-white rounded-[8px] p-[16px]'>

                                        <div className='w-full grow flex flex-wrap items-center '>

                                          <Image
                                            src={'/images/mumate/thx_3.png'}
                                            height={32}
                                            width={32}
                                            alt='icon-thx'
                                          />
                                          <div className='w-fit flex-wrap pl-3 '>

                                              <span className=' font-bold text-[#1B9AAF] text-[18px]'>
                                                เช็คดวงสมพงศ์
                                              </span>

                                          </div>

                                        </div>


                                        <div className='w-fit flex-none flex flex-wrap items-center '>

                                            <Image
                                              src={'/images/mumate/grommet-icons_link-next.png'}
                                              height={18}
                                              width={18}
                                              alt='icon-thx'
                                            />
                                        </div>

                                      </div>


                                  </div>



                                  <div 
                                    onClick={() => { router.replace(PageRouter.PACKAGE_HOROSCOPE)}}
                                    className=' cursor-pointer w-full  flex flex-wrap mb-4'>

                                      <div className='w-full flex flex-nowrap bg-white rounded-[8px] p-[16px]'>

                                        <div className='w-full grow flex flex-wrap items-center '>

                                          <Image
                                            src={'/images/mumate/thx_4.png'}
                                            height={32}
                                            width={32}
                                            alt='icon-thx'
                                          />
                                          <div className='w-fit flex-wrap pl-3 '>

                                              <span className=' font-bold text-[#1B9AAF] text-[18px]'>
                                                ดูดวงกับ ซินแส
                                              </span>

                                          </div>

                                        </div>


                                        <div className='w-fit flex-none flex flex-wrap items-center '>

                                            <Image
                                              src={'/images/mumate/grommet-icons_link-next.png'}
                                              height={18}
                                              width={18}
                                              alt='icon-thx'
                                            />
                                        </div>

                                      </div>


                                  </div>

                                </div>




                            
                            </div>
                          </div>

                       
                                                
                          
                          {/* overlay */}
                          <div className="relative md:hidden z-10 h-[45px]
                            bg-[linear-gradient(to_bottom,#F2F7FD_50%,#1B9AAF_50%)]
                            -mt-[0px] -mb-[20px] w-full  flex items-center justify-center ">
                            <Image
                              fill
                              src='/images/mumate/ic_footer_white.svg'
                              alt='footer'
                            />
                          </div>
      
      
                          <div className='w-full flex flex-wrap bg-[#1B9AAF]'>
                            <span className='w-full text-white text-[18px] font-medium py-[120px] flex justify-center'>© MOOTECH DESTINY CO., LTD.</span>
                          </div>
                      </div>
                  </div>


                
              </div>
            </div>

       


        </div>

      </div>


    </div>
  );
}
