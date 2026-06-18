import BoxChineseTable from "@/components/box-chinese-table";
import BoxInfo from "@/components/box-info";
import HologramScale from "@/components/hologram-scale";
import ModalComingSoon from "@/components/modal-coming-soon";
import ModalFriendGetFriend from "@/components/modal-friend-get-friend";
import { ChineseHoroscopeGet } from "@/constants/api/api-chinese-horoscope-get";
import { UserGetById } from "@/constants/api/api-user-get";
import { CookieKey } from "@/constants/cookie-key";
import { PageRouter } from "@/constants/router";
import { useSession } from "next-auth/react";
import getConfig from "next/config";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCookies } from "react-cookie";
import { LogSaveImageInsert } from "@/constants/api/api-log-save-image-insert";
import { CompatibilityLoveCheck } from "@/constants/api/api-check-compatibility-love";
import { CompatibilityWorkCheck } from "@/constants/api/api-check-compatibility-work";
import Menu from "@/components/menu";
import ModalAIChatStreamingGeneral from "@/components/modal-ai-chat-general-streaming";
import { ChineseElement } from "@/constants/chinese-element";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import ScreenLoading from "@/components/screen-loading";

export default function ResultPage() {

  const { publicRuntimeConfig } = getConfig()

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
  ])

  const router = useRouter();

    const { data: session, status } = useSession();
    const { userId: authUserId, status: authStatus } = useCurrentUser();
    const [userId, setUserId] = useState<string>('')
    const [displayName, setDisplayName] = useState<string>('')
    const [displaySurname, setDisplaySurname] = useState<string>('')
    const [displayImage, setDisplayImage] = useState<string>('')
    const [referCode, setReferCode] = useState<string>('')

    const [totalPoint, setTotalPoint] = useState<string>('0')
    const [usedPoint, setUsedPoint] = useState<string>('0')
    
    const [imageUrl, setImageUrl] = useState<string>('')
    const fallback = '/images/mumate/ic_avatar.svg' 
    const [imgSrc, setImgSrc] = useState(displayImage || fallback)


    const [isShowToolTipFinance, setIsShowToolTipFinance ] = useState<boolean>(false)
    const [isShowToolTipCustomer, setIsShowToolTipCustomer ] = useState<boolean>(false)
    const [isShowToolTiEducation, setIsShowToolTipEducation ] = useState<boolean>(false)
    const [isShowToolTipFriendly, setIsShowToolTipFriendly ] = useState<boolean>(false)
    const [isShowToolTipKnowledge, setIsShowToolTipKnowledge ] = useState<boolean>(false)

    const [isShowChat, setIsShowChat] = useState<boolean>(false)


    const [isOpenMenu, setIsOpenMenu] = useState<boolean>(false)

 
    const [isShowMenu, setIsShowMenu] = useState<boolean>(false)
    const [isLogin, setIsLogin] = useState<boolean>(false)
    

    const loveSection = useRef(null);
    const workSection = useRef(null);
    const checkSection = useRef(null);
    
  
    // Single auth guard (see lib/auth/use-current-user.ts). Redirect ONLY when
    // truly anonymous; while `loading` do nothing so we never bounce mid-hydration.
    useEffect(() => {
      if (authStatus === "anon") {
        router.replace(PageRouter.LOGIN)
      } else if (authStatus === "authed") {
        setIsLogin(true)
      }
    }, [authStatus]);


  // Data-ready gate: hold the page until the main content (horoscope) has loaded,
  // so the page doesn't render empty sections before the data arrives.
  const [destinyLoaded, setDestinyLoaded] = useState<boolean>(false)

  const [resultHoroscope, setResultHoroscope] = useState<any>(null)
  const [resultPower, setResultPower] = useState<any>(null)
  const [resultSummary, setResultSummary] = useState<any>(null)
  const [resultLife, setResultLife] = useState<any>(null)
  const [myElement, setMyElement] = useState<any>(null)


  const [isShowLogin, setIsShowLogin] = useState<boolean>(true)
  

  const [isShowComingSoon, setIsShowComingSoon] = useState<boolean>(false)

  const [isShowFGF, setIsShowFGF] = useState<boolean>(false)
  
  
  const [code, setCode] = useState<any>(null)
  const [linkRefer, setLinkRefer] = useState<any>(null)

  useEffect(() => {


  if (code && userId) {
    callGetResult(userId, code)
  }
    

  }, [code, userId])

  // Load user data ONLY once identity is resolved — never UserGetById(undefined).
  useEffect(() => {
    if (authStatus !== "authed") return

    setUserId(authUserId)
    setIsShowLogin(false)
    setDisplayName(cookies[CookieKey.MEMBER_NAME])
    setDisplaySurname(cookies[CookieKey.MEMBER_SURNAME])
    setReferCode(cookies[CookieKey.MEMBER_REFER_CODE])
    setLinkRefer(publicRuntimeConfig.NEXT_STATIC_NEXTAUTH_URL+'/login?callback=' + cookies[CookieKey.MEMBER_REFER_CODE])

    callApiGetUser(authUserId)
  }, [authStatus, authUserId])

