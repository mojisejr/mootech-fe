"use client";
import Menu from '@/components/menu';
import { API } from '@/constants/api/endpoint';
import { CONFIG } from '@/constants/config';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from 'react-cookie';


export default function PaymentCreditCardPage() {

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



  const [isLogin, setIsLogin] = useState<boolean>(false)

  const router = useRouter();
  const callback = router.query.callback as string || '/';
  const { data: session, status } = useSession();

  const [userId, setUserId] = useState<any>('')
  const [displayName, setDisplayName] = useState<any>('')
  const [displaySurname, setDisplaySurname] = useState<any>('')
  const [displayImage, setDisplayImage] = useState<any>('')
  const [accountName, setAccountName] = useState<any>('')


  const [email, setEmail] = useState<any>('')


  const [fortuneInfo, setFortuneInfo] = useState<any>(null)

  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)


  const [no, setNo] = useState<any>('')
  const [name, setName] = useState<any>('')
  const [expDate, setExpDate] = useState<any>('')
  const [cvv, setCVV] = useState<any>('')
  const [isRememberCard, setIsRememberCard] = useState<boolean>(false)

  const [paymentPackageName, setPaymentPackageName] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState<string>('')
  const [paymentPackage, setPaymentPackage] = useState<string>('')

  const [messageError, setMessageError] = useState<string>('')

  

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

    }
    
  
  },  [
        cookies[CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME, CookieKey.MEMBER_SURNAME, CookieKey.MEMBER_IMAGE, CookieKey.MEMBER_REFER_CODE, CookieKey.PAYMENT_PACKAGE_NAME, CookieKey.PAYMENT_AMOUNT, CookieKey.PAYMENT_PACKAGE
        ]
      ]
  )


