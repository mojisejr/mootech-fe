"use client";
import ScreenLoading from '@/components/screen-loading';
import Menu from '@/components/menu';
import { CONFIG } from '@/constants/config';
import { CookieKey } from '@/constants/cookie-key';
import { CreditCardChannel } from '@/constants/creditcard-channel';
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


export default function PaymentPage() {

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


  const [email, setEmail] = useState<any>('')


  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)


  const [channelSelected, setChannelSelected] = useState<string>(CreditCardChannel.CREDIT_CARD)


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

    setAccountName(cookies[CookieKey.MEMBER_NAME])

    setPaymentPlan(cookies[CookieKey.PAYMENT_PLAN])
    setPaymentPackage(cookies[CookieKey.PAYMENT_PACKAGE])
    setPaymentPackageName(cookies[CookieKey.PAYMENT_PACKAGE_NAME])
    setPaymentAmount(cookies[CookieKey.PAYMENT_AMOUNT])
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


const [emailError, setEmailError] = useState("")

const validateEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const onChangeEmail = (event: any) => {
  const value = event.target.value

  setEmail(value)
}

  

    const onSubmit = () => {
      if (email != '') {

  if (!validateEmail(email)) {
    setEmailError("Email รูปแบบไม่ถูกต้อง")
    return
  }

             setCookie(CookieKey.PAYMENT_EMAIL, email, {
                path: '/',
                maxAge: CONFIG.EXPIRED_TIME_COOKIE,
                sameSite: true,
              })
        if (channelSelected == CreditCardChannel.CREDIT_CARD) {
          router.push(PageRouter.PAYMENT_VIA_CREDIT_CARD)
        } else {
          router.push(PageRouter.PAYMENT_VIA_QRCODE_SCAN)
        }
      }
    }



  return (
    <div 

    className="w-full bg-[#F2F7FD]  min-h-screen flex justify-center h-fit font-prompt">
      <Head>
        <title>Mumate</title>
      </Head>

      <div className="w-full block  flex-wrap">
        <div className='w-full relative'>
          <div className='w-full z-50 bg-[#1B9AAF] fixed top-0 left-0 h-[60px] flex items-center px-4 flex-nowrap'>
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
                src={displayImage ?displayImage :  '/images/mumate/ic_logo.svg'}
                width={40}
                height={40}
                className=' rounded-full cursor-pointer '
                alt='icon-app' />
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

        </div>

        <div className='w-full flex flex-wrap justify-center'>
            <div 
            className="flex bg-[#F2F7FD] justify-center  w-fit md:w-full  h-full flex-wrap mt-[60px] lg:mt-[60px]">
              <div className="w-full  lg:w-full  md:px-0 pt-[60px]  flex-wrap">
                <div className='w-full flex flex-wrap items-start'>
                    <div className="w-full flex-wrap">
                      <div className=" w-full">
                          <div className='w-full flex flex-wrap  px-[32px]'>

                              <div className='w-full flex flex-wrap'>
                                <div className='w-full flex flex-wrap'>
                                  <span className='w-full flex flex-wrap justify-center text-[#1B9AAF] text-center leading-10 text-[32px] font-semibold'>คำสั่งซื้อ</span>
                                </div>
                              </div>



                              {/* CARD COLUMN */}
                              <div className='w-full flex-wrap grid  grid-cols-1 md:grid-cols-1 gap-x-6 gap-y-10 md:gap-y-10 justify-center   py-[30px] '>
                          

                                  {/* CARD  */}
                                  <div className='w-full md:w-full lg:w-full h-fit   items-end flex flex-wrap '>


                                      <div 
                                      style={{
                                        'boxShadow': '0px 12px 40px 0px rgba(25, 33, 61, 0.05)'
                                      }}
                                      className=' w-full  bg-white flex flex-wrap py-4 px-8  rounded-[32px] '>

                                        <div className='w-full flex flex-wrap justify-left'>
                                          <span className='  text-[#1B9AAF] text-[24px]  font-semibold '>รายการ</span>

                                        </div>

                                  
                                        <div className='w-full flex flex-wrap py-4 mt-4 border-t border-b border-[#F2F7FD]'>

                                          <div className='w-full flex flex-nowrap'>

                                            <div className='w-full grow text-[#444444] text-[18px]'>{paymentPackageName}</div>
                                            <div className='w-fit flex-none text-[#444444] text-[18px]'>{paymentAmount}฿</div>

                                          </div>
                                        </div>


                                        <div className='w-full flex flex-nowrap my-4'>

                                            <div className='w-full font-bold grow text-[#1B9AAF] text-[18px]'>ราคารวม</div>
                                            <div className='w-fit  font-bold flex-none text-[#1B9AAF] text-[18px]'>{paymentAmount}฿</div>

                                          </div>
                                    </div>

                                  </div>

                                  {/* CARD  */}
                                  <div className='w-full md:w-full lg:w-full h-fit  items-end flex flex-wrap '>


                                      <div 
                                      style={{
                                        'boxShadow': '0px 12px 40px 0px rgba(25, 33, 61, 0.05)'
                                      }}
                                      className=' w-full  bg-white flex flex-wrap py-4 px-8  rounded-[32px] '>

                                        <div className='w-full flex flex-wrap justify-left'>
                                          <span className='  text-[#1B9AAF] text-[24px]  font-semibold '>ข้อมูลผู้สั่งซื้อ</span>

                                        </div>

                                  
                                        <div className='w-full flex flex-wrap py-4 mt-4 border-t  border-[#F2F7FD]'>

                                            <div className="w-full flex flex-wrap ">
                                              <div className="w-full flex flex-wrap">
                                                <span className="font-ibm font-medium text-[16px] text-moumate_black">
                                                  อีเมล
                                                </span>
                                                <span className="font-ibm font-medium text-[16px] text-moumate_red pl-1">
                                                  *
                                                </span>
                                              </div>
                                              <div className="w-full flex flex-wrap">
                                                <input
                                                  value={email}
                                                  onChange={(e) => { onChangeEmail(e) }}
                                                  className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                                                  type="text"
                                                />
                                              </div>
                                              {emailError && (
                                            <p className="text-red-500 text-sm mt-1">
                                              {emailError}
                                            </p>
                                              )}
                                            </div>

                                      
                                        </div>


                                    </div>

                                  </div>

                                  
                                {/* CARD  */}
                                  <div className='w-full md:w-full lg:w-full h-fit  items-end flex flex-wrap '>


                                      <div 
                                      style={{
                                        'boxShadow': '0px 12px 40px 0px rgba(25, 33, 61, 0.05)'
                                      }}
                                      className=' w-full  bg-white flex flex-wrap py-4 px-8  rounded-[32px] '>

                                        <div className='w-full flex flex-wrap justify-left'>
                                          <span className='  text-[#1B9AAF] text-[24px]  font-semibold '>วิธีการชำระเงิน</span>

                                        </div>

                                  
                                        <div 
                                        onClick={ () => { setChannelSelected(CreditCardChannel.CREDIT_CARD) }}
                                        className='w-full flex flex-wrap py-4 mt-4 border  border-[#F2F7FD] cursor-pointer  rounded-[10px] p-[6px]'>

                                            <div className="w-full flex flex-nowrap ">

                                              <div className='w-fit flex-none'>
                                                {
                                                  channelSelected == CreditCardChannel.CREDIT_CARD ?
                                                    <div className='w-[20px] h-[20px] border-[#C2C2C2] border rounded-full flex items-center justify-center'>
                                                      <div className='w-[14px] h-[14px] bg-[#1B9AAF] border-[#1B9AAF] border rounded-full'></div>
                                                    </div>
                                                  :

                                                    <div className='w-[20px] h-[20px] border-[#C2C2C2] border rounded-full flex items-center justify-center'>
                                                      
                                                    </div>
                                                }
                                              </div>
                                              <div className='w-full grow flex flex-wrap pl-2'>
                                                <span className='w-full text-[#444444] font-medium text-[16px]'>ชำระผ่านบัตรเครดิต/เดบิต</span>
                                                <div className='w-full flex flex-w mt-3'>
                                                  <Image
                                                    src={'/images/mumate/img_visa.svg'}
                                                    width={210}
                                                    height={32}
                                                    alt='visa'
                                                  />

                                                </div>
                                              </div>
                                              
                                            
                                            </div>

                                      
                                        </div>

                                                        
                                        <div
                                        onClick={ () => { setChannelSelected(CreditCardChannel.PROMPTPAY) }}
                                        className='w-full flex flex-wrap py-4 mt-4 border  border-[#F2F7FD]  cursor-pointer rounded-[10px] p-[6px]'>

                                            <div 
                                            className="w-full flex flex-nowrap ">

                                              <div className='w-fit flex-none'>
                                                {
                                                  channelSelected == CreditCardChannel.PROMPTPAY ?
                                                    <div className='w-[20px] h-[20px] border-[#C2C2C2] border rounded-full flex items-center justify-center'>
                                                      <div className='w-[14px] h-[14px] bg-[#1B9AAF] border-[#1B9AAF] border rounded-full'></div>
                                                    </div>
                                                  :

                                                    <div className='w-[20px] h-[20px] border-[#C2C2C2] border rounded-full flex items-center justify-center'>
                                                      
                                                    </div>
                                                }
                                              </div>
                                              <div className='w-full grow flex flex-wrap pl-2'>
                                                <span className='w-full text-[#444444] font-medium text-[16px]'>ชำระด้วย PromptPay (QR Code)</span>
                                                <div className='w-full flex flex-w mt-3'>
                                                  <Image
                                                    src={'/images/mumate/img_promtpay.svg'}
                                                    width={95}
                                                    height={32}
                                                    alt='promtpay'
                                                  />

                                                </div>
                                              </div>
                                              
                                            
                                            </div>

                                      
                                        </div>



                                    </div>

                                  </div>

                                                            <div className='w-full flex  justify-center flex-wrap mt-4'>
                                                        
                                                              <div 
                                                              
                                                              onClick={() => { onSubmit() }}
                                                              className={
                                                                (email != '' ? ' bg-[#1B9AAF]  text-white cursor-pointer ' : ' bg-gray-200 text-gray-500 ') +
                                                                ' w-full md:w-[400px] py-4 px-4 items-center flex flex-nowrap   rounded-[40px]'}>
                                  
                                                                <div className='w-full justify-center grow flex flex-wrap'>
                                  
                                                                  <span className='w-full flex justify-start font-bold text-lg'>ถัดไป</span>
                                  
                                                                </div>
                                  
                                                                <div className='w-fit flex flex-nowrap'>
                                                                  <Image
                                                                    src={'/images/icons/ic_arrow_next_white.svg'}
                                                                    width={40}
                                                                    height={40}
                                                                    alt='icon-next'
                                                                  />
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
      
      
                          <div className='w-full flex  flex-wrap bg-[#1B9AAF]'>
                            <span className='w-full text-white text-[18px] font-medium py-[120px] flex justify-center'>© MOOTECH DESTINY CO., LTD.</span>
                          </div>
                          
                          
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