const callApiGetUser = async (user_id: string) => {
  try {
    const result = await UserGetById(user_id);
    if (result && result.user_id) {

       // New-user guardrail: no birth data yet → complete the profile first
       // (avoids landing on empty feature pages with nothing to compute).
       if (!result.dob) {
         router.replace(PageRouter.PROFILE_EDIT)
         return
       }

       setCode(result.result_code)

        // Only replace the avatar with a truthy value — never flicker to placeholder.
        if (result.picture_url) {
          setDisplayImage(result.picture_url)
          setImgSrc(result.picture_url)
        }

        setTotalPoint(result.total_point)
        setUsedPoint(result.used_point)

        if (result.is_refresh == true) {
          router.replace(PageRouter.HOME)
          return
        }

        // No chart to fetch → page is ready now. Otherwise the [code,userId]
        // effect will fetch the horoscope and release the gate in callGetResult.
        if (!result.result_code) {
          setDestinyLoaded(true)
        }
    } else {
      setDestinyLoaded(true)
    }
  } catch {
    setDestinyLoaded(true)
  }
}


  const callGetResult = async (userId: any, code: any) => {

    const result = await ChineseHoroscopeGet( userId, code)
    if (result && result.data) {

      const data = result.data
      setResultHoroscope(data)

      const power = data.power
      if (power) {
        setResultPower(power)
      }

      const summary = data.summary
      if (summary) {
        setResultSummary(summary)
        setMyElement(summary.element)
      }

      const analytic = data.analytic
      if (analytic) {
        const life = analytic.life
        setResultLife(life)
      }


      setImageUrl(data.share_profile_url)

      setDestinyLoaded(true)
    } else {
      router.replace(PageRouter.LOGIN)
    }
  }


  const getResultAnalyticBase = () => {
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic
      if (analytic) {
        const data = analytic.base
        if (data) {
          return data.description
        }
      }
    }

    return '-'
  }


  const getResultAnalyticYearCycle = () => {
    if (resultHoroscope) {
      const analytic = resultHoroscope.cycleYearLife
      if (analytic) {
        return analytic;
      }
    }

    return []
  }



  const getResultAnalyticStrongTopic = () => {
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic
      if (analytic) {
        const data = analytic.elemental_characteristics
        const data2 = analytic.habit
        if (data && data2) {

          const element = data2.day_above_element
          let desc = ''
          if (element == 'METAL') {
            desc += ChineseElement.METAL
          } else if (element == 'WOOD') {
            desc += ChineseElement.WOOD
          } else if (element == 'WATER') {
            desc += ChineseElement.WATER
          } else if (element == 'FIRE') {
            desc += ChineseElement.FIRE
          }else if (element == 'EARTH') {
            desc += ChineseElement.EARTH
          }


          const power = data2.power
          if (desc != '') {
            if (power == 'YIN') {
              desc += 'หยิน'
            } else if (power == 'YANG') {
              desc += 'หยาง'
            }
          }


          const level = data2.level;
          if (desc != '') {
            if (level == 'WEAK') {
              desc += 'อ่อนแอ'
            } else if (power == 'YANG') {
              desc += 'แข็งแรง'
            }
          }


          return 'ธาตุ'+desc;

        }
      }
    }

    return '-'
  }


  const getResultAnalyticStrong = () => {
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic
      if (analytic) {
        const data = analytic.elemental_characteristics
        const data2 = analytic.habit
        if (data && data2) {
          return data2.note
        }
      }
    }

    return '-'
  }
  
  const getResultAnalyticHabit = () => {
    const result: any[] = []
    let word = ''
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic

      if (analytic) {
        const raw = analytic.behaviors
        if (raw) {
          for (let i = 0; i < raw.length; i++) {
            const data = raw[i]
            result.push( <div className="w-full flex flex-wrap mb-2">
              <span className="w-full flex text-sm font-bold flex-wrap">{data.element}</span>
              <span className="w-full flex flex-wrap">{data.behavior}</span>
            </div>
            )
              word += data.behavior + '\n'
          }
        }
      }
    }

    return word
  }

    const getResultAnalyticOccupations = () => {
    const result: any[] = []
    let word = ''
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic

      

      if (analytic) {

        const raw = analytic.occupations
        if (raw) {
          
          for (let i = 0; i < raw.length; i++) {
            const data = raw[i]
            result.push(<li className=' text-black mt-2  '><span className=" font-semibold">{data.topic}</span><br/><span className="  break-words">{data.occupations}</span></li>)
            word += data.occupation + '\n'
          }
        }
      }
    }
    if (result.length > 0) {
      return <ul className="list-disc">
        {result}
      </ul>
    }

    return null
  }
  
  
  const getResultAnalyticBeCareful = () => {
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic
      if (analytic) {
        const data = analytic.be_careful
        if (data) {
          return data.description
        }
      }
    }

    return '-'
  }


  const getResultAnalyticColors = () => {
    const result: any[] = []
            const colorElement:any[] = []
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic

      if (analytic) {
        const raw = analytic.lucky_colors 
        if (raw) {
          for (let i = 0; i < raw.length; i++) {
            const data = raw[i]
            const colors = data.colors

            // 

            for (let j = 0; j < colors.length; j++) {
              colorElement.push( 
             
                   <div className='w-full flex flex-wrap items-center'>
                    <div 
                        style={{ backgroundColor: `${colors[j].hex}` }}
                    className={"w-[24px] h-[24px] bg-[" + (colors[j].hex).toUpperCase()+ "] rounded-full"}></div>
                    <span className={'pl-2 text-[12px] text-black'}>   {colors[j].name}</span>
                  </div>

              )
            }

            result.push( <div className="w-full flex flex-wrap mb-2">
              <span className="w-full flex text-sm font-bold flex-wrap">{data.element}</span>
              <div className="w-full  flex-wrap grid">
                {colorElement}
              </div>
            </div>

            )
          }
        }
      }
    }

    return colorElement
  }

  const getResultAnalyticSacredThings = () => {
      const result: any[] = []
              const sacredThingslement:any[] = []
      if (resultHoroscope) {
        const analytic = resultHoroscope.analytic
  
         if (analytic) {
          const raw = analytic.sacred_things 
          if (raw) {
            for (let i = 0; i < raw.length; i++) {
              const data = raw[i]
              const sacred_things = data.sacred_things
  
              // 
  
              for (let j = 0; j < sacred_things.length; j++) {
                sacredThingslement.push( 

                            <div className='w-[110px] h-fit flex flex-wrap items-center'>
                              <div className='w-[110px] h-[160px]'>
                                  <Image
                                    className=" rounded-[8px] "
                                    alt="mootech-box"
                                    src={sacred_things[j].url}
                                    width={110}
                                    height={160}
                                  />
                              </div>
                              <span className='mt-2 w-full text-center text-[14px] text-black'>{sacred_things[j].name}</span>
                            </div>
                )

            
              }
  
              result.push( <div className="w-full flex flex-wrap mb-2">
                <span className="w-full flex text-sm font-bold flex-wrap">{data.element}</span>
                <div className="w-full  flex-wrap grid">
                  {sacredThingslement}
                </div>
              </div>
              )
            }
          }
        }
      }
  
      return sacredThingslement
    }
    

  const getResultAnalyticLove = () => {
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic
      if (analytic) {
        const data = analytic.love
        if (data) {
          return data.note
        }
      }
    }

    return '-'
  }

    const getResultPredictionWork = () => {
    if (resultHoroscope) {

      const result: any[] = []
      const analytic = resultHoroscope.analytic
   
        if (analytic) {

            const raw = analytic.prediction_work
            if (raw) {
              const descs = raw.desc
              for (let i = 0; i < descs.length; i++) {
                const data = descs[i]
                result.push(<li className=' text-black mt-2  '><span className="  break-words">{data.note}</span></li>)
              }
            }
        }
        
        if (result.length > 0) {
          return <ul className="list-disc">
            {result}
          </ul>
        }
    }
    

    return null
  }


  const onClickShowComingSoon = useCallback(() => {
    setIsShowComingSoon(true)
  }, [])


  const onClickCloseComingSoon = () => {
    setIsShowComingSoon(false)
  }


  const onClickShowFGF = useCallback(() => {
    setIsShowFGF(true)
  }, [])


  const onClickCloseFGF = () => {
    setIsShowFGF(false)
  }



  const onClickGotoLogin = () => {
    router.push(PageRouter.LOGIN + '?callback=' + code)
  }

  const gotoSurvey = () => {
    router.push(PageRouter.SURVEY + '?callback=' + code)
  }


  const gotoShareProfile = () => {
    router.push(PageRouter.SHARE_PROFILE.replaceAll(':code', code) + '?callback='+referCode)
  }

  const gotoSave = () => {
    handleDownload();
  }

  const gotoLoveMate = (is_allow: boolean) => {
    if (is_allow) {
      router.push(PageRouter.MATCHING)
    } else {
      setIsShowFGF(true)
    }
  }


  const gotoWorkVibe = (is_allow: boolean) => {
    if (is_allow) {
      router.push(PageRouter.MATCHING)
    } else {
      setIsShowFGF(true)
    }
  }

  const getShareDisplay = (result: any) => {


    if (result) {
      if (result.analytic) {
        if (result.analytic.behaviors_for_share) {
          if (result.analytic.behaviors_for_share.length > 0) {
            return result.analytic.behaviors_for_share[0].behavior
          }
        }
      }

    }

    return null
  }

  const handleDownload = async () => {
    if (imageUrl && imageUrl != '') {
      await callApiInsertLogSave(userId);
      window.open(imageUrl, '_blank');
    }
  };

  const callApiInsertLogSave = async (user_id: string) => {
  const result = await LogSaveImageInsert(user_id)


}