const onChangeEmail = (e: any) => {
  setEmail(e.target.value)
}

 
  // ✅ Loading
  if (status === "loading") {
    return <p>Loading...</p>;
  }


  const gotoLoginWith = () => {
    router.push(PageRouter.LOGIN_WITH)
  }

  const formatCreditCard = (value: string) => {
    // เอา non-digit ออก
    const digits = value.replace(/\D/g, '').slice(0, 16)

    // แบ่งทุก 4 หลัก
    return digits.replace(/(.{4})/g, '$1 ').trim()
  }

  const formatExpDate = (value: string) => {
  // เอา non-digit ออก
  let digits = value.replace(/\D/g, '').slice(0, 4)

  // ถ้ามีมากกว่า 2 หลัก ใส่ /
  if (digits.length > 2) {
    digits = digits.slice(0, 2) + '/' + digits.slice(2)
  }

  return digits
}

  const onChangeNo = (event: any) => {
    const formatted = formatCreditCard(event.target.value)
    setNo(formatted)
  }
  const onChangeName = (event: any) => {
    setName(event.target.value)
  }
  const onChangeExpDate = (event: any) => {
    const formatted = formatExpDate(event.target.value)
    setExpDate(formatted)
  }
  const onChangeCVV = (event: any) => {
    const value = event.target.value
      .replace(/\D/g, '') // เอา non-digit ออก
      .slice(0, 3)        // จำกัด 3 หลัก

    setCVV(value)
  }
  const onChangeIsRememberCard = (event: any) => {
    setIsRememberCard(!isRememberCard)
  }


  const onSubmit = async () => {
    if (isValid()) {
          const expDateArray = expDate.split('/')
          await callOmiseCreditCard(
            name,
            no,
            expDateArray[0],
            (parseInt(expDateArray[1]) + 2000) +'',
            cvv,
            paymentAmount
          )
    }
  }

  // CREDIT CARD
  const callOmiseCreditCard = (
  name: string,
  number: string,
  expMonth: string,
  expYear: string,
  cvv: string,
  amount: any,
) => {


    window.Omise.createToken(
      "card",
      {
        name,
        number,
        expiration_month: expMonth,
        expiration_year: expYear,
        security_code: cvv,
      },
      function (status: any, response: any) {
        if (status === 200) {
          handleCharge(response.id, amount,);
        } else {
          setMessageError('ไม่สามารถทำรายการกรุณาลองใหม่อีกครั้ง')
        }
      }
    );
  };

  const handleCharge = async (token: any, amount: number) => {
    const res = await fetch(API.payment.pay_via_credit_card, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: token,
        amount: amount, // ยอดเงิน (บาท)
        email: email,
        user_id: userId,
        payment_by: 'CREDIT_CARD',
        package_code: paymentPackage,
      }),
    });
  
    const data = await res.json();
    if (data && data.charge && data.charge.id) {
      window.location.href = data.charge.authorize_uri
    }
  };
  

  const isValid = () => {
    if ( !name || name == '' ) {
      return false
    }
    if ( !no || no == '' ) {
      return false
    }

    if ( !expDate || expDate == '' ) {
      return false
    }

    if ( !cvv || cvv == '' ) {
      return false
    }

    if ( !email || email == '' ) {
      return false
    }


    return true
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
                    <div className="w-full flex-wrap ">
                      <div className=" w-full flex flex-wrap pb-[120px] justify-center   px-[32px]">
                          <div className='w-full flex flex-wrap justify-center'>

                                <div className='w-full flex flex-wrap justify-center'>
                    
                                  <div className='w-full flex flex-wrap justify-center'>
                                    <span className='w-full flex flex-wrap justify-center text-[#1B9AAF] text-center leading-10 text-[32px] font-semibold'>คำสั่งซื้อ</span>

                                  </div>



                                </div>
                          </div>



                          {/* CARD COLUMN */}
                          <div className='w-full   flex-wrap  flex justify-center  mt-6'>
                      


                              {/* CARD  */}
                              <div className='w-full md:w-[600px] lg:w-[600px] h-fit  md:h-[350px] items-end flex flex-wrap '>


                                  <div 
                                  style={{
                                    'boxShadow': '0px 12px 40px 0px rgba(25, 33, 61, 0.05)'
                                  }}
                                  className=' w-full  bg-white flex flex-wrap py-4 px-8  rounded-[32px] '>


                              
                                    <div className='w-full flex flex-wrap py-4 '>


                                        <div className="w-full flex flex-wrap ">
                                          <div className='w-1/2  flex-wrap'>

                                              <Image  
                                                src={'/images/mumate/visa-card.png'}
                                                width={130}
                                                height={16}
                                                alt='visa-mastercard'
                                                />

                                          </div>
                                          <div className='w-1/2 flex justify-end flex-wrap'>

                                              <Image  
                                                src={'/images/mumate/secureant.png'}
                                                width={88}
                                                height={24}
                                                alt='visa-mastercard'
                                                />

                                          </div>
                                        </div>

                                        <div className="w-full flex flex-wrap mt-4 ">
                                          <div className="w-full flex flex-wrap">
                                            <span className="font-ibm font-medium text-[16px] text-moumate_black">
                                              หมายเลขบัตรเครดิต
                                            </span>
                                            <span className="font-ibm font-medium text-[16px] text-moumate_red pl-1">
                                              *
                                            </span>
                                          </div>
                                          <div className="w-full flex flex-wrap">
                                            <input
                                              value={no}
                                              inputMode="numeric"
                                              placeholder="1234 5678 9012 3456"
                                              onChange={(e) => { onChangeNo(e) }}
                                              className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                                              type="text"
                                            />
                                          </div>
                                        </div>

                                        <div className="w-full flex flex-wrap mt-6 ">
                                          <div className="w-full flex flex-wrap">
                                            <span className="font-ibm font-medium text-[16px] text-moumate_black">
                                              ชื่อผู้ถือบัตร
                                            </span>
                                            <span className="font-ibm font-medium text-[16px] text-moumate_red pl-1">
                                              *
                                            </span>
                                          </div>
                                          <div className="w-full flex flex-wrap">
                                            <input
                                              value={name}
                                              onChange={(e) => { onChangeName(e) }}
                                              className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                                              type="text"
                                            />
                                          </div>
                                        </div>

                                        <div className="w-full grid grid-cols-2 gap-6 flex-wrap mt-6 ">

                                                <div className="w-full flex flex-wrap">
                                                  <div className="w-full flex flex-wrap">
                                                    <span className="font-ibm font-medium text-[16px] text-moumate_black">
                                                      วันหมดอายุ
                                                    </span>
                                                    <span className="font-ibm font-medium text-[16px] text-moumate_red pl-1">
                                                      *
                                                    </span>
                                                  </div>
                                                  <div className="w-full flex flex-wrap">
                                                    <input
                                                      value={expDate}
                                                      placeholder='MM/YY'
                                                      onChange={(e) => { onChangeExpDate(e) }}
                                                      className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                                                      type="text"
                                                    />
                                                  </div>
                                                </div>

                                                <div className="w-full flex flex-wrap">
                                                  <div className="w-full flex flex-wrap">
                                                    <span className="font-ibm font-medium text-[16px] text-moumate_black">
                                                      CVV
                                                    </span>
                                                    <span className="font-ibm font-medium text-[16px] text-moumate_red pl-1">
                                                      *
                                                    </span>
                                                  </div>
                                                  <div className="w-full flex flex-wrap">
                                                    <input
                                                      value={cvv}
                                                      placeholder='123'
                                                      onChange={(e) => { onChangeCVV(e) }}
                                                      className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                                                      type="text"
                                                    />
                                                  </div>
                                                </div>
                                        </div>

                                        {/* <div 
                                          className="mt-[12px] border-b border-[#F2F7FD] flex flex-wrap w-full bg-moumate_white  p-[8px] rounded-[10px] items-center"
                                          >
                                            <input 
                                            
                                            checked={isRememberCard}
                                            onChange={(e) => { onChangeIsRememberCard(e) }}
                                            type="checkbox" />
                                            <span
                                            
                                            className=" font-ibm  text-[16px] text-moumate_black pl-1"
                                            >
                                              บันทึกบัตรนี้สำหรับการทำธุรกรรมในอนาคต
                                            </span>
                                        </div> */}


                                

                                        <div 
                                        className='w-full mt-[20px] justify-center flex flex-wrap'>
                                                              
                                              <div
                                              onClick={ () =>  { onSubmit() }}
                                              className='w-full flex-none flex items-center mt-4 md:mt-0'
                                              >
                                                <div 
                                                className={
                                                  ( isValid()  ? ' cursor-pointer bg-[#1B9AAF]  ' : '  bg-gray-400 ') +
                                                  ' w-full  py-2 px-4 items-center flex flex-nowrap  rounded-[40px]'}>
                        
                                                  <div className='w-full grow flex justify-center flex-wrap'>
                        
                                                    <span className=' text-[#ffffff] justify-center font-bold text-lg'>ยืนยันข้อมูลบัตร</span>
                        
                                                  </div>
                        
                                                  <div className='w-fit flex flex-nowrap pl-4'>
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

                                        <div 
                                        className='w-full mt-[18px] justify-center flex flex-wrap'>
                                          
                                                  <span className='w-full flex justify-center text-red-600 text-sm'>{messageError}</span>

                                        </div>

                                                                              <div className="w-full flex flex-wrap mt-4 ">
                                          <div className='w-full flex justify-center  flex-wrap'>

                                              <Image  
                                                src={'/images/mumate/omise.png'}
                                                width={280}
                                                height={20}
                                                alt='visa-mastercard'
                                                />

                                          </div>
                                        </div>
                                  
                                    </div>


                                </div>

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


    </div>
  );
}
