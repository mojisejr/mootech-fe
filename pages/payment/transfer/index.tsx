"use client";
import HeaderMuMate from '@/components/header-v2';
import Menu from '@/components/menu';
import ModalPayment from '@/components/modal-payment';
import ModalPaymentCreditCard from '@/components/modal-payment-creditcard';
import ModalPaymentPromptPay from '@/components/modal-payment-qrcode';
import { FortuneStickGet } from '@/constants/api/api-fortune-stick-get';
import { PaymentCreateApi } from '@/constants/api/api-payment-create';
import { API } from '@/constants/api/endpoint';
import { CONFIG } from '@/constants/config';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { callApiUpload } from '@/utils/fetch';
import { signOut, useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from 'react-cookie';


export default function PaymentTransferPage() {

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

  const [userId, setUserId] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')
  const [displaySurname, setDisplaySurname] = useState<string>('')
  const [displayImage, setDisplayImage] = useState<string>('')
  const [accountName, setAccountName] = useState<string>('')

  const [paymentPlan, setPaymentPlan] = useState<string>('')
  const [paymentPackage, setPaymentPackage] = useState<string>('')
  const [paymentPackageName, setPaymentPackageName] = useState<string>('')
  const [paymentAmount, setPaymentAmount] = useState<string>('')



  const [file, setFile] = useState<any>(null)
  const [date, setDate] = useState<any>(null)
  const [time, setTime] = useState<any>(null)
  const [amount, setAmount] = useState<any>(null)
  const [email, setEmail] = useState<any>(null)

  
        const fallback = '/images/mumate/ic_avatar.svg' 
    const [imgSrc, setImgSrc] = useState(displayImage || fallback)



  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)

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


    const dataPlan = cookies[CookieKey.PAYMENT_PLAN]
    const dataPackage = cookies[CookieKey.PAYMENT_PACKAGE]
    const dataPackageName = cookies[CookieKey.PAYMENT_PACKAGE_NAME]
    const dataAmount = cookies[CookieKey.PAYMENT_AMOUNT]

    if (dataId) {
 
      setUserId(dataId)

            // setDisplayName(dataName)
      setDisplaySurname(dataSurName)
      setDisplayImage(dataImage)
      setImgSrc(dataImage)

      setAccountName(dataName)


      setPaymentPlan(dataPlan)
      setPaymentPackage(dataPackage)
      setPaymentPackageName(dataPackageName)
      setPaymentAmount(dataAmount)

    }
    
  
  },  [
        cookies[CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME, CookieKey.MEMBER_SURNAME, CookieKey.MEMBER_IMAGE, CookieKey.MEMBER_REFER_CODE,
          CookieKey.PAYMENT_PLAN, CookieKey.PAYMENT_PACKAGE, CookieKey.PAYMENT_PACKAGE_NAME, CookieKey.PAYMENT_AMOUNT
        ]
      ]
  )

 
  // ✅ Loading
  if (status === "loading") {
    return <p>Loading...</p>;
  }


  const gotoLoginWith = () => {
    router.push(PageRouter.LOGIN_WITH)
  }
  



const onChangeFile = (e: any) => {
  if (!e.target.files || e.target.files.length === 0) return;
  const selectedFile = e.target.files[0];
  setFile(selectedFile);
}
const onChangeDate = (e: any) => {
  setDate(e.target.value)
}
const onChangeTime = (e: any) => {
  setTime(e.target.value)
  
}
const onChangeAmount = (e: any) => {
  setAmount(e.target.value)
}
const onChangeEmail = (e: any) => {
  setEmail(e.target.value)
}



const isValidate = () => {

  if (!file) {
    return false
  }

  if (!date) {
    return false
  }

  if (!time) {
    return false
  }

  if (!amount) {
    return false
  }

  if (!email) {
    return false
  }

  return true
}



