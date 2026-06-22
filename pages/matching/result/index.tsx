import ScreenLoading from '@/components/screen-loading';
import HeaderMuMate from '@/components/header-v2';
import { UserMatchingGetDetailApi } from '@/constants/api/api-user-matching-get-detail';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from 'react-cookie';
import { motion } from 'framer-motion';
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


  const getResultAnalyticRating = (result: any) => {
    const obj = JSON.parse(result)
     if (obj) {
      const analytic = obj.result.rating
      if (analytic) {
        const data = analytic.rating
        if (data) {
          if (data == 0) return 0
          return data / 2
        }
      }
    }

    return 0
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


  const getResultAnalytics = (result: any) => {
    const raw = JSON.parse(result)
    const raws = raw.result
    if (raws) {
        const result: any[] = []
        if (raws) {
          const analytic = raws.desc

            if (analytic) {
              
              for (let i = 0; i < analytic.length; i++) {
                const data = analytic[i]
                result.push(<li className='  break-all text-moumate_gray text-[18px] mt-2  '><span className="  break-words">{data.note}</span></li>)
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


  const callApiUserMatchingGetDetail = async (matchingId: string) => {
     setIsDataLoading(true)
     try {
       const result =  await UserMatchingGetDetailApi(matchingId)
       if (result) {
        setRating(getResultAnalyticRating(result.result))
        setPercentage(getResultAnalyticScore(result.result))
        setNote(getResultAnalyticRatingDesc(result.result))
        setDesc(getResultAnalytics(result.result))
        setUserInfo(result.user)
        setFriendInfo(result.friend)
        setResult(result.result)
        setMatchingType(result.type)
       }
     } finally {
       setIsDataLoading(false)
     }
  }

  const [isLogin, setIsLogin] = useState<boolean>(false)


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

  const fallback = '/images/mumate/ic_avatar.svg' 
  const [imgSrc, setImgSrc] = useState(displayImage || fallback)


  const [friendInfo, setFriendInfo] = useState<any>(null)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [result, setResult] = useState<any>(null)

  const [matchingId, setMatchingId] = useState<string>('')

  const [matchingType, setMatchingType] = useState<string>('')


  const [rating, setRating] = useState<number>(0)
  const [percentage, setPercentage] = useState<number>(0)
  const [note, setNote] = useState<string>('')
    const [desc, setDesc] = useState<any>(null)

  // Data-loading state — scoped to the authed branch only. Never touches the
  // identity ScreenLoading gate above. #mootech-matching-loading-ux
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true)

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

      const dataMatchingId = cookies[CookieKey.MATCHING_ID]

      setUserId(authUserId)
      setDisplaySurname(cookies[CookieKey.MEMBER_SURNAME])
      setDisplayImage(cookies[CookieKey.MEMBER_IMAGE])
      setAccountName(cookies[CookieKey.MEMBER_NAME])
      setMatchingId(dataMatchingId)
      setImgSrc(cookies[CookieKey.MEMBER_IMAGE])

      // MATCHING_ID is the matching-result handle (not identity); keep its own guard
      if (dataMatchingId) {
        callApiUserMatchingGetDetail(dataMatchingId)
      } else {
        router.replace(PageRouter.MATCHING)
      }
  },  [authStatus, authUserId, cookies[CookieKey.MATCHING_ID]])




  // ✅ Loading — hold until identity resolves so we never flash/bounce
  if (authStatus !== "authed") {
    return <ScreenLoading />;
  }



  const gotoLoginWith = () => {
    router.push(PageRouter.LOGIN_WITH)
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
          <div className="w-full lg:w-[800px] py-0 md:py-[60px] justify-center flex items-center px-[32px] flex-wrap">
            <div className="w-full flex-wrap">


              <div className='w-full flex flex-wrap'>
  


              
                <div className='w-full flex flex-wrap mt-6'>

                    <div className='w-full flex flex-wrap justify-start'>
                  <Image
                      alt="icon-next"
                      src={'/images/mumate/ic_back_modal_friend.svg'}
                      width={40}
                      height={40}
                      onClick={() => { router.replace(PageRouter.MATCHING)}}
                      className=' cursor-pointer '
                    />
                </div>


                {isDataLoading ? (
                  <div className='w-full flex flex-wrap mt-6 animate-pulse'>
                    <div className='w-full flex flex-wrap justify-center mt-6 h-[80px]'>
                      <div className='flex -ml-[40px] rounded-full w-[80px] h-[80px] bg-bg_gray' />
                      <div className='flex ml-[40px] rounded-full w-[80px] h-[80px] bg-bg_gray' />
                    </div>
                    <div className='w-full flex justify-center mt-4'>
                      <div className='h-[20px] w-[200px] rounded bg-bg_gray' />
                    </div>
                    <div className='w-full flex justify-center mt-4'>
                      <div className='h-[44px] w-[300px] rounded-[16px] bg-bg_gray' />
                    </div>
                    <div className='w-full flex flex-col items-center gap-2 mt-4'>
                      <div className='h-[20px] w-[160px] rounded bg-bg_gray' />
                      <div className='h-[36px] w-[220px] rounded bg-bg_gray' />
                    </div>
                    <div className='w-full mt-4 bg-bg_gray h-[160px] rounded-[16px]' />
                  </div>
                ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className='w-full flex flex-wrap'
                >


                  <div className='w-full flex flex-wrap justify-center mt-6 h-[80px]'>



                    <div className='w-full  relative flex justify-center'>

                      {
                        userInfo &&  userInfo.picture ?
  
                          <div className=' flex  -ml-[40px]  absolute z-40 rounded-full w-[80px] h-[80px] bg-black'>
                              <Image
                                  alt="icon-next"
                                  src={userInfo.picture}
                                  width={80}
                                  height={80}
                                  className=' rounded-full '
                                />
                          </div>
                        :
  
                        <div className=' flex  -ml-[40px]  absolute z-40 rounded-full w-[80px] h-[80px] bg-black'>
                          
                        </div>
                      }
                      {
                        friendInfo &&  friendInfo.picture ?
  
                          <div className=' flex ml-[40px]  absolute z-40 rounded-full w-[80px] h-[80px] bg-black'>
                              <Image
                                  alt="icon-next"
                                  src={friendInfo.picture}
                                  width={80}
                                  height={80}
                                  className=' rounded-full '
                                />
                          </div>
                        :
                        <div className=' flex ml-[40px]  absolute z-40 rounded-full w-[80px] h-[80px] bg-black'>
                          
                        </div>
                      }
                    </div>

                  </div>


                 <div className='w-full flex flex-wrap mt-4 '>

                    <span className=' text-lg w-full flex justify-center'>คุณ & { friendInfo ? friendInfo.name : 'เพื่อน'}</span>

                 </div>
                

                <div className='w-full flex justify-center'>
                  {
                    matchingType == 'LOVE' ?

                    <div className=" w-[300px] grid grid-cols-5 gap-[2px] mt-4">

                      {
                          [1,2, 3, 4 ,5].map(function(item, index){
                            return (

                              <div 
                              key={index}
                              className="w-full flex flex-wrap">
                                  <Image
                                    className=""
                                    alt="mootech-icon"
                                    src={(item < rating ) ? '/images/mumate/love_fill.svg' : '/images/mumate/love_no_fill.svg'}
                                    width={44}
                                    height={44}
                                  />
                              </div>
                            )
                          })
                        }
                    </div>
                    :
                  <div className=" w-[300px] grid grid-cols-5 gap-[2px] mt-4">
                    {
                      [1,2, 3, 4 ,5].map(function(item, index){
                        return (

                          <div 
                          key={index}
                          className="w-full flex flex-wrap">
                              <Image
                                className=""
                                alt="mootech-icon"
                                src={(item <= rating ) ? '/images/mumate/star_fill.svg' : '/images/mumate/star_no_fill.svg'}
                                width={44}
                                height={44}
                              />
                          </div>
                        )
                      })
                    }

                  </div>
                  }
                </div>


                 <div className='w-full flex flex-wrap mt-4 '>

                    <span className=' text-lg w-full flex justify-center'>{
                      geMatchingType(matchingType) }</span>
                    <span className=' text-[32px] font-semibold text-[#F07C9E] w-full flex justify-center'>ซับซ้อน {getResultAnalyticScore(result)}% </span>

                 </div>


                 <div className='w-full flex flex-wrap mt-4 bg-white p-[24px] rounded-[16px] '>

                    <span className='w-full break-all text-[#888888]'>{desc}</span>

                  </div>


                </motion.div>
                )}
                </div>






         





              </div>



            </div>
          </div>

        </div>


   
      </div>


     
    </div>
  );
}
