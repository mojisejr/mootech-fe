import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { PageRouter } from "@/constants/router";
import Head from "next/head";
import { CookieKey } from "@/constants/cookie-key";
import { useSession } from "next-auth/react";
import { useCookies } from "react-cookie";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import Header from "@/components/header";
import { UserGetById } from "@/constants/api/api-user-get";
import { formatDateTime } from "@/utils/formate-date-thai";
import getConfig from "next/config";
import { validateNumberOnlyFull } from "@/utils/validate";
import { ChineseHoroscopeCalculate } from "@/constants/api/api-chinese-horoscope";
import { AnimatePresence, motion } from "framer-motion";
import { LogActivityGet } from "@/constants/api/api-log-activity-get";
import ActivityCard from "@/components/activity-card";

export default function ActivityPage() {
    const topRef = useRef<HTMLDivElement>(null);

    const router = useRouter();

  const { publicRuntimeConfig } = getConfig()


  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
  ])
  


    const { data: session, status } = useSession();
    const { userId: authUserId, status: authStatus } = useCurrentUser();
    const [userId, setUserId] = useState<string>('')
    const [displayName, setDisplayName] = useState<string>('')
    const [displaySurname, setDisplaySurname] = useState<string>('')
    const [displayImage, setDisplayImage] = useState<string>('')


    const [myDob, setMyDob] = useState<string>('')
    const [myTime, setMyTime] = useState<string>('')
    const [myGender, setMyGender] = useState<string>('')
    const [myPlaceName, setPlaceName] = useState<string>('')

    
  const [logActivity, setLogActivity] = useState<any[]>([])

  const [isShowFGF, setIsShowFGF] = useState<boolean>(false)
  const [linkRefer, setLinkRefer] = useState<any>(null)

  


  const [code, setCode] = useState<string>('') // FEMALE

  const [gender, setGender] = useState<string>('MALE') // FEMALE
  const [birthDay, setBirthDay] = useState<string>('')
  const [timeHourBirth, setTimeHourBirth] = useState<string>('')
  const [timeMinuteBirth, setTimeMinuteBirth] = useState<string>('')
  const [isRememberTimeBirth, setIsRememberTimeBirth] = useState<boolean>(true)
  const [place, setPlace] = useState<string>('')

  const [index, setIndex] = useState<number>(0);
  
  





    // Identity guard: redirect only when truly anon; wait while the id cookie hydrates.
    // #mootech-identity-guard-sweep
    useEffect(() => {
      if (authStatus === "anon") {
        router.replace(PageRouter.LOGIN)
      }
    }, [authStatus]);


  useEffect(() => {
      if (authStatus !== "authed") return

      setUserId(authUserId)
      setDisplayName(cookies[CookieKey.MEMBER_NAME])
      setDisplaySurname(cookies[CookieKey.MEMBER_SURNAME])

      setLinkRefer(publicRuntimeConfig.NEXT_STATIC_NEXTAUTH_URL+'/login?callback=' + cookies[CookieKey.MEMBER_REFER_CODE])

      callApiGetUser(authUserId)
      callApiGetLogActivity(authUserId)
  },  [authStatus, authUserId])


  const callApiGetUser = async (user_id: string) => {
    const result = await UserGetById(user_id);
    if (result && result.user_id) {
      setMyDob(result.dob)
      setMyTime(result.time)  
      setMyGender(result.gender)   
      setPlaceName(result.place_name)

      setDisplayImage(result.picture_url)
      const time = result.time
      let hour = ''
      let minute = ''
      if (result.is_remember_time == true) {
        const timeArray = time.split(':')
        hour = timeArray[0]
        minute = timeArray[1]
      }

      setBirthDay(result.dob)
      setGender(result.gender)
      setTimeHourBirth(hour)
      setTimeMinuteBirth(minute)
      setIsRememberTimeBirth(result.is_remember_time)
      setPlace(result.place_name)


      
    }
  }



  const callApiGetLogActivity = async (user_id: string) => {
    const result = await LogActivityGet(user_id);
    if (result && result.data) {
      setLogActivity(result.data)
      
      
    }
  }


  const gotoBack = () => {
    router.replace(PageRouter.PROFILE)
  }
    
  return (
    <div

    style={{
      background: 'linear-gradient(0deg, rgba(75, 150, 229, 0.05) 0%, rgba(251, 217, 226, 0.5) 132.05%)'
    }}
    className='w-full h-fit min-h-screen  flex justify-center  font-ibm '
    >
    <Head>
        <title>Mumate</title>
      </Head>
      <div 
      ref={topRef}
      style={{
        background: 'linear-gradient(0deg, rgba(75, 150, 229, 0.05) 0%, rgba(251, 217, 226, 0.5) 132.05%)'
      }}
      className="w-full flex flex-wrap pb-[72px]"> 
      <Header 
                    displayImage={displayImage}
                    displayName={displayName}
                    displaySurname={displaySurname}
                  />

          <div 
            className="w-full  min-h-full  justify-center pt-0 lg:pt-[72px] mt-0 lg:mt-4">

              <div className="w-full flex flex-wrap mt-[90px] lg:mt-0 justify-center">
                

          

                
                <div className="w-full flex flex-wrap justify-center mt-10 px-4 md:px-0 ">

            
                        <div className="w-full lg:w-[690px] backdrop-blur-sm bg-white/45 p-[24px] rounded-[48px]  justify-center flex flex-wrap mt-4">
                            <div className="  w-full flex flex-wrap ">
                                  <div 
                                  onClick={gotoBack}
                                  className="  w-fit flex flex-wrap cursor-pointer ">
                                    <div className="flex  flex-none w-fit">
                                        <Image
                                            src={'/images/mumate/ic_next_blue.svg'}
                                            width={16}
                                            height={16}
                                            alt="icon-result"/>
                                      </div>

                                      <span className=" text-moumate_blue pl-2 font-medium">Back</span>
                                  </div>
                            </div>
                            <div className="  w-full flex flex-wrap ">
                              <div className="  w-full flex flex-wrap justify-center ">
                                                            <div className="flex  flex-none w-fit">
                                                                <Image
                                                                    src={'/images/mumate/ic_list.svg'}
                                                                    width={72}
                                                                    height={72}
                                                                    alt="icon-result"/>
                                                              </div>
                              </div>

                              <span
                                className="flex w-full justify-center  text-[40px] font-ibm text-moumate_blue mt-4 font-semibold"
                              >
                                Points Activities
                              </span>
                              <span className="w-full text-center text-[14px] text-[#888888] break-words">
                                ถึงจะละเอียด รอบคอบ และ คิดเยอะ แต่ขาดความมั่นใจ ตัดสินใจไม่เด็ดขาด พูดแล้วเสียงยังไม่หนักแน่นเท่าธาตุดิน
                              </span>



                            <div className="  w-full flex gap-3 flex-wrap mt-8 p-4 ">
                              {
                                logActivity.map(function(item, index) {
                                  return <ActivityCard
                                  key={`${item.create_at}-${item.activity_name}`}
                                  create_at={item.create_at}
                                  point={item.point} 
                                  description={item.activity_name}                                  
                                  />
                                })
                              }
                            
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
