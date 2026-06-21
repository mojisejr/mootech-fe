"use client";
import ScreenLoading from '@/components/screen-loading';
import HeaderMuMate from '@/components/header-v2';
import ModalBlocking from '@/components/modal-blocking';
import ModalPayment from '@/components/modal-payment';
import ModalPaymentPromptPay from '@/components/modal-payment-qrcode';
import { PaymentPackageGet } from '@/constants/api/api-payment-package-get';
import { API } from '@/constants/api/endpoint';
import { CONFIG } from '@/constants/config';
import { CookieKey } from '@/constants/cookie-key';
import { PaymentHoroscope } from '@/constants/payment-horoscope';
import { PaymentPlan } from '@/constants/payment-plan';
import { PageRouter } from '@/constants/router';
import { useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from 'react-cookie';


export default function FortuneStickPage() {

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


  const [qrUrl, setQrUrl] = useState<string>("");
  const [chargeId, setChargeId] = useState<string>("");

const [isShowModalRegister, setIsShowModalRegister] = useState<boolean>(false)

  

  const [isShowModalPayment, setIsShowModalPayment] = useState<boolean>(false)
  const [modalPaymentAmount, setModalPaymentAmount] = useState<number>(0)
  const [modalPaymentPackageCode, setModalPaymentPackageCode] = useState<string>('')

  


  const [isShowModalPaymentPromptpay, setIsShowModalPaymentPromptpay] = useState<boolean>(false)

  


  const [isLogin, setIsLogin] = useState<boolean>(false)

  const router = useRouter();
  const callback = router.query.callback as string || '/';
  const { data: session, status } = useSession();

  const [userId, setUserId] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')
  const [displaySurname, setDisplaySurname] = useState<string>('')
  const [displayImage, setDisplayImage] = useState<string>('')
  const [accountName, setAccountName] = useState<string>('')
      const fallback = '/images/mumate/ic_avatar.svg' 
    const [imgSrc, setImgSrc] = useState(displayImage || fallback)


  const [fortuneInfo, setFortuneInfo] = useState<any>(null)

  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)

  const [isShowFortune, setIsShowFortune] = useState<boolean>(false)

  

  useEffect(() => {
    if (status === "unauthenticated") {
      // router.replace(PageRouter.HOME)
    } else {
      setIsLogin(true)
    }
  }, [status, session]);



  useEffect(() => {
    const omiseKey = process.env.NEXT_PUBLIC_OMISE_KEY;

    if (window?.Omise && omiseKey) {
      window.Omise.setPublicKey(omiseKey);
    } else {
      console.error("Omise key not found");
    }

    setCookie(CookieKey.PAYMENT_PLAN, '', {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    setCookie(CookieKey.PAYMENT_PACKAGE, '', {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    setCookie(CookieKey.PAYMENT_PACKAGE_NAME, '', {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    setCookie(CookieKey.PAYMENT_AMOUNT, '', {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    setCookie(CookieKey.PAYMENT_EMAIL, '', {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })


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
       setImgSrc(dataImage)
      setAccountName(dataName)

    }
    
  
  },  [
        cookies[CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME, CookieKey.MEMBER_SURNAME, CookieKey.MEMBER_IMAGE, CookieKey.MEMBER_REFER_CODE]
      ]
  )

 
  // ✅ Loading
  if (status === "loading") {
    return <ScreenLoading />;
  }


  const gotoLoginWith = () => {
    router.push(PageRouter.LOGIN_WITH)
  }




  const handlePay = async (packageCode: string, packageName: string, amount: number, packageId: number) => {

    if (isLogin == false) {
      setIsShowModalRegister(true)
      return;
    }


    setCookie(CookieKey.PAYMENT_PLAN, PaymentPlan.HOROSCOPE, {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    setCookie(CookieKey.PAYMENT_PACKAGE, packageCode, {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    setCookie(CookieKey.PAYMENT_PACKAGE_NAME, packageName, {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    setCookie(CookieKey.PAYMENT_AMOUNT, amount, {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })


      const result =  await PaymentPackageGet(packageCode)
      if (result) {

        setModalPaymentPackageCode(packageCode)
        setModalPaymentAmount(result.amount)
        router.push(PageRouter.PAYMENT_SELECT_CHANNEL)
      }

  };

const onCloseModalPayment = () => {
  setIsShowModalPayment(false)
}

const onSubmitModalPayment = async (paymentMethod: number) => {
  setIsShowModalPayment(false)



    if (paymentMethod == 1) {

      router.push(PageRouter.PAYMENT_VIA_CREDIT_CARD)
      // setIsShowModalPaymentCreditCard(true)
    } else {

      router.push(PageRouter.PAYMENT_VIA_QRCODE)
      // callOmisePromtpay(modalPaymentAmount)
    }
  
}



const onSubmitModalPaymentPromptpay = () => {
  setIsShowModalPaymentPromptpay(false)
}
const onCloseModalPaymentPromptpay = () => {
  setIsShowModalPaymentPromptpay(false)
}


const callOmisePromtpay = async ( amount: number) => {

  
  const res = await fetch(API.payment.pay_via_qr_code, {
    method: "POST",
    body: JSON.stringify({ amount: amount }),
    headers: { "Content-Type": "application/json" },
  });

    const qr = await res.json();

    // ดึง QR URI
    setQrUrl(qr.source.scannable_code.image.download_uri);

    // เก็บ charge.id ไว้สำหรับ polling สถานะ
    setChargeId(qr.id);

    setIsShowModalPaymentPromptpay(true)
}

  const onClickBlockClose = () => {
    setIsShowModalRegister(false)
  }


  const onClickBlockRegister = () => {
    setIsShowModalRegister(false)
    router.replace(PageRouter.LOGIN_WITH)
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

      <div className="w-full block  flex-wrap">
         <div className='w-full flex flex-wrap'>
          <HeaderMuMate isShowMenu={isShowMenu} isLogin={isLogin} image={imgSrc}  isShowProfile={false}   />
        </div>



        <div className="flex justify-center w-full flex-wrap mt-[60px] lg:mt-[60px]">
          <div className="w-full md:w-[400px] lg:w-[1000px]  px-[32px] md:px-0 flex-wrap">
            <div className='w-full flex flex-wrap items-start'>
                <div className="w-full flex-wrap">


                  <div className='w-full flex flex-wrap'>
      
                    <div className='w-full flex flex-wrap'>
                      <span className='w-full flex flex-wrap justify-center text-white text-[32px] font-semibold'>แพ็คเกจดูดวง</span>
                      <span className='w-full flex flex-wrap justify-center text-center text-white text-[16px]'>
                        ไม่ว่าจะเป็นเรื่องการเงิน การงาน ความรัก หรือแม้แต่การดูดวงทั่วไป โดยซินแสเซียนปลาน้อย
                      </span>
                    </div>



                  </div>



                </div>
              </div>


              <div className="w-fit flex lg:grid lg:grid-cols-2 lg:gap-6 flex-wrap lg:items-center mt-[60px] md:mt-[60px] justify-center  mb-[90px]">

          


                <div className='w-full md:w-[400px] lg:w-full h-fit lg:h-[350px] rounded-[24px]  flex flex-wrap py-8 px-8 bg-white shadow-md mt-6 lg:mt-0'>

                      <span className='w-full  text-[#1B9AAF] justify-center font-medium text-2xl text-center flex flex-wrap'>Unlock!<br/>ถามตอบเรื่องด่วน</span>

                      <span className='w-full  text-black justify-center font-medium text-2xl text-center flex flex-wrap mt-4'>690 บาท / 30 นาที</span>

                      <span className='w-full flex text-center text-[#888888] flex-wrap mt-4'>
                          มีเรื่องคาใจ? ถามเฉพาะจุด 1-2
                          เรื่องที่อยากรู้ที่สุด แล้วรับ Spoiler
                          คำทำนายไปเลย!
                      </span>

                      <div className='w-full flex  justify-center flex-wrap mt-4'>

                        <div 
                        onClick={() => { handlePay(PaymentHoroscope.QA, 'ถามตอบเรื่องด่วน', 690, 2) }}
                        className={

                          (' text-[#1B9AAF]  bg-[#AEF0F3] cursor-pointer ' ) +
                          ' w-[220px] py-2 px-4 items-center flex flex-nowrap rounded-[40px]'}>

                          <div className='w-full justify-center grow flex flex-wrap'>

                            <span className='  justify-center font-bold text-lg'>Unlock Now</span>

                          </div>

                          <div className='w-fit flex flex-nowrap'>
                            <Image
                              src={'/images/icons/ic_arrow_next.svg'}
                              width={40}
                              height={40}
                              alt='icon-next'
                            />
                          </div>

                        </div>

                      </div>

                </div>



                <div className='w-full md:w-[400px] lg:w-full h-fit lg:h-[350px] rounded-[24px]  flex flex-wrap py-8 px-8 bg-white shadow-md mt-6 lg:mt-0'>

                      

                      <span className='w-full  text-[#F547D5] justify-center font-medium text-2xl text-center flex flex-wrap'>✨ Most Popular ✨</span>

                      <span className='w-full  text-[#AA5CFF] justify-center font-medium text-2xl text-center flex flex-wrap mt-4'>Deep Dive!<br/>สแกนดวง Exclusive</span>

                      <span className='w-full  text-black justify-center font-medium text-2xl text-center flex flex-wrap mt-4'>1,190 บาท / 60 นาที</span>

                      <span className='w-full flex text-center text-[#888888] flex-wrap mt-4'>
                            สแกนภาพรวมดวงชะตา ถามได้ทุกเรื่องแบบ
                          Unlimited เพื่อสร้าง Personal Map
                          วางแผนชีวิตให้ปัง!
                      </span>

                      <div className='w-full flex  justify-center flex-wrap mt-4'>

                        <div 
                        onClick={() => { handlePay(PaymentHoroscope.DEEP_DIVE, 'Deep Dive! สแกนดวง Exclusive', 1190, 3) }}
                        className={

                          (' text-[#AA5CFF]  bg-[#EDDDFF] cursor-pointer ' ) +
                          ' w-[220px] py-2 px-4 items-center flex flex-nowrap  rounded-[40px]'}>

                          <div className='w-full grow flex justify-center flex-wrap'>

                            <span className=' justify-center font-bold text-lg'>Get Deep Dive</span>

                          </div>

                          <div className='w-fit flex flex-nowrap'>
                            <Image
                              src={'/images/icons/ic_arrow_next_purple.svg'}
                              width={40}
                              height={40}
                              alt='icon-next'
                            />
                          </div>

                        </div>

                      </div>

                </div>
                


                <div className='w-full md:w-[400px]  lg:w-full h-fit lg:h-[350px] rounded-[24px] flex flex-wrap py-8 px-8 bg-white shadow-md mt-6 lg:mt-0'>

                      

                      <span className='w-full  text-[#FFA300] justify-center font-medium text-2xl text-center flex flex-wrap'>Level Up!<br/>วางแผนกลยุทธ์ VIP</span>

                      <span className='w-full  text-black justify-center font-medium text-2xl text-center flex flex-wrap mt-4'>2,890 บาท / 90 นาที</span>

                      <span className='w-full flex text-center text-[#888888] flex-wrap mt-4'>
                              สำหรับคนที่ไม่ต้องการแค่ "รู้" แต่อยาก 'สร้าง'อนาคต! เจาะลึกทุกมิติ วางกลยุทธ์แบบ CEO
                              พร้อม Follow-up 7 วันเต็ม
                      </span>

                      <div className='w-full flex  justify-center flex-wrap mt-4'>

                        <div 
                        onClick={() => { handlePay(PaymentHoroscope.VIP, 'Level Up! วางแผนกลยุทธ์ VIP', 2890, 4) }}
                        className={

                          ( ' text-[#FFA300]  bg-[#FFF4D4] cursor-pointer ' ) +
                          ' w-[220px] py-2 px-4 items-center flex flex-nowrap  rounded-[40px]'}>

                          <div className='w-full justify-center grow flex flex-wrap'>

                            <span className='  font-bold text-lg'>Go VIP</span>

                          </div>

                          <div className='w-fit flex flex-nowrap'>
                            <Image
                              src={'/images/icons/ic_arrow_orange.svg'}
                              width={40}
                              height={40}
                              alt='icon-next'
                            />
                          </div>

                        </div>

                      </div>

                </div>
                
              </div>
          </div>
        </div>


     <div className='w-full justify-center flex flex-nowrap'>
                <Image
                  src={'/images/icons/image_mascot_package.svg'}
                  width={160}
                  height={60}
                  alt='icon-next'
                />
              </div>
      </div>

      {
        isShowModalPayment ?
          <ModalPayment onClose={onCloseModalPayment} onSubmitOK={onSubmitModalPayment} amount={modalPaymentAmount} />
        :
         null
      }

      {
        isShowModalPaymentPromptpay ?
          <ModalPaymentPromptPay url={qrUrl} onClose={onCloseModalPaymentPromptpay} onSubmitOK={onSubmitModalPaymentPromptpay} />
        :
          null
      }


      {
        isShowModalRegister ?
        <ModalBlocking onSubmitOK={onClickBlockClose} onGoSubscribe={onClickBlockRegister} />
        :
        null
      }

    </div>
  );
}
