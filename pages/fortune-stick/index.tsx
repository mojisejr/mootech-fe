import BoxInfo from '@/components/box-info';
import HeaderMuMate from '@/components/header-v2';
import Menu from '@/components/menu';
import ModalAIChat from '@/components/modal-ai-chat';
import ModalAIChatStreamingGeneral from '@/components/modal-ai-chat-general-streaming';
import ModalBlocking from '@/components/modal-blocking';
import { FortuneStickGet } from '@/constants/api/api-fortune-stick-get';
import { FortuneTellingGet } from '@/constants/api/api-fortune-telling-get';
import { HeavenSpiritCardGet } from '@/constants/api/api-heaven-spirit-card-get copy';
import { UserGetById } from '@/constants/api/api-user-get';
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


  const [isShowChat, setIsShowChat] = useState<boolean>(false)

  const [isDisable, setIsDisable] = useState<boolean>(false)
  const [isLimitation, setIsLimitation] = useState<boolean>(true)



  const [startWordChat, setStartWordChat] = useState<string>('')


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
  const [cardNo, setCardNo] = useState<any>('')

  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)

  const [isShowFortune, setIsShowFortune] = useState<boolean>(false)
   const fallback = '/images/mumate/ic_avatar.svg' 
    const [imgSrc, setImgSrc] = useState(displayImage || fallback)
  

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(PageRouter.HOME)
    } else {
      setIsLogin(true)
    }
  }, [status, session]);



    const getUserDetail = async (userId: string ) => {
      const result = await UserGetById(userId)
      if (result && result.payment) {
        if (result.payment.is_not_expired == true) {
          setIsLimitation(false)
        } else {
          if (result.payment.total_fortune >= result.payment.limit_fortune) {
            setIsLimitation(true)
          } else {
            setIsLimitation(false)
          }
        }
      } else {
          setIsLimitation(true)
  
      }
    }

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

      getUserDetail(dataId)

    } else {
      router.replace(PageRouter.HOME)
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
    const result = await FortuneTellingGet(userId)

    if (result && result.id) {
      setFortuneInfo(result)
      

      if (result) {
        setCardNo(result.no)
        // setStartWordChat(`คุณอยากรู้เรื่องอะไรบ้าง เกี่ยวกับคำทำนายใบที่ ${result.no}`)
      }

      setIsShowFortune(true)
    } else {
      setIsDisable(true)
    }
  }

  const onCloseChat = () => {
    setIsShowChat(false)
  }


  const onClickBlockClose = () => {
    setIsDisable(false)
  }


  const onClickBlockRegister = () => {
    setIsDisable(false)

    router.replace(PageRouter.PACKAGE_PRICE)
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
      <div className='w-full flex flex-wrap'>
          <HeaderMuMate isShowMenu={isShowMenu} isLogin={isLogin} image={imgSrc}  />
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
                      disabled={isLimitation}
                      onClick={() => { onSubmit() }}
                      className={ ( isLimitation ? ' bg-gray-200  ' : ' bg-moumate_blue cursor-pointer ') + " w-full rounded-[16px] py-[16px] px-[16px]  shadow-md text-white justify-center"}
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

                  <span className='w-full text-moumate_blue text-2xl flex justify-center text-center font-medium'>คำทำนายเซียมซี</span>

                </div>

                <div className='w-full flex justify-center'>
                  <div className='w-[600px] h-[600px] relative mt-5'>
                    <Image
                      src={fortuneInfo?.image}
                      fill
                      alt='mascot'
                      className=' rounded-[40px] '
                    />
                  </div>
                </div>

                <div className='w-full flex flex-wrap'>

                  <span className='w-full text-black text-lg flex justify-center text-left px-6 mt-4'>
                    {fortuneInfo?.message_from_heaven}
                  </span>

                </div>








                          


                <div className='w-full flex flex-wrap mt-0 lg:mt-4'>
             
                    <div className='w-full flex flex-wrap justify-center  mt-4 lg:mt-0'>
                
                      <button
                        disabled={isLimitation}
                        onClick={ () => { onSubmit() }}
                        className={ ( isLimitation ? '  bg-gray-200 ' : ' bg-[#1455A4]  cursor-pointer ') + " w-full md:w-[250px] h-[60px]  rounded-[16px] py-[16px] px-[16px]  shadow-md text-white justify-center"}>
                        กดเพื่อเสี่ยงเซียมซี อีกครั้ง
                      </button>
                 
            
                       </div>
                </div>



              </div>
          </div>
        :
          null
      }
      
      {/* {
        cardNo != '' ?

      <div className=' fixed  right-0 bottom-0 m-6'>
                  <div className='w-[60px] h-[60px] relative mt-5'>
                    <Image
                      src='/images/icons/ic_ai_chat.svg'
                      fill
                      alt='mascot'
                      onClick={() => { setIsShowChat(true) }}
                      className=' cursor-pointer '
                    />
                  </div>
      </div>
      :
      null
      } */}

      {
        isShowChat  ?
          <ModalAIChatStreamingGeneral 
            user_id={userId}        
            onClose={onCloseChat}
          />
        :
          null
      }
      {
        isDisable ?
          <ModalBlocking onSubmitOK={onClickBlockClose} onGoSubscribe={onClickBlockRegister} />
        :
        null
      }
    </div>
  );
}
