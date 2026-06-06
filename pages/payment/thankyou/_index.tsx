"use client";
import Menu from '@/components/menu';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from 'react-cookie';


export default function PaymentThankyouPage() {

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
    CookieKey.REFCODE_FGF,
    CookieKey.LOGIN_PROVIDER
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


  const [isShowFaq1, setIsShowFaq1] = useState<boolean>(false)
  const [isShowFaq2, setIsShowFaq2] = useState<boolean>(false)
  const [isShowFaq3, setIsShowFaq3] = useState<boolean>(false)
  const [isShowFaq4, setIsShowFaq4] = useState<boolean>(false)
  const [isShowFaq5, setIsShowFaq5] = useState<boolean>(false)

  

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
  

 
  const onSubmit = () => {

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
                                  <span className='w-full flex flex-wrap justify-center text-[#1B9AAF] text-center leading-10 text-[32px]  mt-4 font-semibold'>Thank you</span>
                                  <span className='w-full flex flex-wrap justify-center text-[#6B7280] text-center  text-[16px] font-normal mt-4'>Your payment has been successfully processed</span>


                          



                                
                                </div>



                              </div>



                            </div>

                            {/* CARD COLUMN */}
                            <div className='w-full  lg:hidden flex-wrap grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-10 justify-center   py-[30px] '>
                        


                                {/* CARD  */}
                                <div className='w-full md:w-full lg:w-full h-fit  md:h-[350px] items-end flex flex-wrap '>


                                  <div 
                                    style={{
                                      'boxShadow': '0px 12px 40px 0px rgba(25, 33, 61, 0.05)'
                                    }}
                                    className=' w-full  bg-white flex flex-wrap py-4 px-8  rounded-[32px] '>


                                
                                      <div className='w-full flex flex-wrap py-4'>

                                          <div className="w-full flex flex-wrap justify-center  border-b  border-[#F2F7FD] pb-4 ">
                                            <span className='w-full text-[24px] font-semibold flex justify-center text-[#1B9AAF]'>Family Code</span>
                                          </div>

                                        

                                          <div className="w-full flex flex-wrap mt-6 justify-center items-center ">

                                            <span className=' font-semibold text-[32px] text-[#444444] '>110-253</span>


                                            <Image
                                              src={'/images/mumate/ic_copy_link.svg'}
                                              width={16}
                                              height={16}
                                              alt='coppy'
                                              className='ml-4 cursor-pointer'
                                            />  
                                           
                                            
                                          </div>


                                          
                                    
                                      </div>


                                  </div>


                                  <div 
                                    style={{
                                      'boxShadow': '0px 12px 40px 0px rgba(25, 33, 61, 0.05)'
                                    }}
                                    className=' w-full  bg-white flex flex-wrap py-4 px-8  rounded-[32px] mt-6 '>


                                
                                      <div className='w-full flex flex-wrap py-4'>

                                          <div className="w-full flex flex-wrap justify-center  border-b  border-[#F2F7FD] pb-4 ">
                                            <span className='w-full text-[16px] font-medium flex justify-start text-[#444444]'>Order Summary</span>
                                          </div>

                                        

                                          <div className="w-full flex flex-nowrap   border-b  border-[#F2F7FD] py-4 ">
                                            <div className='w-fit flex-none flex flex-wrap items-center'>
                                              <span className='w-fit text-[16px] font-normal flex justify-start text-[#888888]'>Payment Method</span>
                                            </div>
                                            <div className='w-full grow flex flex-wrap justify-end items-center'>
                                              <span className='w-fit text-[16px] font-medium flex justify-start text-black'>PromptPay</span>
                                            </div>
                                          </div>

                                          <div className="w-full flex flex-nowrap   border-b  border-[#F2F7FD] py-4 ">
                                            <div className='w-fit flex-none flex flex-wrap items-center'>
                                              <span className='w-fit text-[16px] font-normal flex justify-start text-[#888888]'>Date & Time</span>
                                            </div>
                                            <div className='w-full grow flex flex-wrap justify-end items-center'>
                                              <span className='w-fit text-[16px] font-medium flex justify-start text-black'>28/11/25 11:20</span>
                                            </div>
                                          </div>

                                          <div className="w-full flex flex-nowrap   border-[#F2F7FD] py-4 ">
                                            <div className='w-fit flex-none flex flex-wrap items-center'>
                                              <span className='w-fit text-[16px] font-normal flex justify-start text-[#888888]'>Total Amount</span>
                                            </div>
                                            <div className='w-full grow flex flex-wrap justify-end items-center'>
                                              <span className='w-fit text-[16px] font-medium flex justify-start text-black'>499฿</span>
                                            </div>
                                          </div>

                                        <div 
                                        className='w-full mt-[20px] justify-center flex flex-wrap'>
                                                              
                                              <div
                                              onClick={ () =>  { onSubmit() }}
                                              className='w-full flex-none flex items-center mt-4 md:mt-0'
                                              >
                                                <div 
                                                className='w-full  py-2 px-4 items-center flex flex-nowrap bg-[#1B9AAF] cursor-pointer rounded-[40px]'>
                        
                                                  <div className='w-full grow flex justify-center flex-wrap'>
                        
                                                    <span className=' text-[#ffffff] justify-center font-bold text-lg'>ไปหน้าอธิบายดูดวง</span>
                        
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
