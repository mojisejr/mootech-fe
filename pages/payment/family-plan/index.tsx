"use client";
import Menu from '@/components/menu';
import ModalPayment from '@/components/modal-payment';
import ModalPaymentCreditCard from '@/components/modal-payment-creditcard';
import ModalPaymentPromptPay from '@/components/modal-payment-qrcode';
import { FortuneStickGet } from '@/constants/api/api-fortune-stick-get';
import { API } from '@/constants/api/endpoint';
import { CONFIG } from '@/constants/config';
import { CookieKey } from '@/constants/cookie-key';
import { PaymentPackage } from '@/constants/payment-package';
import { PaymentPlan } from '@/constants/payment-plan';
import { PageRouter } from '@/constants/router';
import { signOut, useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from 'react-cookie';


export default function PaymentFamilyPlanPage() {

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
  ])



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

  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)


  const [familyNo, setFamilyNo] = useState<number>(2)


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
      // console.log("Omise JS Loaded:", window.Omise);
    } else {
      // console.log("Omise JS NOT LOAD:");
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


  const onSubmit = () => {
    router.replace(PageRouter.PAYMENT_SELECT_CHANNEL)
  }




  const handlePay = async () => {

    let packageCode = ''
    let packageName = '';
    let amount = 499;

    if (familyNo == 2) {
      packageCode = PaymentPackage.MEMBER_FAMILY_2
      packageName = 'Set Family Size 2'
      amount = 499;
    } else if (familyNo == 3) {
      packageCode = PaymentPackage.MEMBER_FAMILY_3
      packageName = 'Set Family Size 3'
      amount = 1350;
    } else if (familyNo == 4) {
      packageCode = PaymentPackage.MEMBER_FAMILY_4
      packageName = 'Set Family Size 4'
      amount = 1600;
    } else if (familyNo == 5) {
      packageCode = PaymentPackage.MEMBER_FAMILY_5
      packageName = 'Set Family Size 5'
      amount = 1750;
    } else if (familyNo == 6) {
      packageCode = PaymentPackage.MEMBER_FAMILY_6
      packageName = 'Set Family Size 6'
      amount = 2000;
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

    router.replace(PageRouter.PAYMENT_TRANSFER)

  };


  const getPrice = () => {
    if (familyNo == 2) {
      return 1800
    } else if (familyNo == 3) {
      return 1800
    } else if (familyNo == 4) {
      return 1800
    } else if (familyNo == 5) {
      return 1800
    } else if (familyNo == 6) {
      return 1800
    }

    return 1800
  }

  const getPriceDiscount = () => {
    if (familyNo == 2) {
      return 499
    } else if (familyNo == 3) {
      return 1350
    } else if (familyNo == 4) {
      return 1600
    } else if (familyNo == 5) {
      return 1750
    } 

    return 499
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
              <div className="w-full  lg:w-full  pt-[60px] pb-[20px] md:pb-0 flex-wrap">


                <div className=" w-full">
                  <div className=" w-full flex flex-wrap pb-[60px]  px-[32px] md:px-0">
                    <div className='w-full flex flex-wrap items-start'>
                        <div className="w-full flex-wrap">


                          <div className='w-full flex flex-wrap'>
              
                            <div className='w-full flex flex-wrap'>
                              <span className='w-full flex flex-wrap justify-center text-[#1B9AAF] text-center leading-10 text-[32px] font-semibold'>Family Plan</span>
                              <span className='w-full flex justify-center text-[#444444] text-center mt-4 text-[16px]'>Get the best deal for your family on one bill with flexible pricing & personalized device options.</span>
                            </div>
                          </div>
                        </div>
                    </div>


                    {/* CARD  */}
                    <div className='w-full md:w-full lg:w-full h-fit  md:h-[350px] items-end flex flex-wrap mt-8 '>


                        <div 
                        style={{
                          'boxShadow': '0px 12px 40px 0px rgba(25, 33, 61, 0.05)'
                        }}
                        className=' w-full  bg-white flex flex-wrap py-4 px-8  rounded-[32px] '>

                          <div className='w-full flex flex-wrap justify-left'>
                            <span className='  text-[#444444] text-[24px]  font-semibold '>Set Family Size</span>
                          </div>

                    
                          <div className='w-full grid grid-cols-4 py-4 mt-4 gap-x-4 border rounded-[16px] p-[16px] border-[#F2F7FD]'>

                            <div onClick={() => { setFamilyNo(2)} } className={( familyNo == 2 ? ' bg-[#1B9AAF]  text-white ' : ' text-[#444444] bg-white ') + ' w-full rounded-[8px] font-semibold text-[20px] p-[8px] flex justify-center items-center cursor-pointer'}>2</div>
                            <div onClick={() => { setFamilyNo(3)} } className={( familyNo == 3 ? ' bg-[#1B9AAF]  text-white ' : ' text-[#444444] bg-white ') +' w-full rounded-[8px] font-semibold text-[20px] p-[8px] flex justify-center items-center cursor-pointer'}>3</div>
                            <div onClick={() => { setFamilyNo(4)} } className={( familyNo == 4 ? ' bg-[#1B9AAF]  text-white ' : ' text-[#444444] bg-white ') +' w-full rounded-[8px] font-semibold text-[20px] p-[8px] flex justify-center items-center cursor-pointer'}>4</div>
                            <div onClick={() => { setFamilyNo(5)} } className={( familyNo == 5 ? ' bg-[#1B9AAF]  text-white ' : ' text-[#444444] bg-white ') +' w-full rounded-[8px] font-semibold text-[20px] p-[8px] flex justify-center items-center cursor-pointer'}>5</div>
                            {/* <div onClick={() => { setFamilyNo(6)} } className={( familyNo == 6 ? ' bg-[#1B9AAF]  text-white ' : ' text-[#444444] bg-white ') +' w-full rounded-[8px] font-semibold text-[20px] p-[8px] flex justify-center items-center cursor-pointer'}>6</div> */}
                          
                        
                          </div>

                          <div className='w-full flex flex-wrap border rounded-[16px] p-[16px] border-[#F2F7FD] mt-4'>
                            <div className='w-full flex flex-nowrap'>
                                <div className='w-full font-bold grow text-[#444444] text-[18px]'>Annual</div>
                                <div className='w-fit  font-semibold flex-none text-[#FF0004] text-[18px]'><span className='line-through text-[#888888] font-normal'>{getPrice()}</span> {getPriceDiscount()}฿</div>
                            </div>
                            <div className='w-full flex flex-nowrap'>
                                <div className='w-full font-bold grow text-[#444444] text-[18px]'>Membership</div>
                                <div className='w-fit  font-normal flex-none text-[#888888] text-[14px]'>As low as</div>
                            </div>
                          </div>

                          <div className='w-full flex  justify-center flex-wrap mt-4'>
                      
                            <div 
                            onClick={() => { handlePay() }}
                            className='w-full py-2 px-4 items-center flex flex-nowrap bg-[#1B9AAF] cursor-pointer rounded-[40px]'>

                              <div className='w-full justify-center grow flex flex-wrap'>

                                <span className='w-full flex text-white justify-start font-bold text-lg'>Continue</span>

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
  );
}
