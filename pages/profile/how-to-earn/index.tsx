import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { PageRouter } from "@/constants/router";
import Head from "next/head";
import { CookieKey } from "@/constants/cookie-key";
import { useSession } from "next-auth/react";
import { useCookies } from "react-cookie";
import Header from "@/components/header";
import { UserGetById } from "@/constants/api/api-user-get";
import { formatDateTime } from "@/utils/formate-date-thai";
import getConfig from "next/config";
import { validateNumberOnlyFull } from "@/utils/validate";
import { ChineseHoroscopeCalculate } from "@/constants/api/api-chinese-horoscope";
import { AnimatePresence, motion } from "framer-motion";

export default function HowToEarnPage() {
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

 const [step, setStep] = useState<string>('FORM'); // FORM / LOADING

  const items = [
    <span className="w-full  text-center justify-center flex font-medium mt-2 font-ibm text-[24px] text-black" >🔮 กำลังวิเคราะห์ข้อมูลของคุณ... </span>,
    <span className="w-full  text-center justify-center flex font-medium mt-2 font-ibm text-[24px] text-black" >📊 คำนวณตำแหน่งดาวเคราะห์  </span>,
    <span className="w-full  text-center justify-center flex font-medium mt-2 font-ibm text-[24px] text-black" >🎯 วิเคราะห์บุคลิกภาพ</span>,
    <span className="w-full  text-center justify-center flex font-medium mt-2 font-ibm text-[24px] text-black" >💫 สร้างผลลัพธ์ </span>,
];
  

  
  const gotoBack = () => {
    router.replace(PageRouter.PROFILE)
  }
    

    const { data: session, status } = useSession();
    const [userId, setUserId] = useState<string>('')
    const [displayName, setDisplayName] = useState<string>('')
    const [displaySurname, setDisplaySurname] = useState<string>('')
    const [displayImage, setDisplayImage] = useState<string>('')


    const [myDob, setMyDob] = useState<string>('')
    const [myTime, setMyTime] = useState<string>('')
    const [myGender, setMyGender] = useState<string>('')
    const [myPlaceName, setPlaceName] = useState<string>('')

    


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
  
  





    useEffect(() => {
      if (status === "unauthenticated") {
        router.replace(PageRouter.LOGIN)
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
      setDisplayName(dataName)
      setDisplaySurname(dataSurName)

      setLinkRefer(publicRuntimeConfig.NEXT_STATIC_NEXTAUTH_URL+'/login?callback=' + dataReferCode)

      callApiGetUser(dataId)

    }
    
  
  },  [
        cookies[CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME, CookieKey.MEMBER_SURNAME, CookieKey.MEMBER_IMAGE, CookieKey.MEMBER_REFER_CODE]
      ]
  )


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
                              <div className="  w-full flex flex-wrap justify-center ">
                                                            <div className="flex  flex-none w-fit">
                                                                <Image
                                                                    src={'/images/mumate/ic_step_1.svg'}
                                                                    width={72}
                                                                    height={72}
                                                                    alt="icon-result"/>
                                                              </div>
                              </div>

                              <span
                                className="flex w-full justify-center  text-[40px] font-ibm text-moumate_blue mt-4 font-semibold"
                              >
                                How to earn
                              </span>
                              <span className="w-full text-center text-[14px] text-[#888888] break-words">
                                ถึงจะละเอียด รอบคอบ และ คิดเยอะ แต่ขาดความมั่นใจ ตัดสินใจไม่เด็ดขาด พูดแล้วเสียงยังไม่หนักแน่นเท่าธาตุดิน
                              </span>



                            <div className="  w-full flex flex-wrap border rounded-[16px]  bg-white border-border_gray mt-8 p-4 ">

                              <span className=' font-ibm  font-semibold text-[16px]'>ขั้นตอนการร่วมกิจกรรม</span>

                              <div className='w-full flex items-center flex-nowrap mt-2'>

                                <span className=' flex-none rounded-full bg-[#EEFDFD] text-[#1B9AAF] w-[32px] h-[32px] flex items-center justify-center '>1</span>
                                <span className=' pl-3 text-black text-left text-[14px]'>คัดลอกลิงค์ของคุณ</span>
                              </div>


                              <div className='w-full flex items-center flex-nowrap mt-4'>

                                <span className=' flex-none rounded-full bg-[#EEFDFD] text-[#1B9AAF] w-[32px] h-[32px] flex items-center justify-center '>2</span>
                                <span className=' pl-3 text-black text-left text-[14px]'>ส่งลิงค์ให้เพื่อนที่ต้องการสมัครสมาชิก</span>
                              </div>


                              <div className='w-full flex items-center flex-nowrap mt-2'>

                                <span className=' flex-none rounded-full bg-[#EEFDFD] text-[#1B9AAF] w-[32px] h-[32px] flex items-center justify-center '>3</span>
                                <span className=' pl-3 text-black text-left text-[14px]'>เมื่อสมัครสมาชิกเสร็จเรียบร้อย คุณจะได้รับสิทธิ์</span>
                              </div>
                            </div>


                                <div className="  w-full flex flex-wrap border rounded-[16px] bg-white border-border_gray mt-4 p-4 ">

                                  <span className='w-full font-ibm  font-semibold text-[16px]'>เงื่อนไขกิจกรรม</span>

                                    <ul className=" list-disc px-4">
                                      <li className=' text-left text-black text-[14px]'>เมื่อมีการสมัครสมาชิก 1 ครั้ง <span className='text-moumate_blue'>รับสิทธิเพิ่ม 1 ครั้ง/เรื่อง</span></li>
                                      <li className=' text-left text-black mt-2 text-[14px]'>เมื่อมีการสมัครสมาชิก 3 ครั้ง <span className='text-moumate_blue'>รับสิทธิเพิ่ม 10 ครั้ง/เรื่อง </span></li>
                                    </ul>
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
