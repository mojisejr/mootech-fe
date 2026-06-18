import CalendarChineseDairyCard from '@/components/calendar-dairy-chinese';
import CalendarChineseMonthCard from '@/components/calendar-month-chinese';
import HeaderMuMate from '@/components/header-v2';
import ModalAIChatStreamingGeneral from '@/components/modal-ai-chat-general-streaming';
import { ChineseCalendarGetDairyAPI } from '@/constants/api/api-chinese-calendar-get-dairy';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from 'react-cookie';
import { useCurrentUser } from "@/lib/auth/use-current-user";
import ScreenLoading from "@/components/screen-loading";


export default function ChineseCalendarPage() {

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
    CookieKey.REFCODE_FGF,
    CookieKey.LOGIN_PROVIDER
  ])


  const [section, setSection] = useState<string>('DAY') // DAY / MONTH

  const today = new Date()
  const [day, setDay] = useState<number>(today.getDate())
  const [month, setMonth] = useState<number>(today.getMonth() + 1) // 0-11 → 1-12
  const [year, setYear] = useState<number>(today.getFullYear())

  const [calendarInfo, setCalendarInfo] = useState<any>(null)






  const [isShowChat, setIsShowChat] = useState<boolean>(false)

  const [isDisable, setIsDisable] = useState<boolean>(false)



  const [startWordChat, setStartWordChat] = useState<string>('')


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
  

  // Single auth guard — redirect ONLY when truly anonymous; wait while loading.
  useEffect(() => {
    if (authStatus === "anon") {
      router.replace(PageRouter.HOME)
    } else if (authStatus === "authed") {
      setIsLogin(true)
    }
  }, [authStatus]);




const callApiCalendar = async (day: number, month: number, year: number) => {
  const result = await ChineseCalendarGetDairyAPI(authUserId, day, month, year);
  if (result) {
    setCalendarInfo(result)
  }
}
  // Load calendar data ONLY once identity is resolved — never fetch with empty id.
  useEffect(() => {
    if (authStatus !== "authed") return

    setUserId(authUserId)
    setDisplaySurname(cookies[CookieKey.MEMBER_SURNAME])
    setAccountName(cookies[CookieKey.MEMBER_NAME])
    if (cookies[CookieKey.MEMBER_IMAGE]) {
      setDisplayImage(cookies[CookieKey.MEMBER_IMAGE])
      setImgSrc(cookies[CookieKey.MEMBER_IMAGE])
    }

    callApiCalendar(day, month, year)
  }, [authStatus, authUserId])

 
  // Hold the page until identity resolves.
  if (authStatus !== "authed") {
    return <ScreenLoading />
  }


  const gotoLoginWith = () => {
    router.push(PageRouter.LOGIN_WITH)
  }





    const getResultAnalyticColors = (info: any) => {
    if (info && info.colors && info.colors.length > 0) {
      const resultHoroscope = info.colors
      const colorElement:any[] = []
    if (resultHoroscope) {
      const colors = resultHoroscope

      

      for (let j = 0; j < colors.length; j++) {
          colorElement.push( 
          
                <div className='w-full flex flex-wrap items-center'>
                <div 
                    style={{ backgroundColor: `${colors[j].hex}` }}
                className={"w-[24px] h-[24px] bg-[" + (colors[j].hex).toUpperCase()+ "] rounded-full"}></div>
                <span className={'pl-2 text-[12px] text-moumate_gray'}>   {colors[j].name}</span>
              </div>

          )
        

      

        
      }
    
      return colorElement
      }
    }
   
    return []
  }

  const setFromDate = (d: Date) => {
    setDay(d.getDate())
    setMonth(d.getMonth() + 1)
    setYear(d.getFullYear())


      callApiCalendar(d.getDate(), d.getMonth() + 1, d.getFullYear())
  }

  const nextDay = () => {
    const d = new Date(year, month - 1, day) // month ใน Date คือ 0-11
    d.setDate(d.getDate() + 1)
    setFromDate(d)
  }

  const prevDay = () => {
    const d = new Date(year, month - 1, day)
    d.setDate(d.getDate() - 1)
    setFromDate(d)

  }