const onSubmit = async () => {

  const user = userId;
  const fileSlip = file;
  const plan = paymentPlan;
  const packageCode = paymentPackage;
  const packageName = paymentPackageName;




    const formData = new FormData();
    formData.append("file", fileSlip);
    const response = await callApiUpload(
          API.object_storage.upload_slip, 
          'POST', 
          '',
          formData,
          );
    if (response.s3_key) {


      setCookie(CookieKey.PAYMENT_EMAIL, email, {
        path: '/',
        maxAge: CONFIG.EXPIRED_TIME_COOKIE,
        sameSite: true,
      })

      await PaymentCreateApi(
        user,
        plan,
        packageCode,
        packageName,
        paymentAmount,
        response.s3_key,
        date,
        time,
        amount,
        email,
      )
      router.replace(PageRouter.PAYMENT_THANKYOU)
    }


  // 
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
            className="flex bg-[#F2F7FD] justify-center  w-fit  h-full flex-wrap mt-[60px] lg:mt-[60px]">
              <div className="w-full  lg:w-full   pt-[60px] flex-wrap">
                <div className='w-full flex flex-wrap items-start'>


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
                            <div className='w-full   flex-wrap grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-10 justify-center   py-[30px] '>
                        


                                {/* CARD  */}
                                <div className='w-full md:w-full lg:w-full h-fit  md:h-[350px] items-end flex flex-wrap '>


                                    <div 
                                    style={{
                                      'boxShadow': '0px 12px 40px 0px rgba(25, 33, 61, 0.05)'
                                    }}
                                    className=' w-full  bg-white flex flex-wrap py-4 px-8  rounded-[32px] '>


                                
                                      <div className='w-full flex flex-wrap py-4'>

                                          <div className="w-full flex flex-wrap justify-center  border-b  border-[#F2F7FD]  py-4 ">
                                            <Image
                                                src={'/images/mumate/mumate_qrcode.JPG'}
                                                width={200}
                                                height={350}
                                                alt='qrcode-promtpay'
                                              />
                                          </div>

                                          {/* <div className="w-full flex flex-nowrap mt-2 ">
                                            <span className='w-fit flex-none'>ชื่อบัญชี :</span>
                                            <span className='w-full grow justify-end  flex font-semibold text-[#444444] text-[18px]'>Accounting Name</span>
                                        
                                          </div>
                                          <div className="w-full flex flex-nowrap mt-2 ">
                                            <span className='w-fit flex-none'>ธนาคาร :</span>
                                            <span className='w-full grow  justify-end  flex font-semibold text-[#444444] text-[18px]'>Bank name</span>
                                        
                                          </div>
                                          <div className="w-full flex flex-nowrap mt-2 ">
                                            <span className='w-fit flex-none'>เลขบัญชี :</span>
                                            <span className='w-full grow  justify-end  flex font-semibold text-[#444444] text-[18px]'>xxx-xxx-xxxxx</span>
                                        
                                          </div> */}


                                          <div className="w-full flex flex-wrap mt-8 ">

                                            <span className='w-full text-lg font-medium'>{paymentPackageName}</span>
                                          </div>


                                          <div className="w-full flex flex-wrap mt-2 ">

                                            <span className='w-1/2'>ราคารวม</span>

                                            <span className='w-1/2 justify-end  flex font-semibold text-[#444444] text-[18px]'>{paymentAmount}฿</span>
                                          
                                          </div>


                                      
                                    
                                      </div>


                                  </div>

                                </div>



                                {/* CARD  */}
                                <div className='w-full md:w-full lg:w-full h-fit  md:h-[350px] items-end flex flex-wrap '>


                                    <div 
                                    style={{
                                      'boxShadow': '0px 12px 40px 0px rgba(25, 33, 61, 0.05)'
                                    }}
                                    className=' w-full  bg-white flex flex-wrap py-4 px-8  rounded-[32px] '>
                                      <div className='w-full flex flex-wrap py-2'>

                                        <div className="w-full flex flex-wrap">
                                          <span className=" font-ibm font-medium text-[16px] text-moumate_black">ไฟล์หลักฐานการโอน</span> 
                                          <span className=" font-ibm font-normal text-[16px] text-moumate_gray pl-2">*</span>
                                        </div>
                                         <div className="w-full flex flex-wrap">
                                             <input 
                                              onChange={(e) => { onChangeFile(e) } }
                                              className={"  bg-moumate_white  w-full  border border-gray-200 p-[8px] rounded-[10px]"}
                                              type="file" />
                                         </div>

                                      </div>

                                      <div className='w-full md:w-1/2 pr-0 md:pr-2 flex flex-wrap py-2'>

                                        <div className="w-full flex flex-wrap">
                                          <span className=" font-ibm font-medium text-[16px] text-moumate_black">วันที่โอน</span> 
                                          <span className=" font-ibm font-normal text-[16px] text-moumate_gray pl-2">*</span>
                                        </div>
                                         <div className="w-full flex flex-wrap">
                                             <input 
                                              value={date}
                                              onChange={(e) => { onChangeDate(e) } }
                                              className={"  bg-moumate_white  w-full  border border-gray-200 p-[8px] rounded-[10px]"}
                                              type="date" />
                                         </div>

                                      </div>

                                      <div className='w-full md:w-1/2 pl-0 md:pl-2 flex flex-wrap py-2'>

                                        <div className="w-full flex flex-wrap">
                                          <span className=" font-ibm font-medium text-[16px] text-moumate_black">เวลา</span> 
                                          <span className=" font-ibm font-normal text-[16px] text-moumate_gray pl-2">*</span>
                                        </div>
                                         <div className="w-full flex flex-wrap">
                                             <input 
                                              value={time}
                                              onChange={(e) => { onChangeTime(e) } }
                                              className={"  bg-moumate_white  w-full  border border-gray-200 p-[8px] rounded-[10px]"}
                                              type="time" />
                                         </div>

                                      </div>

                                      <div className='w-full md:w-1/2 pr-0 md:pr-2  flex flex-wrap py-2'>

                                        <div className="w-full flex flex-wrap">
                                          <span className=" font-ibm font-medium text-[16px] text-moumate_black">จำนวนเงิน</span> 
                                          <span className=" font-ibm font-normal text-[16px] text-moumate_gray pl-2">*</span>
                                        </div>
                                         <div className="w-full flex flex-wrap">
                                             <input 
                                              value={amount}
                                              onChange={(e) => { onChangeAmount(e) } }
                                              className={"  bg-moumate_white  w-full  border border-gray-200 p-[8px] rounded-[10px]"}
                                              type="text" />
                                         </div>

                                      </div>



                                      <div className='w-full  md:w-1/2 pl-0 md:pl-2 flex flex-wrap py-2'>

                                        <div className="w-full flex flex-wrap">
                                          <span className=" font-ibm font-medium text-[16px] text-moumate_black">E-mail</span> 
                                          <span className=" font-ibm font-normal text-[16px] text-moumate_gray pl-2">*</span>
                                        </div>
                                         <div className="w-full flex flex-wrap">
                                             <input 
                                              value={email}
                                              onChange={(e) => { onChangeEmail(e) } }
                                              className={"  bg-moumate_white  w-full  border border-gray-200 p-[8px] rounded-[10px]"}
                                              type="text" />
                                         </div>

                                      </div>

                                      <div className='w-full flex flex-wrap py-2'>
                                          <button
                                          disabled={!isValidate()}
                                          onClick={() => { onSubmit() }}
                                          className={
                                            ( isValidate() ? ' bg-[#1B9AAF] border-[#1B9AAF] ' : ' bg-gray-200 border-gray-200 ' ) + 
                                            'w-full  cursor-pointer rounded-[40px] border-2  py-[10px] px-[27px] '}
                                          >

                                            <span className='text-white font-bold '>ส่งหลักฐานชำระเงิน</span>

                                          </button>
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
