"use client";
import ScreenLoading from '@/components/screen-loading';
import Menu from '@/components/menu';
import { PaymentRetrieveApi } from '@/constants/api/api-payment-retrieve';
import { API } from '@/constants/api/endpoint';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from 'react-cookie';


export default function PaymentQRCodePage() {

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
    CookieKey.REFCODE_FGF,
    CookieKey.LOGIN_PROVIDER,
    CookieKey.PAYMENT_PACKAGE_NAME,
    CookieKey.PAYMENT_AMOUNT,
    CookieKey.PAYMENT_PACKAGE,
    CookieKey.PAYMENT_EMAIL
  ])



  const [seconds, setSeconds] = useState<number>(330)

  const [isLogin, setIsLogin] = useState<boolean>(false)

  const router = useRouter();
  const callback = router.query.callback as string || '/';
  const { data: session, status } = useSession();

  const [userId, setUserId] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')
  const [displaySurname, setDisplaySurname] = useState<string>('')
  const [displayImage, setDisplayImage] = useState<string>('')
  const [accountName, setAccountName] = useState<string>('')


  const [email, setEmail] = useState<any>('')


  const [fortuneInfo, setFortuneInfo] = useState<any>(null)

  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)

  const [qrUrl, setQrUrl] = useState<string>("");
  const [chargeId, setChargeId] = useState<string>("");


  const [paymentPackageName, setPaymentPackageName] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [paymentPackage, setPaymentPackage] = useState<string>('')

  

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(PageRouter.HOME)
    } else {
      setIsLogin(true)
    }
  }, [status, session]);

  useEffect(() => {
  if (!chargeId) return;
  if (seconds <= 0) return;

  const interval = setInterval(async () => {


    const data = await PaymentRetrieveApi(chargeId);

    if (data?.paid) {
      clearInterval(interval);
      router.push(PageRouter.PAYMENT_THANKYOU);
    }
  }, 3000);

  return () => clearInterval(interval);
}, [chargeId, router, seconds <= 0]);



  useEffect(() => {
        const omiseKey = process.env.NEXT_PUBLIC_OMISE_KEY;

      if (window?.Omise && omiseKey) {
        window.Omise.setPublicKey(omiseKey);
      } else {
        console.error("Omise key not found");
      }
  }, []);




    useEffect(() => {


  
    const dataId = cookies[CookieKey.MEMBER_ID]
    const dataName = cookies[CookieKey.MEMBER_NAME]
    const dataSurName = cookies[CookieKey.MEMBER_SURNAME]
    const dataImage = cookies[CookieKey.MEMBER_IMAGE]

    const dataReferCode = cookies[CookieKey.MEMBER_REFER_CODE]

    const dataPackageName = cookies[CookieKey.PAYMENT_PACKAGE_NAME]
    const dataAmount = cookies[CookieKey.PAYMENT_AMOUNT]
    const dataPackage = cookies[CookieKey.PAYMENT_PACKAGE]


    const dataEmail = cookies[CookieKey.PAYMENT_EMAIL]

    if (dataId) {
 
      setUserId(dataId)
      

            // setDisplayName(dataName)
      setDisplaySurname(dataSurName)
      setDisplayImage(dataImage)

      setAccountName(dataName)



      setPaymentPackageName(dataPackageName)
      setPaymentAmount(dataAmount)
      setPaymentPackage(dataPackage)

      setEmail(dataEmail)

      callOmisePromtpay(dataAmount, dataId, dataPackage, dataEmail)

    }
    
  
  },  [
        cookies[CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME, CookieKey.MEMBER_SURNAME, CookieKey.MEMBER_IMAGE, CookieKey.MEMBER_REFER_CODE, CookieKey.PAYMENT_PACKAGE_NAME, CookieKey.PAYMENT_AMOUNT, CookieKey.PAYMENT_PACKAGE
        ]
      ]
  )

  const onChangeEmail = (e: any) => {
  setEmail(e.target.value)
}

  const callOmisePromtpay = async ( amount: number, userId: string, paymentPackage: string, email: string) => {

    
    const res = await fetch(API.payment.pay_via_qr_code, {
      method: "POST",
      body: JSON.stringify({ 
        amount: amount,
        email: email,
        user_id: userId,
        payment_by: 'PROMPTPAY',
        package_code: paymentPackage,
       }),
      headers: { "Content-Type": "application/json" },
    });

      const qr = await res.json();

      // ดึง QR URI
      setQrUrl(qr.source.scannable_code.image.download_uri);

      // เก็บ charge.id ไว้สำหรับ polling สถานะ

      setChargeId(qr.id);
  }
 
  // ✅ Loading
  if (status === "loading") {
    return <ScreenLoading />;
  }


  const gotoLoginWith = () => {
    router.push(PageRouter.LOGIN_WITH)
  }
  

  useEffect(() => {
  if (seconds <= 0) {
    router.replace(`${PageRouter.PAYMENT_FAILURE}?reason=timeout`)
    return
  }

  const timer = setInterval(() => {
    setSeconds((prev) => prev - 1)
  }, 1000)

  return () => clearInterval(timer)
}, [seconds, router])