const  clearToolTip = () => {
  setIsShowToolTipCustomer(false)
  setIsShowToolTipFinance(false)
  setIsShowToolTipFriendly(false)
  setIsShowToolTipEducation(false)
  setIsShowToolTipKnowledge(false)
}

const handleScroll = (refDiv: any) => {
const ref: any = refDiv.current;
window.scrollTo({
  top: ref.offsetTop,
  left: 0,
  behavior: "smooth",
});
};

const moveToLoveSection = () => {
  // handleScroll(loveSection)
    checkLoveMate();
  setIsOpenMenu(false)
}
const moveToWorkSection = () => {
  checkWorkVibe()
  // handleScroll(workSection)
  setIsOpenMenu(false)
}
const moveToCheckSection = () => {
  setIsOpenMenu(false)
}
  

const openMenu = (isOpenMenu: boolean) => {
  setIsOpenMenu(isOpenMenu)
}

  const checkLoveMate = async () => {
    const is_allow = await callApiCheckLove();
    if (is_allow) {
      router.push(PageRouter.LOVE_MATE)
    } else {
      setIsShowFGF(true)
    }
  }


  const checkWorkVibe = async () => {
    const is_allow = await callApiCheckWork();
    if (is_allow) {
      router.push(PageRouter.WORK_VIBE)
    } else {
      setIsShowFGF(true)
    }
  }

  
      const callApiCheckLove = async () => {
        const result = await CompatibilityLoveCheck(userId)
        if (result && result.status == 200) {
          return true
        } else {
          return false
        }
      }
    
  
    const callApiCheckWork = async () => {
      const result = await CompatibilityWorkCheck(userId)
      if (result && result.status == 200) {
        return true
      } else {
        return false
      }
    }
  

  const onCloseChat = () => {
    setIsShowChat(false)
  }


  const gotoLoginWith = () => {
    router.push(PageRouter.LOGIN_WITH)
  }


  const getResultElementTopic = () => {
    if (resultHoroscope) {

      const analytic = resultHoroscope.elementCycle
   
        if (analytic) {

          const element = analytic.element
          let desc = ''
          if (element == 'METAL') {
            desc += ChineseElement.METAL
          } else if (element == 'WOOD') {
            desc += ChineseElement.WOOD
          } else if (element == 'WATER') {
            desc += ChineseElement.WATER
          } else if (element == 'FIRE') {
            desc += ChineseElement.FIRE
          }else if (element == 'EARTH') {
            desc += ChineseElement.EARTH
          }
          const power = analytic.power
          if (desc != '') {
            if (power == 'YIN') {
              desc += 'หยิน'
            } else if (power == 'YANG') {
              desc += 'หยาง'
            }
          }

          return 'ธาตุ'+desc;
             
        }
    }
    

    return null
  }

  const getResultElement = () => {
        if (resultHoroscope) {

        const analytic = resultHoroscope.elementCycle
   
        if (analytic) {

            return analytic
             
        }
    }
    

    return null
  }


  // Hold the page until identity resolves AND the main content has loaded —
  // prevents rendering empty sections before the horoscope data arrives.
  if (authStatus !== "authed" || !destinyLoaded) {
    return <ScreenLoading />
  }

  return (
        <div
        className='w-full min-h-screen flex justify-center h-fit font-ibm'
        style={{
          background: 'linear-gradient(0deg, rgba(75, 150, 229, 0.05) 0%, rgba(251, 217, 226, 0.5) 132.05%)'
        }}
        >
          <Head>
        <title>Mumate</title>
      </Head>

      <div className="w-full flex flex-wrap"> 
      
                   {/* <HeaderDestiny 
                      displayImage={displayImage}
                      displayName={displayName}
                      displaySurname={displaySurname}
                      onClickWorkSection={moveToWorkSection}
                      onClickLoveSection={moveToLoveSection}
                      onClickCheckSection={moveToCheckSection} 
                      openMenu={openMenu}     
                      isOpen={isOpenMenu}              
                    /> */}
          {/* {
            isOpenMenu ?
            <div 
            style={{
              'background': 'rgba(251, 246, 250, 0.6)',
              'backdropFilter': 'blur(44px)',

            }}
            className=" fixed lg:hidden top-0 z-[90]  mt-[72px] left-0  h-full w-full">

                    <div
                    className="flex flex-wrap w-full bg-white justify-center px-4 "
                    >

                      <div 
                      onClick={moveToLoveSection}
                      className="w-full py-[24px] border-b border-gray-200 flex cursor-pointer flex-none items-center">
                        <Image
                          className=" rounded-full "
                          alt="mootech-icon"
                          src={ '/images/mumate/Pink-heart.svg'}
                          width={24}
                          height={24}
                        />

                        <span className=' ml-2 text-[#FF61A9]'>เช็คเรื่องความรัก</span>

                      
                      </div>

                      <div 
                      onClick={moveToWorkSection}
                      className="w-full  py-[24px] border-b border-gray-200 flex cursor-pointer  flex-none items-center">
                        <Image
                          className=" rounded-full "
                          alt="mootech-icon"
                          src={ '/images/mumate/Money-with-wings.svg'}
                          width={24}
                          height={24}
                        />

                        <span className=' ml-2 text-[#1B9AAF]'>เช็คเรื่องการงาน</span>

                      
                      </div>

           <a 
                    className=' w-full flex  py-[24px]  border-b border-gray-200  cursor-pointer flex-none items-center'
                    target="_blank" 

                    href="https://lin.ee/D9XSKGo" 
                    rel="noopener noreferrer">     
                      <div 
                      onClick={moveToCheckSection}
                      className="w-full flex  cursor-pointer flex-none items-center">
                        <Image
                          className=" rounded-full "
                          alt="mootech-icon"
                          src={ '/images/mumate/Crystal-ball.svg'}
                          width={24}
                          height={24}
                        />

                        <span className=' ml-2 text-[#7878DA]'>ดูดวงกับซินแส</span>

                      
                      </div>
                      </a>

                    </div>
            </div>
            :
            null
          } */}

      <div 
    
        style={{
          background: 'linear-gradient(180deg, #1B9AAF 0%, #3A78A9 100%)'
        }}
      className="w-full flex flex-wrap">

        <div className='w-full relative'>
          <div className='w-full z-50  bg-[#1B9AAF] fixed top-0 left-0 h-[60px] flex items-center px-4 flex-nowrap'>
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
                src={imgSrc}
                width={40}
                height={40}
                className=' rounded-full cursor-pointer '
                alt='icon-app' 
                onClick={() => { router.push(PageRouter.PROFILE)}}
                onError={() => setImgSrc(fallback)}
                
                />
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
        </div>
          {
              isShowMenu ?
              <div className=' w-full flex flex-wrap absolute top-0 left-0  z-50 '>
                
                <Menu is_show={isShowMenu} />
              

              </div>
              :
              null
          }

{/*
          <div className="w-full md:hidden   h-[72px] z-50 pb-[72px]  justify-center flex items-center fixed bottom-0 left-0">
            {
              imageUrl ?
                              <Image
                                  src={'/images/mumate/ic_save.svg'}
                                  width={56}
                                  height={56}
                                  onClick={ () => { gotoShareProfile() }}
                                  className=" cursor-pointer mr-3 "
                                  alt="icon-result"/>
              :
              null
            }
                              <Image
                                  src={'/images/mumate/ic_share.svg'}

                                  onClick={ () => { gotoSave() }}
                                  width={56}
                                  height={56}
                                  className="cursor-pointer"
                                  alt="icon-result"/>
          </div>
*/}

          <div 
            className="w-full min-h-full  pt-[72px] pb-[100px] md:pb-0">


            <div 
              className=" w-full  flex-wrap justify-center items-center h-full py-[32px]"
            >

                <div className="w-full flex flex-wrap justify-center">
                  <div className="w-full mx-[16px] lg:mx-0  justify-center flex-wrap flex  ">

                    <div className="w-full md:w-[400px] lg:w-[348px]  flex-wrap justify-center pr-0 lg:pr-2">
                    

                          <div className="w-full relative">

                              <div className="w-full flex md:hidden lg:flex justify-center flex-wrap ">
                                <Image
                                  src={resultSummary?.mascot?.url}
                                  width={348}
                                  height={522}
                                  className=" rounded-t-xl rounded-b-none lg:rounded-b-xl "
                                  alt="icon-result"/>
                              </div>

                              <div className="w-full  hidden md:flex lg:hidden  justify-center flex-wrap ">
                                <Image         
                                  src={resultSummary?.mascot?.url}
                                  width={400}
                                  height={522}
                                  className=" rounded-t-xl rounded-b-none lg:rounded-b-xl "
                                  alt="icon-result"/>
                              </div>

                            <span className="absolute bottom-0 font-chonburi px-5  font-bold  w-full flex justify-center left-0 mb-6 text-[32px] text-white text-center ">
                                {resultSummary?.mascot?.name}
                            </span>
                          </div>
{/*
                            <div className="hidden lg:flex w-full  justify-center mt-4 flex-wrap ">
                            {
                              imageUrl ?
                              <Image
                                  onClick={ () => { gotoShareProfile() }}
                                  src={'/images/mumate/ic_save.svg'}
                                  width={56}
                                  height={56}
                                  className=" cursor-pointer  mr-3"
                                  alt="icon-result"/>
                              :
                              null
                            }
                              <Image
                                  src={'/images/mumate/ic_share.svg'}
                                  onClick={ () => { gotoSave() }}
                                  width={56}
                                  height={56}
                                  className="cursor-pointer"
                                  alt="icon-result"/>
                            </div>
*/}

                            {/* <div className="hidden  lg:flex w-full mt-1  justify-center flex-wrap  ]">
                              <BoxFriendGetFriendInfo 
                        onSubmit={onClickShowFGF}
                              
                              />
                            </div> */}

                    </div>


                    <div className="w-[348px]   md:w-[400px] lg:w-1/2  flex-wrap justify-center pl-0 lg:pl-2">
                    

                        <div className="w-full h-fit bg-white rounded-none lg:rounded-t-[16px] p-[24px] rounded-b-[16px] flex flex-wrap ">

                          <div className="w-full flex flex-wrap mb-[20px]">
                            <HologramScale 
                            data={resultPower}
                            type="finance"
                            isShowToolTip={isShowToolTipFinance}
                            onClickToolTip={ () => {  clearToolTip(); setIsShowToolTipFinance(!isShowToolTipFinance); }}
                            description="ความสามารถในการหาเงิน หารายได้ หาทรัพย์สินเข้าตัว"
                            left_label={"สกิลเรียกทรัพย์"} left_value={0} right_label={"สายสัญชาตญาณ"} right_value={0} />
                          </div>
                          <div className="w-full flex flex-wrap mb-[20px]">
                            <HologramScale 
                            type="education"
                            data={resultPower}
                            isShowToolTip={isShowToolTiEducation}
                            onClickToolTip={ () => {  clearToolTip(); setIsShowToolTipEducation(!isShowToolTiEducation) }}
                            description="ความโดดเด่นในวงการที่เราอยู่ อาจจะมาจากการเข้าสังคม ความเก่ง หรือประสิทธิภาพของตัวเราเอง"
                            left_label={"ตัวท๊อป"} left_value={0} right_label={"สายลุยไว"} right_value={0} />
                          </div>
                          <div className="w-full flex flex-wrap mb-[20px]">
                            <HologramScale 
                            type="customer"
                            data={resultPower}
                            isShowToolTip={isShowToolTipCustomer}
                            onClickToolTip={ () => { clearToolTip();  setIsShowToolTipCustomer(!isShowToolTipCustomer) }}
                            description="การมีอิทธิพลต่อสังคมวงกว้าง คาริสม่าที่มี เราทำเราใช้อะไร คนก็เห็นดีเห็นงาม ทำตามซื้อตามด้วย"
                            left_label={"สกิลอินฟลู"} left_value={0} right_label={"สายลองของ"} right_value={0} />
                          </div>
                          <div className="w-full flex flex-wrap mb-[20px]">
                            <HologramScale 
                            type="friendly" 
                            data={resultPower}
                            isShowToolTip={isShowToolTipFriendly}
                            onClickToolTip={ () => {  clearToolTip(); setIsShowToolTipFriendly(!isShowToolTipFriendly) }}
                            description="จำนวนหรือความช่วยเหลือจากเพื่อนฝูง"
                            left_label={"เพื่อนฝูง"} left_value={0} right_label={"สายทีมเวิร์ค"} right_value={0} />
                          </div>
                          <div className="w-full flex flex-wrap">
                            <HologramScale 
                            type="knowledge" 
                            data={resultPower}
                            isShowToolTip={isShowToolTipKnowledge}
                            onClickToolTip={ () => {  clearToolTip(); setIsShowToolTipKnowledge(!isShowToolTipKnowledge) }}
                            description="ความสามารถในการเรียนรู้สิ่งต่างๆได้ง่าย อ่านหรือฟังรอบเดียวก็เข้าใจ"
                            left_label={"สกิลเรียนรู้"} left_value={0} right_label={"สายลุยเลย"} right_value={0} />
                          </div>
                        </div>


                        {/* <div className="flex  lg:hidden w-full mt-4  justify-center flex-wrap  ]">
                          <BoxFriendGetFriendInfo
                        onSubmit={onClickShowFGF}
                          />
                        </div> */}



                        <div className="w-full h-fit  flex flex-wrap mt-[24px] ">

                           <div className=" grid grid-cols-1  lg:grid-cols-3 w-full gap-5 mt-[24px]">
                            <div className="w-full flex flex-wrap">
                              <BoxInfo 
                                icon={'/images/mumate/ic_box_1.svg'} 
                                topic={'พื้นฐานบุคลิก'} 
                                note={getResultAnalyticBase()} 
                              />
                            </div>


                            <div className="w-full flex flex-wrap">
                              <BoxInfo 
                                icon={'/images/mumate/ic_box_2.svg'} 
                                topic={getResultAnalyticStrongTopic()} 
                                note={getResultAnalyticStrong()} 
                              />
                            </div>


                            <div className="w-full flex flex-wrap">
                              <BoxInfo 
                                icon={'/images/mumate/ic_box_3.svg'} 
                                topic={'นิสัย'} 
                                note={getResultAnalyticHabit()} 
                              />
                            </div>


                          </div>

                        </div>


                        <div className="w-full flex flex-wrap ">

                          <BoxChineseTable 
                            data={resultHoroscope}
                            summary={resultSummary}
                          />

                        </div>


                         <div className="w-full h-fit  flex flex-nowrap mt-[24px] ">
                              <div className="w-full  flex-wrap">
                                <div className="w-full flex flex-wrap">
                                  <BoxInfo 
                                    icon={'/images/mumate/ic_element.svg'} 
                                    topic={getResultAnalyticStrongTopic()} 
                                    elements={getResultElement()} 
                                    note={''}
                                    type="ELEMENT"
                                  />
                                </div>
                              </div>
                        </div>



                        <div className="w-full h-fit  flex flex-nowrap mt-[24px] ">

                          <div className=" grid grid-cols-1 lg:grid-cols-2 w-full gap-5">

                            <div 
                            ref={loveSection}
                            className="w-full  flex-wrap">
                              <BoxInfo 
                                user_id={userId}
                                icon={'/images/mumate/ic_box_8.svg'} 
                                topic={'ความรัก'} 
                                type="LOVE"
                                note={getResultAnalyticLove()} 
                                onActionToCalculate={gotoLoveMate}
                                current={usedPoint}
                                max={totalPoint}
                              />
                            </div>

                            <div className="w-full  flex-wrap">
                     

                              <div 
                              ref={workSection}
                              className="w-full flex flex-wrap">
                                <BoxInfo 
                                  user_id={userId}
                                  icon={'/images/mumate/ic_box_9.svg'} 
                                  topic={'การงาน'} 
                                  type="WORK"
                                  note={getResultPredictionWork()} 
                                  onActionToCalculate={gotoWorkVibe}
                                  current={usedPoint}
                                  max={totalPoint}
                                />
                              </div>
                            </div>


                          </div>

                        </div>



                        <div className="w-full h-fit  flex flex-nowrap mt-[24px] ">

                          <div className=" grid grid-cols-1 lg:grid-cols-2 w-full gap-3">

                            <div className="w-full  flex-wrap">
                              <BoxInfo 
                                icon={'/images/mumate/ic_box_4.svg'} 
                                topic={'อาชีพเด่น'} 
                                type='JOB'
                                onClickSurvey={gotoSurvey}
                                note={getResultAnalyticOccupations()} 
                              />
                            </div>

                            <div className="w-full  flex-wrap">
                              <div className="w-full flex flex-wrap">
                                <BoxInfo 
                                  icon={'/images/mumate/ic_box_5.svg'} 
                                  topic={'ข้อพึงระวัง'} 
                                  note={getResultAnalyticBeCareful()} 
                                />
                              </div>


                              <div className="w-full flex flex-wrap mt-5">
                                <BoxInfo 
                                  icon={'/images/mumate/ic_box_6.svg'} 
                                  topic={'สีมงคล'} 
                                  type='COLOR'
                                  note={''}
                                  colors={getResultAnalyticColors()} 
                                />
                              </div>
                            </div>


                          </div>

                        </div>


                        <div className="w-full h-fit  flex flex-nowrap mt-[24px] ">
                            <div className="w-full  flex-wrap">
                              <BoxInfo 
                                icon={'/images/mumate/ic_box_7.svg'} 
                                topic={'สิ่งศักดิ์สิทธิ์'} 
                                type="SCARED_THING"
                                note={''} 
                                scared_things={getResultAnalyticSacredThings()}
                              />
                            </div>
                        </div>





                        <div className="w-full h-fit  flex flex-nowrap mt-[24px] ">
                            <div className="w-full  flex-wrap">
                              <BoxInfo 
                                icon={'/images/mumate/ic_box_10.svg'} 
                                topic={'เส้นทางชีวิต (Life Path)'} 
                                note={''} 
                                type="GRAPH"
                                lifes={resultLife}
                                onActionMore={onClickShowComingSoon}
                              />
                            </div>
                        </div>


          
                        {/* <div className="w-full  flex-wrap mt-[24px]">
                     

                              <div className="w-full flex flex-wrap">
                                <ProductCatalog 
                                  element={myElement}
                                />
                            </div>
                        </div> */}


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
      

      {
        isShowComingSoon ? 
        <ModalComingSoon onSubmitOK={onClickCloseComingSoon}  />
        :
        null
      }
      {
        isShowFGF? 
          <ModalFriendGetFriend 
          code={linkRefer}
          onSubmitOK={onClickCloseFGF} />
          :
          null
      }


      {
          isShowChat && process.env.NEXT_PUBLIC_ENABLE_CHAT !== 'false' ?
          <ModalAIChatStreamingGeneral
            user_id={userId}     
            onClose={onCloseChat}
          />
        :
          null
      }

      {/* {
          isShowChat  ?
          <ModalAIChatGeneral
            user_id={userId}     
            onClose={onCloseChat}
          />
        :
          null
      } */}


    </div>
  );
}
