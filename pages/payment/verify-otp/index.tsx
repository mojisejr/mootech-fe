"use client";
import Menu from '@/components/menu';
import ModalPayment from '@/components/modal-payment';
import ModalPaymentCreditCard from '@/components/modal-payment-creditcard';
import ModalPaymentPromptPay from '@/components/modal-payment-qrcode';
import { FortuneStickGet } from '@/constants/api/api-fortune-stick-get';
import { API } from '@/constants/api/endpoint';
import { CONFIG } from '@/constants/config';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { signOut, useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useCookies } from 'react-cookie';


export default function PaymentCreditCardVerifyOTPPage() {

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
    CookieKey.REFCODE_FGF,
    CookieKey.LOGIN_PROVIDER
  ])

  const [otp, setOtp] = useState<string[]>(Array(6).fill(''))
  const inputsRef = useRef<any[]>([])

  const [isLogin, setIsLogin] = useState<boolean>(false)

  const router = useRouter();
  const callback = router.query.callback as string || '/';
  const { data: session, status } = useSession();

  const [userId, setUserId] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')
  const [displaySurname, setDisplaySurname] = useState<string>('')
  const [displayImage, setDisplayImage] = useState<string>('')
  const [accountName, setAccountName] = useState<string>('')

  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)


  const [seconds, setSeconds] = useState(30)
  const [canResend, setCanResend] = useState(false)

  useEffect(() => {
  if (seconds <= 0) {
    setCanResend(true)
    return
  }

  const timer = setInterval(() => {
    setSeconds((prev) => prev - 1)
  }, 1000)

  return () => clearInterval(timer)
}, [seconds])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(PageRouter.HOME)
    } else {
      setIsLogin(true)
    }
  }, [status, session]);



  useEffect(() => {
    if (window?.Omise) {
      window.Omise.setPublicKey("pkey_5zlc86rc0y3bcea9eik");

    } else {

    }
  }, []);




    useEffect(() => {


  
    const dataId = cookies[CookieKey.MEMBER_ID]
    const dataName = cookies[CookieKey.MEMBER_NAME]
    const dataSurName = cookies[CookieKey.MEMBER_SURNAME]
    const dataImage = cookies[CookieKey.MEMBER_IMAGE]

    const dataReferCode = cookies[CookieKey.MEMBER_REFER_CODE]

    if (dataId) {
 
      setUserId(dataId)

            // setDisplayName(dataName)
      setDisplaySurname(dataSurName)
      setDisplayImage(dataImage)

      setAccountName(dataName)

    }
    
  
  },  [
        cookies[CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME, CookieKey.MEMBER_SURNAME, CookieKey.MEMBER_IMAGE, CookieKey.MEMBER_REFER_CODE]
      ]
  )

 
  // ✅ Loading
  if (status === "loading") {
    return <p>Loading...</p>;
  }


  const gotoLoginWith = () => {
    router.push(PageRouter.LOGIN_WITH)
  }


const handleChange = (value: string, index: number) => {
  if (!/^\d?$/.test(value)) return

  const newOtp = [...otp]
  newOtp[index] = value
  setOtp(newOtp)

  // auto focus next
  if (value && index < 5) {
    inputsRef.current[index + 1]?.focus()
  }
}
const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
  if (e.key === 'Backspace' && !otp[index] && index > 0) {
    inputsRef.current[index - 1]?.focus()
  }
}
const handlePaste = (e: React.ClipboardEvent) => {
  e.preventDefault()
  const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
  if (paste.length === 0) return

  const newOtp = paste.split('')
  setOtp([...newOtp, ...Array(6 - newOtp.length).fill('')])

  inputsRef.current[paste.length - 1]?.focus()
}

const onSubmit = () => {
  const otpCode = otp.join('') 
    router.replace(PageRouter.PAYMENT_THANKYOU)
}

const handleResend = () => {
  if (!canResend) return

  // 👉 call API resend OTP ที่นี่
  // await resendOtp()

  setSeconds(30)
  setCanResend(false)
}

const formatTime = (sec: number) => {
  return `0:${sec.toString().padStart(2, '0')}`
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
            className="flex bg-[#F2F7FD] justify-center  w-fit  h-full flex-wrap mt-[60px] lg:mt-[60px]">
              <div className="w-full  lg:w-full  md:px-0 pt-[60px]  md:pb-0 flex-wrap">
                <div className='w-full flex flex-wrap items-start'>
               
                      <div className=" w-full">
                        <div className="w-full flex-wrap">
                              <div className="w-full flex flex-wrap">
                                  <div className='w-full flex flex-wrap  px-[32px]'>

                                        <div className='w-full flex flex-wrap'>
                            
                                          <div className='w-full flex flex-wrap'>
                                            <span className='w-full flex flex-wrap justify-center text-[#1B9AAF] text-center leading-10 text-[32px] font-semibold'>User verification</span>
                                            <span className='w-full flex flex-wrap text-start text-[#6B7280] text-[16px] mt-4'>
                                              OTP has been sent to <span className=' font-bold text-black pl-2'>siri@gmail.com,</span>please fill in the OTP below
                                            </span>
                                          </div>



                                        </div>
                                  </div>



                                  {/* CARD COLUMN */}
                                  <div className="w-full lg:hidden grid grid-cols-6 gap-x-2 justify-center py-[30px] px-4">
                                      {otp.map((value, index) => (
                                        <div
                                          key={index}
                                          className="w-full h-[55px] border border-[#D9DFE6] rounded-[14px] bg-white flex justify-center items-center"
                                        >
                                          <input
                                            ref={(el) => {
                                              inputsRef.current[index] = el
                                            }}
                                            type="text"
                                            value={value}
                                            onChange={(e) => handleChange(e.target.value, index)}
                                            onKeyDown={(e) => handleKeyDown(e, index)}
                                            onPaste={handlePaste}
                                            inputMode="numeric"
                                            maxLength={1}
                                            autoComplete="one-time-code"
                                            className="w-full h-full text-[#1B9AAF] font-medium text-center text-[20px] outline-none bg-transparent"
                                          />
                                        </div>
                                      ))}
                                  </div>
                              </div>
                              <div 
                                className='w-full mt-[20px] justify-center flex flex-wrap px-4'>
                                                      
                                      <div
                                      onClick={ () =>  { onSubmit() }}
                                      className='w-full flex-none flex items-center'
                                      >
                                        <div 
                                        className='w-full  py-3 px-4 items-center flex flex-nowrap bg-[#1B9AAF] cursor-pointer rounded-[40px]'>
                
                                          <div className='w-full grow flex justify-center flex-wrap'>
                
                                            <span className={
                                              ' text-[#ffffff] justify-center font-bold text-lg'}>Confirm</span>
                
                                          </div>
                
                
                                        </div>
                                      </div>
                              </div>

                              <div
                              className='w-full flex flex-wrap mt-4 pb-[120px]'
                              >
                                <div className='w-full  justify-center items-center flex flex-wrap'>

                                  <Image
                                    src={'/images/mumate/timer.svg'}
                                    width={24}
                                    height={24}
                                    alt='timer'
                                  />

                                  <span className='ml-2 text-[14px] text-[#888888]'>{formatTime(seconds)}</span>
                                  
                                  <span 
                                  
                                  onClick={handleResend}
                                  className={
                                    (
                                    canResend ?
                                    ' text-[#1B9AAF] justify-center  cursor-pointer' :
                                    ' text-[#CFCFCF]  justify-center '
                                    
                                    ) + 
                                    ' ml-6 text-[14px]  font-medium '}>Resend OTP</span>

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