const formatTime = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}



const onSubmit = () => {
  router.replace(PageRouter.PAYMENT_THANKYOU)
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
            className="flex bg-[#F2F7FD] justify-center min-h-screen  w-fit  h-full flex-wrap mt-[60px] lg:mt-[60px] pb-[90px]">
              <div className="w-full  lg:w-full  md:px-0 pt-[60px]  md:pb-0 flex-wrap">
                <div className='w-full flex flex-wrap items-start pb-[100px]'>


                      <div className="w-full">
                          <div className="w-full flex-wrap px-[32px] md:px-0">
                            <div className="w-full flex-wrap">


                              <div className='w-full flex flex-wrap'>
                  
                                <div className='w-full flex flex-wrap'>
                                  <span className='w-full flex flex-wrap justify-center text-[#1B9AAF] text-center leading-10 text-[32px] font-semibold'>Scan QR Code</span>


                          



                                
                                </div>



                              </div>



                            </div>

                            {/* CARD COLUMN */}
                            <div className='w-full   flex-wrap grid grid-cols-1  gap-x-6 gap-y-10 justify-center   py-[30px] '>
                        


                                {/* CARD  */}
                                <div className='w-full md:w-[500px] lg:w-full items-end flex flex-wrap '>


                                    <div 
                                    style={{
                                      'boxShadow': '0px 12px 40px 0px rgba(25, 33, 61, 0.05)'
                                    }}
                                    className=' w-full  bg-white flex flex-wrap py-4 px-8  rounded-[32px] '>


                                
                                      <div className='w-full flex flex-wrap py-4'>
                                        {
                                          qrUrl ?

                                                        <div className="w-full flex flex-wrap  border-b  border-[#F2F7FD]  py-4">
                                                      <div className="w-full flex flex-wrap justify-center  ">
                                                        <Image
                                                            src={qrUrl}
                                                            width={200}
                                                            height={200}
                                                            alt='qrcode-promtpay'
                                                          />
                                                      </div>
                                                                                    <div className='w-full flex justify-center  flex-wrap'>
                                          
                                                                                        <Image  
                                                                                          src={'/images/mumate/omise.png'}
                                                                                          width={280}
                                                                                          height={20}
                                                                                          alt='visa-mastercard'
                                                                                          />
                                          
                                                                                    </div>
                                                                                  </div>
                                          :
                                          null
                                        }

                                        
                    

                                        <div className="w-full flex flex-wrap mt-6 justify-center ">
                                          <span className='w-full text-[18px] font-medium flex justify-start text-[#1B9AAF]  border-b border-[#F2F7FD] py-4'>รายการ</span>

                                          <div className='w-full flex flex-nowrap border-b border-[#F2F7FD] py-4'>
                                              <div className=' w-full grow flex flex-wrap'>
                                                <span className='w-full font-normal text-[#444444] text-[18px]'>{paymentPackageName}</span>
                                              </div>
                                              <div className=' w-fit  flex-none flex flex-wrap'>
                                                <span className='w-full font-normal text-[#444444] text-[18px]'>{paymentAmount}฿</span>
                                              </div>

                                          </div>
                                          <div className='w-full flex flex-nowrap  py-4'>
                                              <div className=' w-full grow flex flex-wrap'>
                                                <span className='w-full font-semibold text-[#1B9AAF] text-[18px]'>ราคารวม:</span>
                                              </div>
                                              <div className=' w-fit  flex-none flex flex-wrap'>
                                                <span className='w-full font-semibold text-[#1B9AAF] text-[18px]'>{paymentAmount}฿</span>
                                              </div>

                                          </div>
                                        </div>


                                          <div className="w-full flex flex-wrap justify-center items-center  mt-6 ">

                                            <Image
                                              src={'/images/mumate/ic_timer.svg'}
                                              width={24}
                                              height={24}
                                              alt='timer'
                                            />
                                            <span className='ml-2 text-[14px] text-[#888888]'>{formatTime(seconds)}</span>


                                          </div>

                                    
                                      </div>


                                  </div>

                                </div>




                                  {/* <div className="w-full grid  gap-x-4 grid-cols-2 justify-center items-center  mt-6 ">

                                    <button
                                    className='w-full bg-[#FBF6FA] cursor-pointer rounded-[40px] border-2 border-[#1B9AAF] py-[10px] px-[27px] '
                                    >

                                      <span className='text-[#1B9AAF] font-bold '>แชร์ QR</span>

                                    </button>

                                    <button
                                    onClick={() => { onSubmit() }}
                                    className='w-full bg-[#1B9AAF] cursor-pointer rounded-[40px] border-2 border-[#1B9AAF] py-[10px] px-[27px] '
                                    >

                                      <span className='text-white font-bold '>บันทึก QR</span>

                                    </button>
                                  </div> */}


                            
                            </div>
                          </div>

                       
                                                
                          
                          {/* overlay */}
                          {/* <div className="relative md:hidden z-10 h-[45px]
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
                          </div> */}
                      </div>
                  </div>


                
              </div>
            </div>

       


        </div>

      </div>


    </div>
  );
}
