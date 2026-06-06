"use client";
import HeaderMuMate from '@/components/header-v2';
import ModalBlocking from '@/components/modal-blocking';
import ModalPayment from '@/components/modal-payment';
import { PaymentPackageGet } from '@/constants/api/api-payment-package-get';
import { API } from '@/constants/api/endpoint';
import { CONFIG } from '@/constants/config';
import { CookieKey } from '@/constants/cookie-key';
import { PaymentHoroscope } from '@/constants/payment-horoscope';
import { PaymentPackage } from '@/constants/payment-package';
import { PaymentPlan } from '@/constants/payment-plan';
import { PageRouter } from '@/constants/router';
import { useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from 'react-cookie';


export default function PackagePricePage() {

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


  const [modalPaymentAmount, setModalPaymentAmount] = useState<number>(0)

  const [isShowFamily, setIsShowFamily] = useState<boolean>(false)
  const [isShowPayAsYou, setIsShowPayAsYou] = useState<boolean>(false)
  const [isShowFree, setIsShowFree] = useState<boolean>(false)
  


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
  const [isShowModalRegister, setIsShowModalRegister] = useState<boolean>(false)

  


  const [isPayAs3QA, setIsPayAs2QA] = useState<boolean>(true)

  const fallback = '/images/mumate/ic_avatar.svg' 
  const [imgSrc, setImgSrc] = useState(displayImage || fallback)

  const [isShowModalPayment, setIsShowModalPayment] = useState<boolean>(false)
  const [modalPaymentPackageCode, setModalPaymentPackageCode] = useState<string>('')


  const [tab, setTab] = useState<any>('FREE') // FREE, SOULMATE, PAYASUSE




  useEffect(() => {
    if (status === "unauthenticated") {
      // router.replace(PageRouter.HOME)
      setIsLogin(false)
    } else {
      setIsLogin(true)
    }
  }, [status, session]);



  useEffect(() => {
    // if (window?.Omise) {
    //   window.Omise.setPublicKey("pkey_5zlc86rc0y3bcea9eik");
    //   // console.log("Omise JS Loaded:", window.Omise);
    // } else {
    //   // console.log("Omise JS NOT LOAD:");
    // }

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
    return <p>Loading...</p>;
  }


  const gotoLoginWith = () => {
    router.push(PageRouter.LOGIN_WITH)
  }







const handleCharge = async (token: any, amount: number) => {
  const res = await fetch(API.payment.pay_via_credit_card, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: token,
      amount: amount, // ยอดเงิน (บาท)
    }),
  });

  const data = await res.json();
};


  const handlePay = async (packageCode: string, packageName: string, amount: number, packageId: number) => {

    if (packageCode == PaymentPackage.MEMBER_FREE) {
      if(isLogin == false) {
        router.replace(PageRouter.LOGIN_WITH)
        return
      } else {
        router.replace(PageRouter.HOME)
        return
      }
    }

    if (isLogin == false) {
      setIsShowModalRegister(true)
      return;
    }



    setCookie(CookieKey.PAYMENT_PLAN, PaymentPlan.MEMBER, {
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


  const handlePayTopup = async () => {

    if (isLogin == false) {
      setIsShowModalRegister(true)
      return;
    }


    setCookie(CookieKey.PAYMENT_PLAN, PaymentPlan.PAYASUSE, {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    setCookie(CookieKey.PAYMENT_PACKAGE, isPayAs3QA ? PaymentPackage.PAY_3Q : PaymentPackage.PAY_10Q, {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    setCookie(CookieKey.PAYMENT_PACKAGE_NAME,  isPayAs3QA ? '3 คำถาม' : '10 คำถาม', {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })

    setCookie(CookieKey.PAYMENT_AMOUNT,  isPayAs3QA ? 60 : 200, {
      path: '/',
      maxAge: CONFIG.EXPIRED_TIME_COOKIE,
      sameSite: true,
    })


   router.push(PageRouter.PAYMENT_SELECT_CHANNEL)
  }


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


  const onClickBlockClose = () => {
    setIsShowModalRegister(false)
  }


  const onClickBlockRegister = () => {
    setIsShowModalRegister(false)
    router.replace(PageRouter.LOGIN_WITH)
  }


  return (
    <div 

    className="w-full  min-h-screen flex justify-center h-fit font-prompt">
      <Head>
        <title>Mumate</title>
      </Head>

      <div className="w-full block  flex-wrap">
       <div className='w-full flex flex-wrap'>
          <HeaderMuMate isShowMenu={isShowMenu} isLogin={isLogin} image={imgSrc} isShowProfile={false}  />
        </div>


        <div className='w-full flex flex-wrap justify-center'>
            <div 
            className="flex justify-center  w-fit  flex-wrap ">
              <div className="w-full flex lg:w-full px-0 md:px-0  flex-wrap">
                <div className='w-full flex flex-wrap items-start'>
                    <div className="w-full flex flex-wrap">


                      <div className='w-full flex flex-wrap'>
          
                       <div className=" w-full flex flex-wrap">
                            <div 
                              style={{
                                  background: 'linear-gradient(180deg, #2599AE 0%, #3A78A9 100%)'
                                }}
                              className="fixed lg:relative left-0 top-[60px] h-[40x] md:h-[120px] items-center lg:top-[60px] pt-0 lg:pt-[60px] w-full flex flex-wrap pb-10">
                                <span className='w-full flex flex-wrap justify-center text-white text-center leading-10 text-[32px] font-semibold'>เลือกแพ็คเกจที่ใช่</span>

                            </div>


                            <div className='w-full flex lg:hidden fixed lg:relative top-0 left-0 mt-[120px] md:mt-[180px]  flex-wrap bg-[#D4F8F9]'>

                              <div 
                              onClick={() => { setTab('FREE') }}
                              className={
                                ( tab == 'FREE' ? ' bg-[#1B9AAF] text-white font-medium ' : '') + 
                                ' w-1/3 cursor-pointer flex flex-wrap py-4 px-2 items-center justify-center border border-[#AEF0F3]'
                                }>
                                <span className='w-fit  justify-start text-[18px] text-center flex flex-wrap'>FirstMate</span>
                              </div>

                              <div 
                              onClick={() => { setTab('PAYASUSE') }}
                              className={
                                ( tab == 'PAYASUSE' ? ' bg-[#1B9AAF] text-white font-medium ' : '') + 
                                ' w-1/3 cursor-pointer flex flex-wrap py-4 px-2 items-center justify-center border border-[#AEF0F3]'
                                }>
                                <span className='w-fit  justify-start text-[18px] text-center flex flex-wra'>Fleximate</span>
                              </div>

                              <div 
                              onClick={() => { setTab('SOULMATE') }}
                              className={
                                ( tab == 'SOULMATE' ? ' bg-[#1B9AAF] text-white font-medium ' : '') + 
                                ' w-1/3 cursor-pointer flex flex-wrap py-4 px-2 items-center justify-center border border-[#AEF0F3]'
                                }>
                                <span className='w-fit  justify-start text-[18px] text-center flex flex-wra'>Soulmate 🔥</span>
                              </div>

                            </div>

                            {/* div2 */}
                            <div className="w-full flex flex-wrap bg-[#F2F7FD] pb-[40px] pt-[130px] md:pt-[240px] lg:pt-[100px] ">
                                {/* CARD COLUMN */}
                                <div className='w-full   flex-wrap grid grid-cols-1 lg:grid-cols-3 gap-x-0 md:gap-x-6  justify-center  py-[60px] md:py-[60px] px-[24px]'>
                                         
                                    {/* CARD FREE */}
                                    <div className={
                                      ( tab == 'FREE' ? ' flex ' : ' hidden lg:flex ') + 
                                      ' w-full md:w-full lg:w-full h-fit   flex-wrap  '}>

                                     
                                      <div 
                                        style={{
                                          'background': 'var(--Colors-Neutrals-White, rgba(255, 255, 255, 1))'
                                        }}
                                        
                                        className=' w-full border  flex flex-wrap py-4 md:py-8 px-4 md:px-8  rounded-[18px]'>


                                          <div className='w-full flex flex-wrap border-b border-[#A3A3A3] pb-10'>
                                            <span className='w-full  text-[#B0B0B0] justify-start font-normal text-[18px] text-center flex flex-wrap mt-4'>แพ็คเกจ</span>
                                            <span className='w-full  text-black justify-start font-medium text-[28px] text-center flex flex-wrap'>FirstMate</span>
                                            <span className='w-full  text-gray-600 justify-start font-normal text-[18px] text-left flex flex-wrap'>เหมาะสำหรับสายลอง อยากรู้พื้นฐาน ดวงตัวเองก่อนตัดสินใจ</span>

                                            <span className='w-full  text-[#1B9AAF] justify-start font-bold text-[45px] text-center flex flex-wrap mt-4'>ฟรี</span>
                                            <span className='w-full  text-gray-600 justify-start font-normal text-[18px] text-left flex flex-wrap'>ปลดล็อกพื้นฐานดวง Bazi เบื้องต้น โดยไม่มีค่าใช้จ่าย</span>
                                          </div>
                                   


                                          <div className='w-full flex flex-wrap justify-center mt-2 md:mt-6'>
                                    
                                            <div className={' flex w-full  flex-wrap'}>
                                                <div className=' w-full  py-[6px] md:py-[12px] flex flex-wrap pb-5 md:pb-10'  >
                
                                                    <div className='w-full my-[0px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-[#444444] text-[16px]'>ดูดวงจีน Bazi ครบ 8 ช่อง</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-[#444444] text-[16px]'>การ์ดบุคลิกประจำตัว</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-[#444444] text-[16px]'>วิเคราะห์ธาตุและนิสัยเชิงลึก</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-[#444444] text-[16px]'>ทดลอง Mate AI 1 คำถาม</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-[#444444] text-[16px]'>เซียมซี 1 ครั้ง / เดือน</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-[#444444] text-[16px]'>ปฏิทินดวงเฉพาะวันนี้</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-[#444444] text-[16px]'>เส้นทางชีวิตถึงอายุ 30 ปี</span>
                                                    </div>  


                                                </div>  
                                            </div>
                                      

                                          </div>


                                          <div className='w-full flex  justify-center flex-wrap mt-4 md:mt-8'>

                                            <div 
                                            onClick={() => {  handlePay(PaymentPackage.MEMBER_FREE, 'Free', 0, 0) }}

                                           
                                            className={
                                                 (' bg-[#D4F8F9] text-white cursor-pointer '  ) + 
                                              ' w-full py-4 px-4 items-center flex flex-nowrap  rounded-[40px]'}>

                                              <div className='w-full grow flex justify-start flex-wrap'>

                                                <span className=' text-[#1B9AAF] justify-center font-bold text-xl'>เริ่มใช้ฟรี</span>

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

                                    </div>


                                                                        
                                    {/* CARD FLEXIMATE */}
                                    <div className={
                                      ( tab == 'PAYASUSE' ? ' flex ' : ' hidden lg:flex ') + 
                                      ' w-full md:w-full lg:w-full h-fit   flex-wrap  '}>

                                     
                                      <div 
                                        style={{
                                          'background': 'var(--Colors-Neutrals-White, rgba(255, 255, 255, 1))'
                                        }}
                                        
                                        className=' w-full   border flex flex-wrap  py-4 md:py-8 px-4 md:px-8   rounded-[18px]'>


                                          <div className='w-full flex flex-wrap border-b border-[#A3A3A3] pb-5 md:pb-10'>
                                            <span className='w-full  text-[#B0B0B0] justify-start font-normal text-[18px] text-center flex flex-wrap mt-4'>แพ็คเกจ</span>
                                            <span className='w-full  text-black justify-start font-medium text-[28px] text-center flex flex-wrap'>FlexiMate</span>
                                            <span className='w-full  text-gray-600 justify-start font-normal text-[18px] text-left flex flex-wrap'>จ่ายตามจริง ไม่ติดสัญญา</span>



                                            <div className='w-full flex flex-wrap items-end  mt-4 bg-[#F2F7FD] p-4 rounded-[8px]'>
                                                    <div 
                                                    onClick={() => { setIsPayAs2QA(true) }}
                                                    className={
                                                      (isPayAs3QA ? ' text-white bg-[#1B9AAF] ' : ' text-[#1B9AAF] ' ) + 
                                                      ' w-1/2  cursor-pointer flex flex-wrap py-2 rounded-[8px]'
                                                      }>
                                                      <span className='w-full  justify-center font-medium text-[20px] md:text-[25px] text-center flex flex-wrap'>
                                                        3 คำถาม
                                                      </span>
                                                    </div>         
                                                    <div 
                                                    onClick={() => { setIsPayAs2QA(false) }}
                                                      className={
                                                      (isPayAs3QA == false ? ' text-white  bg-[#1B9AAF] ' : ' text-[#1B9AAF] ' ) + 
                                                      ' w-1/2  cursor-pointer flex flex-wrap py-2 rounded-[8px] '
                                                      }>
                                                      <span className='w-full   justify-center font-medium [20px] md:text-[25px] text-center flex flex-wrap'>
                                                        10 คำถาม
                                                      </span>
                                                    </div>     
                                            </div>

                                            <div className='w-full flex flex-wrap items-end  mt-4'>
                                                <span className='w-fit  text-[#1B9AAF] justify-start font-bold text-[38px] md:text-[45px]  flex flex-wrap'>{isPayAs3QA ? 60 : 200 }</span>
                                                <span className='w-fit  text-gray-600 justify-start font-normal text-[18px] mb-3 ml-3 flex flex-wrap'>บาท</span>
                                            </div>
                                            <span className='w-full  text-gray-600 justify-start font-normal text-[18px] text-left flex flex-wrap'>เฉลี่ย 20 บาท / คำถาม · ไม่มีหมดอายุ</span>
                                          </div>

                                          <div className='w-full flex flex-wrap items-end  mt-4 bg-[#F2F7FD] p-4 rounded-[8px]'>
                                            <span className='w-full  text-black justify-start font-medium text-[14px] md:text-[18px] text-left flex flex-wrap'>
                                              ถ้าใช้เกิน 25 คำถาม/ปี → Soulmate คุ้มกว่า
                                            </span>
                                          </div>
                                   


                                          <div className='w-full flex flex-wrap justify-center mt-2 md:mt-6'>
                                    
                                            <div className={' flex w-full  flex-wrap'}>
                                                <div className=' w-full  py-[6px] md:py-[12px] flex flex-wrap p-[0px]'  >
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-[#444444] text-[16px]'>เปิดใช้งาน Mate AI ได้เลย</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-[#444444] text-[16px]'>AI วิเคราะห์ Bazi ส่วนตัวคุณ</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-[#444444] text-[16px]'>ถามได้ทุกเรื่อง รัก งาน เงิน สุขภาพ</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-[#444444] text-[16px]'>Real-time AI ตอบไว ไม่ต้องรอคิว</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-[#444444] text-[16px]'>ไม่มีวันหมดอายุ เก็บไว้ถามตอนไหนก็ได้</span>
                                                    </div>  
                

                                                </div>  
                                            </div>
                                      

                                          </div>


                                          <div className='w-full flex  justify-center flex-wrap mt-8'>

                                            <div 
                                            onClick={() => {   handlePayTopup() }}

                                           
                                            className={
                                                 (' bg-[#D4F8F9] text-white cursor-pointer '  ) + 
                                              ' w-full py-4 px-4 items-center flex flex-nowrap  rounded-[40px]'}>

                                              <div className='w-full grow flex justify-start flex-wrap'>

                                                <span className=' text-[#1B9AAF] justify-center font-bold text-xl'>รับ Fleximate</span>

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

                                    </div>


                                    {/* CARD SOULMATE */}
                                    <div className={
                                      ( tab == 'SOULMATE' ? ' flex ' : ' hidden lg:flex ') + 
                                      ' w-full md:w-full lg:w-full h-fit   flex-wrap  '}>

                                     
                                      <div 
                                        
                                        className=' w-full   border flex flex-wrap  py-4 md:py-8 px-4 md:px-8  bg-[#0F333F] rounded-[18px]'>


                                          <div className='w-full flex flex-wrap border-b border-[#A3A3A3] pb-5 md:pb-10'>
                                            <span className='w-full  text-[#B0B0B0] justify-start font-normal text-[18px] text-center flex flex-wrap mt-4'>แพ็คเกจ</span>
                                            <span className='w-full  text-white justify-start font-medium text-[28px] text-center flex flex-wrap'>Soulmate</span>
                                            <span className='w-full  text-white justify-start font-normal text-[15px] md:text-[18px] text-left flex flex-wrap'>ปลดล็อกทุกมิติชีวิต ใช้งาน Unlimited ตลอดปี</span>

                                            <div className='w-full rounded-[8px] bg-[#1B7283] hidden md:flex flex-wrap p-4 mt-4'>

                                              <span className='w-full  text-white justify-start font-normal text-[18px] text-left flex flex-wrap'>Early Bird ลด 61%</span>


                                            </div>


                                            <span className='w-full  text-white mt-4 justify-start font-normal text-[18px] text-left flex flex-wrap line-through'>จากปกติ 1,290 บาท</span>

                                            <div className='w-full flex flex-wrap items-end '>
                                                <span className='w-fit  text-[#33D0DC] justify-start font-bold text-[45px]  flex flex-wrap'>{499}</span>
                                                <span className='w-fit  text-white justify-start font-normal text-[18px] mb-3 ml-3 flex flex-wrap'>บาท / ปี</span>
                                            </div>
                                            <div className='w-full rounded-[8px] bg-[#1B7283] flex flex-wrap p-4 mt-4'>
                                                 <span className='w-1/2  text-white justify-start font-medium text-[14px] md:text-[18px] text-left flex flex-wrap'>คุ้มที่สุด! เพียงวันละ</span>
                                                 <span className='w-1/2  text-white font-normal text-[14px] md:text-[18px] text-left flex flex-wrap justify-end'>1.40 บาท / วัน</span>


                                            </div>

                                          

                                          </div>
                                   


                                          <div className='w-full flex flex-wrap justify-center mt-2 md:mt-6'>
                                    
                                            <div className={' flex w-full  flex-wrap'}>
                                                <div className=' w-full  py-[6px] md:py-[12px] flex flex-wrap p-[0px]'  >
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check-white.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-white text-[16px]'>ถาม Mate AI ได้ไม่อั้น 24 ชม.</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check-white.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-white text-[16px]'>Full Access ทุกฟีเจอร์ ไม่มีกั๊ก</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check-white.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-white text-[16px]'>เช็ก Love Matching ได้ไม่จำกัด</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check-white.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-white text-[16px]'>สแกนดวงงาน & Partner ได้ทุกวัน</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check-white.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-white text-[16px]'>เก็บสถิติดวงรายวัน - รายเดือนแบบ ละเอียด</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check-white.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-white text-[16px]'>Life Path ส่องอนาคตยาวถึง 90+ ปี</span>
                                                    </div>  
                
                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check-white.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-white text-[16px]'>Save รายชื่อคนโปรดได้ถึง 20 คน</span>
                                                    </div>  

                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check-white.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-white text-[16px]'>Unlimited Access เซียมซี & Oracle</span>
                                                    </div>   

                                                    <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check-white.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-white text-[16px]'>Alert ดวงล่วงหน้า 10 จังหวะชีวิต</span>
                                                    </div>  

                                                    {/* <div className='w-full my-[5px] flex flex-wrap'>
                                                      <Image
                                                        src={'/images/mumate/ic_round-check-white.svg'}
                                                        width={20}
                                                        height={20}
                                                        className='mr-3'
                                                        alt='icon-feature'/>
                                                      <span className='text-white text-[16px]'>เปิด Private Mode ซ่อนโปรไฟล์ส่วนตัว</span>
                                                    </div>   */}



                                                </div>  
                                            </div>
                                      

                                          </div>


                                          <div className='w-full flex  justify-center flex-wrap mt-4 md:mt-8'>

                                            <div 
                                            onClick={() => {  handlePay(PaymentPackage.SOULMATE, 'SOULMATE', 499, 0) }}

                                           
                                            className={
                                                 (' bg-[#1B99AF] text-white cursor-pointer '  ) + 
                                              ' w-full py-4 px-4 items-center flex flex-nowrap  rounded-[40px]'}>

                                              <div className='w-full grow flex justify-start flex-wrap'>

                                                <span className=' text-white justify-center font-bold text-xl'>รับแพ็ค Soulmate</span>

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


                                </div>
                            </div>
                            
                            <div className='w-full flex flex-wrap pt-0 pb-[120px] bg-[#F2F7FD]'>
                              <div className='w-full flex flex-wrap bg-[#E6ECFA]  rounded-[32px] p-[36px] mx-6'>

                                <div className='w-full flex flex-wrap'>

                                  <Image
                                    src={'/images/mumate/img_avatar_professional.png'}
                                    width={90}
                                    height={90}
                                    alt='avatar'
                                  />

                                </div>

                                <div className='w-full flex flex-wrap mt-4'>

                                  <span className='w-full  text-black justify-start font-normal text-[18px] text-left flex-wrap '>
                                      มาดูดวงกับซินแสผู้เชี่ยวชาญที่มีประสบการณ์มากกว่า 30 ปีเพื่อ<br/>
                                      ทำนายและแนะนำให้่เหมาะสมกับชีวิตของคุณ <span
                                      onClick={ () => { router.push(PageRouter.PACKAGE_HOROSCOPE )}}
                                       className=' font-medium text-[#1B99AF] underline cursor-pointer '>คลิกเพื่อดูแพ็กเกจดูดวง</span>
                                  </span>

                                </div>

                              </div>
                            </div>



                      </div>



                      </div>



                    </div>
                  </div>


                
              </div>


            
            </div>


        </div>

      </div>

      {
        isShowModalPayment ?
          <ModalPayment onClose={onCloseModalPayment} onSubmitOK={onSubmitModalPayment} amount={modalPaymentAmount} />
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
