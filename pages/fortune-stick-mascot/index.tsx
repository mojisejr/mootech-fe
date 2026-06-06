import BoxInfo from '@/components/box-info';
import Menu from '@/components/menu';
import { FortuneStickGet } from '@/constants/api/api-fortune-stick-get';
import { CONFIG } from '@/constants/config';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { signOut, useSession } from "next-auth/react";
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
    CookieKey.LOGIN_PROVIDER
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


  const [fortuneInfo, setFortuneInfo] = useState<any>(null)

  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)

  const [isShowFortune, setIsShowFortune] = useState<boolean>(false)

  

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(PageRouter.HOME)
    } else {
      setIsLogin(true)
    }
  }, [status, session]);



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




  const onSubmit = async () => {
    setIsShowFortune(false)
    const result = await FortuneStickGet(userId)
    setFortuneInfo(result)

    setIsShowFortune(true)
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

      <div className="w-full block md:flex flex-wrap">
        <div className='w-full relative'>
          <div className='w-full z-50 fixed top-0 left-0 h-[60px] flex items-center px-4 flex-nowrap'>
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


        <div className="flex justify-center w-full flex-wrap mt-[60px] md:mt-[30px]">
          <div className="w-full lg:w-[400px] flex items-center px-[32px] flex-wrap">
            <div className="w-full flex-wrap">


              <div className='w-full flex flex-wrap'>
  
                <div className='w-full flex flex-wrap'>
                  <span className='w-full flex flex-wrap justify-center text-white text-[32px] font-semibold'>เสี่ยงทายเซียมซี</span>
                  <span className='w-full flex flex-wrap justify-center text-center text-white text-[16px]'>
                    ตั้งจิตให้เป็นสมาธิ  1 นาที <br/>ขอตั้งจิตอธิษฐานถามคำถามที่อยากได้คำตอบ
                  </span>
                </div>



              </div>



            </div>
          </div>

          {/* Responsive images */}
          <div className="w-fit flex lg:flex flex-wrap lg:items-center mt-[60px] md:mt-0  mb-[90px]">
            <div className='w-fit relative'>
                <div className='w-fit flex flex-wrap'>
                  <div className="w-full flex lg:hidden items-end">
                    <div className="flex md:hidden lg:hidden w-full">
                      <Image
                        alt="mootech-icon"
                        src={"/images/icons/image_fortune_stick.svg"}
                        width={280}
                        height={400}
                      />
                    </div>

                    <div className="hidden md:flex lg:hidden w-full">
                      <Image
                        alt="mootech-icon"
                        src={"/images/icons/image_fortune_stick.svg"}
                        width={400}
                        height={600}
                      />
                    </div>
                  </div>

                  <div className="hidden lg:flex w-full h-fit">
                    <Image
                      alt="mootech-icon"
                      src={"/images/icons/image_fortune_stick.svg"}
                      width={322}
                      height={420}
                    />
                  </div>
                </div>

                  <div className='w-fit absolute bottom-0 left-1/2 -translate-x-1/2 z-40 mb-6 mb:mb-24 flex'>
                    <button
                      onClick={() => { onSubmit() }}
                      className="w-full rounded-[16px] py-[16px] px-[16px] bg-moumate_blue shadow-md text-white justify-center"
                    >
                      กดเพื่อเสี่ยงเซียมซี
                    </button>
                  </div>
            </div>
          </div>
        </div>


          <div className='relative  md:hidden h-[60px]  w-full'>

            <Image
              src={'/images/icons/image_fortune_stick_footer.svg'}
              fill
              alt='path'
            />


          </div>
          

          <span className='w-full my-6 text-white flex justify-center text-lg md:text-xl'>© MOOTECH DESTINY CO., LTD.</span>

      </div>

      {
        isShowFortune ?
          <div className='w-full flex flex-wrap fixed top-0 left-0 z-50  justify-center h-full  overflow-y-auto'>
              <div className='w-full lg:w-[600px] bg-white  rounded-t-[48px] py-6 px-4  animate-slide-up'>

                <div className='w-full flex flex-wrap justify-end'>

                  <Image
                    src={'/images/icons/ic_close_blue.svg'}
                    width={40}
                    height={40}
                    alt='close'
                    onClick={() => { setIsShowFortune(false) }}
                    className=' cursor-pointer '
                  />

                </div>

                <div className='w-full flex flex-wrap'>

                  <span className='w-full text-moumate_blue text-2xl flex justify-center text-center font-medium'>คำทำนายเซียมซี<br/>ใบที่ {fortuneInfo?.id}</span>

                </div>

                <div className='w-full flex justify-center'>
                  <div className='w-[230px] h-[300px] relative mt-5'>
                    <Image
                      src={fortuneInfo?.url}
                      fill
                      alt='mascot'
                      className=' rounded-[40px] '
                    />
                  </div>
                </div>

                <div className='w-full flex flex-wrap'>

                  <span className='w-full text-black text-lg flex justify-center text-left px-6 mt-4'>
                    {fortuneInfo?.person}
                  </span>

                </div>


                <div className='w-full flex flex-wra mt-4p'>

                  <div className="w-full flex flex-wrap">
                    <BoxInfo 
                      icon={'/images/mumate/ic_box_4.svg'} 
                      topic={'หน้าที่การงาน'} 
                      note={fortuneInfo?.work} 
                    />
                  </div>

                </div>


                <div className='w-full flex flex-wra mt-4p'>

                  <div className="w-full flex flex-wrap">
                    <BoxInfo 
                      icon={'/images/mumate/ic_box_2.svg'} 
                      topic={'การเงิน'} 
                      note={fortuneInfo?.wealth} 
                    />
                  </div>

                </div>


                <div className='w-full flex flex-wra mt-4p'>

                  <div className="w-full flex flex-wrap">
                    <BoxInfo 
                      icon={'/images/mumate/ic_box_9.svg'} 
                      topic={'สุขภาพ'} 
                      note={fortuneInfo?.health} 
                    />
                  </div>

                </div>


                <div className='w-full flex flex-wra mt-4p'>

                  <div className="w-full flex flex-wrap">
                    <BoxInfo 
                      icon={'/images/mumate/ic_box_8.svg'} 
                      topic={'ความรัก'} 
                      note={fortuneInfo?.love} 
                    />
                  </div>

                </div>


                <div className='w-full flex flex-wra mt-4p'>

                  <div className="w-full flex flex-wrap">
                    <BoxInfo 
                      icon={'/images/mumate/ic_box_9.svg'} 
                      topic={'ครอบครัว'} 
                      note={fortuneInfo?.family} 
                    />
                  </div>

                </div>




                <div className='w-full flex flex-wra mt-4p'>

                  <div className="w-full flex flex-wrap">
                    <BoxInfo 
                      icon={'/images/mumate/ic_box_9.svg'} 
                      topic={'สิ่งศักดิ์สิทธิ์'} 
                      note={fortuneInfo?.sacred_item} 
                    />
                  </div>

                </div>






                          


                <div className='w-full flex flex-wrap mt-0 lg:mt-4'>
                    <div className='w-full lg:w-1/2 flex flex-wrap justify-center mt-8 lg:mt-0'>
                        <a
                    href={fortuneInfo?.url_share}
                    target='_blank'
                    className='w-full'
                          rel="noopener noreferrer">    
                      <button
                        className="w-full md:w-[250px] h-[60px] rounded-[16px] py-[16px] px-[16px] bg-moumate_blue  shadow-md text-white justify-center"
                      >
                        แชร์คำทำนาย
                      </button>
                      </a>
                    </div>
                    <div className='w-full lg:w-1/2 flex flex-wrap justify-center  mt-4 lg:mt-0'>
                
                      <button
                        onClick={ () => { }}
                        className="w-full md:w-[250px] h-[60px]  rounded-[16px] py-[16px] px-[16px] bg-[#1455A4]  shadow-md text-white justify-center"
                      >
                        กดเพื่อเสี่ยงเซียมซี อีกครั้ง
                      </button>
                 
            
                       </div>
                </div>



              </div>
          </div>
        :
          null
      }
      
    </div>
  );
}
