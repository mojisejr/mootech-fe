import ScreenLoading from '@/components/screen-loading';
import HeaderMuMate from '@/components/header-v2';
import { UserMatchingGetApi } from '@/constants/api/api-user-matching-get';
import { UserMatchingReCalculateApi } from '@/constants/api/api-user-matching-re-calculate';
import { CONFIG } from '@/constants/config';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from 'react-cookie';
import { useCurrentUser } from '@/lib/auth/use-current-user';


export default function MatchingResultPage() {

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
    CookieKey.REFCODE_FGF,
    CookieKey.LOGIN_PROVIDER,
    CookieKey.MATCHING_ID,
  ])




  const geMatchingType = (type: string) => {
    if (type == 'LOVE') {
      return 'ดวงสมพงศ์ในฐานะคู่รัก'
    } else if (type == 'BOSS') {
      return 'ดูความสมพงศ์กับเจ้านาย'
    } else if (type == 'EMPLOYEE') {
      return 'ดูความสมพงศ์กับลูกน้อง'
    } else if (type == 'FRIEND') {
      return 'ดูความสมพงศกับเพื่อนร่วมงาน'
    }
  }




  const [isLogin, setIsLogin] = useState<boolean>(false)

  const callApiUserMatchingGetDetail = async (userId: any) => {
     const result =  await UserMatchingGetApi(userId)
     if (result) {
      setList(result)
     }
  }

  const router = useRouter();
  const callback = router.query.callback as string || '/';
  const { data: session, status } = useSession();
  const { userId: authUserId, status: authStatus } = useCurrentUser();

  const [userId, setUserId] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')
  const [displaySurname, setDisplaySurname] = useState<string>('')
  const [displayImage, setDisplayImage] = useState<string>('')
  const [accountName, setAccountName] = useState<string>('')

  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)

  const [list, setList] = useState<any[]>([])

   const fallback = '/images/mumate/ic_avatar.svg' 
    const [imgSrc, setImgSrc] = useState(displayImage || fallback)


  // Identity guard: wait while id cookie hydrates, redirect only when truly anon.
  // #mootech-identity-guard-sweep
  useEffect(() => {
    if (authStatus === "anon") {
      router.replace(PageRouter.HOME)
    } else if (authStatus === "authed") {
      setIsLogin(true)
    }
  }, [authStatus]);



    useEffect(() => {
      if (authStatus !== "authed") return

      setUserId(authUserId)
      setDisplaySurname(cookies[CookieKey.MEMBER_SURNAME])
      setDisplayImage(cookies[CookieKey.MEMBER_IMAGE])
      setAccountName(cookies[CookieKey.MEMBER_NAME])
      setImgSrc(cookies[CookieKey.MEMBER_IMAGE])

      callApiUserMatchingGetDetail(authUserId)
  }, [authStatus, authUserId])





  // ✅ Loading — hold until identity resolves so we never flash/bounce
  if (authStatus !== "authed") {
    return <ScreenLoading />;
  }



  const gotoLoginWith = () => {
    router.push(PageRouter.LOGIN_WITH)
  }



  const getResultAnalyticScore = (result: any) => {
     if (result) {
      const analytic = JSON.parse(result)

      if (analytic) {

        const data = analytic.result.score
        if (data) {
          return data
        }
      }
    }

    return 0
  }

  const getResultAnalyticRatingDesc = (result: any) => {
     if (result) {
      const analytic = JSON.parse(result)
      if (analytic) {
        const data = analytic.result.rating.note
        if (data) {
          return data
        }
      }
    }

    return ''
  }


  const onSelectLog = async (matchingId: string) => {
  
    const result = await UserMatchingReCalculateApi(matchingId)

    if (result) {
          
      setCookie(CookieKey.MATCHING_ID, result.matching_id, {
        path: '/',
        maxAge: CONFIG.EXPIRED_TIME_COOKIE,
        sameSite: true,
      })

      router.replace(PageRouter.MATCHING_RESULT)
    }
  }

  return (
    <div 
    className="w-full bg-[#F2F7FD]  min-h-screen flex justify-center h-fit font-prompt">
      <Head>
        <title>Mumate</title>
      </Head>

      <div className="w-full  block md:flex flex-wrap">
      <div className='w-full flex flex-wrap'>
          <HeaderMuMate isShowMenu={isShowMenu} isLogin={isLogin} image={imgSrc}  />
        </div>


        <div className="flex justify-center w-full flex-wrap mt-[60px] md:mt-[30px]">
          <div className="w-full lg:w-[600px] flex  px-[32px] flex-wrap">
            <div className="w-full flex-wrap">


              <div className='w-full flex flex-wrap'>
  
               <div className='w-full flex flex-wrap'>

                  <div className='w-full flex flex-wrap justify-center mt-6'>

                     <Image
                        alt="icon-sparkles"
                        src={"/images/mumate/Sparkles.svg"}
                        width={37}
                        height={37}
                      />

                  </div>

                  <span className='w-full flex flex-wrap justify-center text-center text-[#1B9AAF] text-[32px] font-semibold'>ดูดวงสมพงศ์ล่าสุด</span>
                </div>


                {
                  list.map(function(item, index){
                    return (

                        <div 
                        key={index}
                        onClick={() => { onSelectLog(item.id) }}
                        className='w-full flex flex-nowrap mb-6  cursor-pointer pl-[60px] pr-[24px] py-[24px] rounded-[16px]  bg-white'>

                      

                          <div className='w-fit flex flex-none justify-center items-center  h-[40px]'>

                          

                            <div className='w-full  relative flex justify-center  pb-[20px]'>

                              {
                                item.user &&  item.user.picture ?
          
                                  <div className=' flex  -ml-[20px]  absolute z-40 rounded-full w-[40px] h-[40px] bg-black'>
                                      <Image
                                          alt="icon-next"
                                          src={item.user.picture}
                                          width={40}
                                          height={40}
                                          className=' rounded-full '
                                        />
                                  </div>
                                :
          
                                <div className=' flex  -ml-[20px]  absolute z-40 rounded-full w-[40px] h-[40px] bg-black'>
                                  
                                </div>
                              }
                              {
                                item.friend &&  item.friend.picture ?
          
                                  <div className=' flex ml-[20px]  absolute z-40 rounded-full w-[40px] h-[40px] bg-black'>
                                      <Image
                                          alt="icon-next"
                                          src={item.friend.picture}
                                          width={40}
                                          height={40}
                                          className=' rounded-full '
                                        />
                                  </div>
                                :
                                <div className=' flex ml-[20px]  absolute z-40 rounded-full w-[40px] h-[40px] bg-black'>
                                  
                                </div>
                              }
                            </div>

                          </div>

                          <div className='w-full grow flex-wrap flex  items-center pl-[48px]  '>
                              <span className=' text-sm text-[#444444] w-full flex justify-start'>{ geMatchingType(item.type)}</span>
                              <span className=' text-xl w-full flex justify-start'>คุณ & { item.friend ? item.friend.name : 'เพื่อน'}</span>
          

                          </div>


                      
                      
                        </div>

                    )
                  })
                }


                


         





              </div>



            </div>
          </div>

        </div>


   
      </div>


     
    </div>
  );
}