const getDayOfWeekInt = (
  day: number,
  month: number,
  year: number
): string => {
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
  }).format(date);
};

const geyMonthYear = (month: number, year: number) => {
  const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];


  return `${THAI_MONTHS[month - 1]} ${year + 543}`;

}

const getTime = (info: any) => {
  if (info && info.result && info.result.chinese_time_ranges) {
    const list: any[] = []
    const times = JSON.parse(info.result.chinese_time_ranges)
    for (let i = 0; i < times.length; i++) {
      list.push( <span className='w-full text-[14px]'>{times[i]} น.</span>)
    }

    return list;

  }

  return null
}

const onChangeDate = (day: number, month: number, year: number) => {
  setDay(day)
  setMonth(month)
  setYear(year)
} 

const gotoPayment = () => {
  router.replace(PageRouter.PACKAGE_PRICE)
}



  const onCloseChat = () => {
    setIsShowChat(false)
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

      <div className="w-full block md:flex flex-wrap bg-[#FBF6FA]">
      <div className='w-full flex flex-wrap'>
          <HeaderMuMate isShowMenu={isShowMenu} isLogin={isLogin} image={imgSrc}  />
        </div>


        <div className="flex  justify-center w-full flex-wrap mt-[60px] md:mt-[30px]">
          <div className="w-full lg:w-[450px] flex items-center flex-wrap">

            <div className='w-full flex flex-wrap mt-0 md:mt-[60px]'>

                 <div className='w-full flex flex-wrap'>

                  <div className='w-full flex-nowrap flex py-[12px]  px-[12px]'>

                    <div className='w-full grow flex flex-wrap items-center'>

                      <span className=' text-[#1B9AAF] text-[16px]'>{geyMonthYear(month, year)}</span>

                    </div>
                    <div className='w-fit flex-none flex flex-wrap  items-center'>
                      <div 
                      onClick={() => { setSection('DAY')}}
                      className={
                        ( section == 'DAY' ? ' bg-[#1B9AAF]  text-white ' : ' text-[#1B9AAF] ') + 
                        ' w-fit flex flex-wrap  px-[14px] py-[4px] rounded-[100px] pr-6 cursor-pointer'}>
                          <div className='w-fit flex'>
                              <Image
                                  src={section == 'DAY' ? '/images/mumate/ic_calendar_white.svg' : '/images/mumate/ic_calendar_blue.svg'}
                                  width={15}
                                  height={15}
                                  alt="icon-result"/>
                          </div>
                          <span className=' text-[12px] ml-2'>วัน</span>
                      </div>
                      <div 
                      
                      onClick={() => { setSection('MONTH')}}
                      className={

                        ( section == 'MONTH' ? ' bg-[#1B9AAF]  text-white ' : ' text-[#1B9AAF] ') + 
                        '  w-fit flex flex-wrap  px-[14px] py-[4px] rounded-[100px] pl-6 cursor-pointer '}>
                          <div className='w-fit flex'>
                              <Image
                                  src={section == 'MONTH' ? '/images/mumate/ic_calendar_white.svg' : '/images/mumate/ic_calendar_blue.svg'}
                                  width={15}
                                  height={15}
                                  alt="icon-result"/>
                          </div>
                          <span className=' text-[12px]  ml-2'>เดือน</span>
                      </div>
                    </div>


                  </div>
                  
                </div>


            </div>

            {
              section == 'DAY' ?


            <div className="w-full flex-wrap">
              <CalendarChineseDairyCard userId={userId} initDay={day} initMonth={month} initYear={year}
                  onChangeDate={onChangeDate} gotoPayment={gotoPayment} />
            </div>

              :

              <div className='w-full flex flex-wrap'>
  
             

                   {/* CALENDAR */}
                   <div className='w-full flex flex-wrap '>
                    <CalendarChineseMonthCard userId={userId} initMonth={month} initYear={year} onChangeDate={onChangeDate} />
                   </div>


                    
                   


              </div>
            }


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
