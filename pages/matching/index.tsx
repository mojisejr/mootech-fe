import ScreenLoading from '@/components/screen-loading';
import ErrorToast from '@/components/error-toast';
import HeaderMuMate from '@/components/header-v2';
import ModalAddFriend from '@/components/modal-add-freind';
import ModalAIChatStreamingGeneral from '@/components/modal-ai-chat-general-streaming';
import BaziChatLauncher from '@/components/bazi-chat-launcher';
import ModalBlocking from '@/components/modal-blocking';
import ModalSelectFriend from '@/components/modal-select-freind';
import { UserGetById } from '@/constants/api/api-user-get';
import { UserMatchingCalculateApi } from '@/constants/api/api-user-matching-calculate';
import { CONFIG } from '@/constants/config';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from 'react-cookie';


export default function MatchingPage() {

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
    CookieKey.REFCODE_FGF,
    CookieKey.LOGIN_PROVIDER,
    CookieKey.MATCHING_ID
  ])

  const [isLogin, setIsLogin] = useState<boolean>(false)

  const [isDisable, setIsDisable] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [isLimitation, setIsLimitation] = useState<boolean>(true)

  const [isShowChat, setIsShowChat] = useState<boolean>(false)

  const [isShowModalSelectFriend, setIsShowModalSelectFriend] = useState<boolean>(false)
  const [isShowModalAddFriend, setIsShowModalAddFriend] = useState<boolean>(false)
  const [isShowModalSelectMatching, setIsShowModalSelectMatching] = useState<boolean>(false)

  const router = useRouter();
  const callback = router.query.callback as string || '/';
  const { data: session, status } = useSession();

  const [userId, setUserId] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')
  const [displaySurname, setDisplaySurname] = useState<string>('')
  const [displayImage, setDisplayImage] = useState<string>('')
  const [accountName, setAccountName] = useState<string>('')
  const [infoReferCode, setInfoReferCode] = useState<string>('')



  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)



  const [friendId, setFriendId] = useState<string>('')
  const [friendName, setFriendName] = useState<string>('')
  const [friendSurname, setFriendSurname] = useState<string>('')
  const [friendPic, setFriendPic] = useState<string>('')

  

  const [matchingType, setMatchingType] = useState<string>('LOVE')
  const [matchingTypeDesc, setMatchingTypeDesc] = useState<string>('')

      const fallback = '/images/mumate/ic_avatar.svg' 
    const [imgSrc, setImgSrc] = useState(displayImage || fallback)


  const getUserDetail = async (userId: string ) => {
    const result = await UserGetById(userId)
    // Gate the add-friend button on the friend QUOTA only, mirroring the backend
    // (member-with-friend.service: free users get limit_friend=1, paid=20, enforced in
    // createMemberWithFriend). The old code required is_not_expired===true first, which
    // wrongly blocked every free/expired user from adding even their first allowed friend —
    // limit_friend already encodes the plan (1 free / 20 paid). #mootech-matching-add-friend
    const payment = result?.payment
    if (payment && typeof payment.limit_friend === 'number') {
      setIsLimitation(payment.total_friend >= payment.limit_friend)
    } else {
      setIsLimitation(true) // no payment data (or API error) -> safe default: blocked
    }
  }



  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(PageRouter.HOME)
    } else {
      setIsLogin(true)
    }

    removeCookie(CookieKey.MATCHING_ID)
  }, [status, session]);



    useEffect(() => {


  
    const dataId = cookies[CookieKey.MEMBER_ID]
    const dataName = cookies[CookieKey.MEMBER_NAME]
    const dataSurName = cookies[CookieKey.MEMBER_SURNAME]
    const dataImage = cookies[CookieKey.MEMBER_IMAGE]

    const dataReferCode = cookies[CookieKey.MEMBER_REFER_CODE]

    if (dataId) {
 
      setUserId(dataId)
      setDisplaySurname(dataSurName)
      setDisplayImage(dataImage)
      setImgSrc(dataImage)

      setAccountName(dataName)
      setInfoReferCode(dataReferCode)

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
    return <ScreenLoading />;
  }


  const gotoLoginWith = () => {
    router.push(PageRouter.LOGIN_WITH)
  }


  const onClickSelectFriend = () => {
    setIsShowModalSelectFriend(true)
  }


  const onClickAddFriend = () => {
    setIsShowModalSelectFriend(false)

    setIsShowModalAddFriend(true)
  }

  const onCloseAddFriend = () => {
    setIsShowModalAddFriend(false)

  }

  const onCloseSelectFriend = () => {
    setIsShowModalSelectFriend(false)
  }

  const onClickMatching = (id: string, name: string, surname: string, picture: string, disable: boolean) => {

    if (disable == false) {
      setFriendId(id)
      setFriendName(name)
      setFriendSurname(surname)    
      setFriendPic(picture)
      setIsShowModalSelectFriend(false)
    }
  }


  const onClickFriendDetail = (id: string, name: string, surname: string, picture: string) => {
    router.push(PageRouter.FRIEND_PROFILE.replaceAll(':friend_id', id))
  }
  

  const isValidate = () => {

    if (friendId == '') {
      return false
    }
    if (matchingType == '') {
      return false
    }


    return true;
  }

  const onSubmitCalculate = async () => {
    if (isDisable == true) {
      return
    }
    if (!userId || !friendId || !matchingType) {
      return
    }


    const result = await UserMatchingCalculateApi(userId, friendId, matchingType)

    // BE returns { matching_id } on success. A genuine membership/limit gate returns an
    // AI code (402 EXPIRED / 403 NO_PLAN / 404 OUT_OF_LIMIT, inside the HTTP 410 body).
    // Anything else (500 / network / unknown) is a real backend error — do NOT mislabel
    // it as "please subscribe". #mootech-mysql-pg-migration-audit
    const GATE_CODES = [402, 403, 404]
    if (result && result.matching_id) {
      setCookie(CookieKey.MATCHING_ID, result.matching_id, {
        path: '/',
        maxAge: CONFIG.EXPIRED_TIME_COOKIE,
        sameSite: true,
      })
      router.replace(PageRouter.MATCHING_RESULT)
    } else if (result && GATE_CODES.includes(result.code)) {
      setIsDisable(true)
    } else {
      setErrorMsg('ระบบไม่สามารถคำนวณได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง')
    }
  }

   const onClickBlockClose = () => {
    setIsDisable(false)
  }


  const onClickBlockRegister = () => {
    setIsDisable(false)

    router.replace(PageRouter.PACKAGE_PRICE)
  }

  const onCloseChat = () => {
    setIsShowChat(false)
  }

  return (
    <div 
    className="w-full bg-[#F2F7FD]  min-h-screen flex justify-center h-fit font-prompt">
      <Head>
        <title>Mumate</title>
      </Head>

      <div className="w-full  block md:flex flex-wrap">
        {/* <div className='w-full bg-[#1B9AAF]  relative '>
          <div className='w-full z-50 bg-[#1B9AAF]  fixed top-0 left-0 h-[60px] flex items-center px-4 flex-nowrap'>
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

        </div> */}
      <div className='w-full flex flex-wrap'>
          <HeaderMuMate isShowMenu={isShowMenu} isLogin={isLogin} image={imgSrc}  />
        </div>

        <div className="flex justify-center w-full flex-wrap mt-[60px] md:mt-[30px]">
          <div className="w-full lg:w-[400px] flex items-center px-[32px] flex-wrap">
            <div className="w-full flex-wrap">


              <div className='w-full  flex-wrap'>
  
                <div className='w-full flex flex-wrap'>

                  <div className='w-full flex flex-wrap justify-center mt-6'>

                     <Image
                        alt="icon-sparkles"
                        src={"/images/mumate/Sparkles.svg"}
                        width={37}
                        height={37}
                      />

                  </div>

                  <span className='w-full flex flex-wrap justify-center text-[#1B9AAF] text-[48px] font-semibold'>ดวงสมพงศ์</span>
                  <span className='w-full flex flex-wrap justify-center text-center text-[#444444] text-[16px]'>
                    เลือกโปรไฟล์สองโปรไฟล์เพื่อดูดวงสมพงศ์<br/>ด้านความความรักหรือมิตรภาพ
                  </span>
                </div>


                <div className='w-full flex flex-wrap mt-6'>

                  <div className='w-full flex flex-nowrap'>
                    {
                      displayImage ?

                        <div className=' flex flex-none rounded-full w-[60px] h-[60px] bg-black'>
                           <Image
                                alt="icon-next"
                                src={imgSrc}
                                width={60}
                                height={60}
                                className=' rounded-full '
                                onError={() => setImgSrc(fallback)}
                              />
                        </div>
                      :

                      <div className=' flex flex-none rounded-full w-[60px] h-[60px] bg-black'>
                        
                      </div>
                    }


                    <div className='w-full flex grow px-4'>
                        <div className='w-full flex flex-nowrap  bg-black rounded-[40px] py-[16px] px-[24px]'>

                          <span className=' w-full grow text-white'>คุณ</span>

                          <div className='w-fit flex flex-none'>
                             {/* <Image
                                alt="icon-next"
                                src={"/images/mumate/ic_next_white.svg"}
                                width={24}
                                height={24}
                              /> */}

                          </div>

                        </div>


                    </div>

                  </div>



                </div>

                <div className='w-full flex flex-wrap mt-4'>

                  <div className='w-full flex flex-nowrap'>
                    {
                      friendPic ?
                        <div className=' flex flex-none rounded-full w-[60px] h-[60px] bg-black'>
                           <Image
                                alt="icon-next"
                                src={friendPic}
                                width={60}
                                height={60}
                                className=' rounded-full '
                              />
                        </div>
                      :

                      <div className=' flex flex-none rounded-full w-[60px] h-[60px] bg-black'>
                        
                      </div>

                    }


                    <div 
                    
                    onClick={ () => { onClickSelectFriend() }}
                    className='w-full flex grow px-4'>
                        <div className='w-full flex flex-nowrap  cursor-pointer bg-black rounded-[40px] py-[16px] px-[24px]'>

                          <span className=' w-full grow text-white'>{ friendId ? `${friendName} ${friendSurname}` : 'เลือกเพื่อน/คู่รัก'}</span>

                          <div className='w-fit flex flex-none'>
                             <Image
                                alt="icon-next"
                                src={"/images/mumate/ic_next_white.svg"}
                                width={24}
                                height={24}
                              />

                          </div>

                        </div>


                    </div>

                  </div>



                </div>



                <div className='w-full flex flex-wrap mt-4'>

                  <div className='w-full flex flex-wrap'>

                    <div className='w-full flex flex-wrap '>
                  
                        <div
                        className='w-full flex flex-wrap  '
                        >
                          <select
                            value={matchingType}
                            onChange={(e) => { setMatchingType(e.target.value) }}
                            className='w-full flex bg-[#D4F8F9] rounded-[40px] py-[16px] px-[24px] pr-4'
                          >

                            <option value={'LOVE'}>ดวงสมพงศ์ในฐานะคู่รัก</option>
                            <option value={'BOSS'}>ดูความสมพงศ์กับเจ้านาย</option>
                            <option value={'EMPLOYEE'}>ดูความสมพงศ์กับลูกน้อง</option>
                            <option value={'FRIEND'}>ดูความสมพงศกับเพื่อนร่วมงาน</option>
                        

                          </select>

                        </div>


                    </div>

                  </div>

                </div>


                <div className='w-full flex flex-wrap mt-4'>

                  <div className='w-full flex flex-wrap'>

                    <div className='w-full flex flex-wrap '>
                        <div 
                        
                        onClick={() => { onSubmitCalculate() }}
                        className={
                          (
                            isValidate() ? ' cursor-pointer  bg-[#1B9AAF] ' : '  bg-gray-200 '
                          
                          ) + 
                          'w-full flex flex-nowrap  rounded-[40px] py-[16px] px-[24px]'}>

                          <span className=' w-full grow flex justify-center text-white font-medium'>ดูผลลัพท์เลย</span>


                        </div>


                    </div>

                  </div>

                </div>


                <div className='w-full flex flex-wrap mt-4'>

                  <div className='w-full flex flex-wrap'>

                    <div className='w-full flex flex-wrap '>

                          <span 
                          onClick={() => { router.push(PageRouter.MATCHING_RECENT) }}
                          className=' w-full  cursor-pointer flex justify-center text-[#1B9AAF] underline '>ดูดวงสมพงศ์ล่าสุด</span>



                    </div>

                  </div>

                </div>



              </div>



            </div>
          </div>

        </div>


           {
              userId && process.env.NEXT_PUBLIC_ENABLE_CHAT !== 'false' ?

                // <div className=' fixed z-[90]  right-0 bottom-0 m-6'>
                //             <div className='w-[60px] h-[60px] relative mt-5'>
                //               <Image
                //                 src='/images/icons/ic_ai_chat.svg'
                //                 fill
                //                 alt='mascot'
                //                 onClick={() => { setIsShowChat(true) }}
                //                 className=' cursor-pointer '
                //               />
                //             </div>
                // </div>
                <div className="fixed right-0 bottom-0 m-6 z-50">
                  <div
                    onClick={() => setIsShowChat(true)}
                    className="relative w-[90px] h-[90px] rounded-2xl cursor-pointer overflow-hidden"
                  >
                    {/* gradient 1 */}
                    <div
                      className="absolute inset-0 animate-fade1"
                      style={{
                        background: "linear-gradient(243.43deg, #FF0000 0%, #FF8800 83.33%)",
                      }}
                    />

                    {/* gradient 2 */}
                    <div
                      className="absolute inset-0 animate-fade2"
                      style={{
                        background: "linear-gradient(332.45deg, #1B9AAF 0%, #FF00EE 143.46%)",
                      }}
                    />

                    {/* glow */}
                    <div
                      className="absolute inset-0 blur-xl opacity-70"
                      style={{
                        boxShadow: "0px 0px 20px rgba(56,59,231,0.7)",
                      }}
                    />

                    {/* content */}
                    <div className="relative flex flex-col items-center justify-center h-full text-white">
                      <span className="text-lg">✨</span>
                      <span className="text-xs font-semibold">MATE AI</span>
                    </div>
                  </div>
                </div>
            :
            null
            }
   
      </div>

      
      {
        isShowModalAddFriend ? 
          <ModalAddFriend userId={userId} name={''} image={''} refer_code={''} provider={''} onClose={onCloseAddFriend} onSubmitOK={undefined} />
        :
        null
      }
   
      {
        isShowModalSelectFriend ? 
          <ModalSelectFriend 
            isLimitation={isLimitation}
            onClickAddFriend={onClickAddFriend} onClose={onCloseSelectFriend} userId={userId} onClickMatching={onClickMatching} referCode={infoReferCode} 
            onClickFriendDetail={onClickFriendDetail} />
        :
        null
      }

      {
        isDisable ?
          <ModalBlocking onSubmitOK={onClickBlockClose} onGoSubscribe={onClickBlockRegister} />
        :
        null
      }

      <ErrorToast message={errorMsg} onClose={() => setErrorMsg('')} />



      <BaziChatLauncher />

      {
          isShowChat && process.env.NEXT_PUBLIC_ENABLE_CHAT !== 'false' ?
          <ModalAIChatStreamingGeneral
            user_id={userId}
            onClose={onCloseChat}
          />
        :
          null
      }
     
    </div>
  );
}
