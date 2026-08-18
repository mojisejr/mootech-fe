import { ChineseHoroscopeCalculate } from "@/constants/api/api-chinese-horoscope";
import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from "next/router";
import { PageRouter } from "@/constants/router";
import Head from "next/head";
import { validateNumberOnlyFull, validateRefNumber } from "@/utils/validate";
import Header from "@/components/header";
import { useCookies } from "react-cookie";
import { CookieKey } from "@/constants/cookie-key";
import { UserGetById } from "@/constants/api/api-user-get";
import BirthDayInput from "@/components/birthday-input";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export default function WelcomePage() {
 const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
  ])

                
    const router = useRouter();
    const refresh = router.query.refresh as string;

    // Settled-anon guard: resolveAuth encodes "fail-to-loading, never anon" — so
    // authStatus is only 'anon' when there is genuinely no session AND no member
    // cookie. Redirecting on raw next-auth "unauthenticated" bounced logged-in
    // users during the transient hydration window (part of the login loop).
    const { status: authStatus } = useCurrentUser()
    const [userId, setUserId] = useState<string>('')
    const [displayName, setDisplayName] = useState<string>('')
    const [displaySurname, setDisplaySurname] = useState<string>('')
    const [displayImage, setDisplayImage] = useState<string>('')

    useEffect(() => {
      // Only redirect when SETTLED anon — never while loading/transient. Genuine
      // logged-out / new users still go to /login (don't hang them).
      if (authStatus === "anon") {
        router.replace(PageRouter.LOGIN)
      }
    }, [authStatus]);

      
  useEffect(() => {


  
    const dataId = cookies[CookieKey.MEMBER_ID]
    const dataName = cookies[CookieKey.MEMBER_NAME]
    const dataSurName = cookies[CookieKey.MEMBER_SURNAME]
    const dataImage = cookies[CookieKey.MEMBER_IMAGE]

    if (dataId) {
 
      setUserId(dataId)
      setDisplayName(dataName)
      setDisplaySurname(dataSurName)
      setDisplayImage(dataImage)

      if (refresh == '1') {
        setStep('LOADING')
        callApiGetUser(dataId)
      }
    }


    
  
  },  [
        cookies[CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME, CookieKey.MEMBER_SURNAME, CookieKey.MEMBER_IMAGE],
        refresh
      ]
  )

  const callApiGetUser = async (user_id: string) => {
    const result = await UserGetById(user_id);
    if (result && result.user_id) {
      
      callApiCalculate(user_id, result.dob, result.time, result.gender, result.place_name)
  
    }
  }
  

  const callApiCalculate = async (userId: string, birthDay: string, time: string, gender: string, place: string) => {
    // const result = await ChineseHoroscopeCalculate(userId, name, birthDay, time, gender, picture_url, surname, account_name);
    // if (result && result.code) {
    //   // OK
    //   setCode(result.code)
    // }
  }
  
  

  const [step, setStep] = useState<string>('FORM'); // FORM / LOADING / FINISH

  const items = [
    <span key="loading-analyze" className="w-full  text-center justify-center flex font-medium mt-2 font-ibm text-[24px] text-moumate_white" >🔮 กำลังวิเคราะห์ข้อมูลของคุณ... </span>,
    <span key="loading-planets" className="w-full  text-center justify-center flex font-medium mt-2 font-ibm text-[24px] text-moumate_white" >📊 คำนวณตำแหน่งดาวเคราะห์  </span>,
    <span key="loading-personality" className="w-full  text-center justify-center flex font-medium mt-2 font-ibm text-[24px] text-moumate_white" >🎯 วิเคราะห์บุคลิกภาพ</span>,
    <span key="loading-result" className="w-full  text-center justify-center flex font-medium mt-2 font-ibm text-[24px] text-moumate_white" >💫 สร้างผลลัพธ์ </span>,
];
  

  const [code, setCode] = useState<string>('') // FEMALE


  const [gender, setGender] = useState<string>('MALE') // FEMALE
  const [birthDay, setBirthDay] = useState<string>('')
  const [timeHourBirth, setTimeHourBirth] = useState<string>('')
  const [timeMinuteBirth, setTimeMinuteBirth] = useState<string>('')
  const [isRememberTimeBirth, setIsRememberTimeBirth] = useState<boolean>(true)
  const [place, setPlace] = useState<string>('')


  const [index, setIndex] = useState<number>(0);

  useEffect(() => {
    if (isRememberTimeBirth == false) {
      setTimeHourBirth('')
      setTimeMinuteBirth('')
    }
  }, [isRememberTimeBirth] )

  useEffect(() => {

    if (step == 'LOADING' && index == items.length - 1 && code != '') {
      setStep('FINISH')
    }

  }, [step, index, code])


   useEffect(() => {
    if (step == 'LOADING') {
      const interval = setInterval(() => {
        setIndex((prev: number) => (prev + 1) % items.length);
      }, 2000); // 12 วินาที

      return () => clearInterval(interval);
    }
  }, [step]);

  const isValid = () => {

    if (!(birthDay && birthDay != null && birthDay != '')) {
      return false
    }

    if (isRememberTimeBirth) {
      if (
        !(timeHourBirth && timeHourBirth != '')
      ) {
        return false
      }

      if (
        !(timeMinuteBirth && timeMinuteBirth != '')
      ) {
        return false
      }

      if (!(parseInt(timeHourBirth) >= 0 && parseInt(timeHourBirth) <= 23)) {
        return false
      }

      if (!(parseInt(timeMinuteBirth) >= 0 && parseInt(timeMinuteBirth) <= 59)) {
        return false
      }
      
    }

    // if (!(place && place != null && place != '')) {
    //   return false
    // }



    return true
  }


  const onChangeGender = (data: string) => {
    setGender(data)
  }


  const onChangeBirthDay = (data: string) => {
    setBirthDay(data)
  }



  const onChangeTimeHourBirth = (event: any) => {
     if (event.target.value == '') {
      setTimeHourBirth('')
    }
    validateNumberOnlyFull(event, setTimeHourBirth)
  }

  const onChangeTimeMinuteBirth = (event: any) => {
     if (event.target.value == '') {
      setTimeMinuteBirth('')
    }
    validateNumberOnlyFull(event, setTimeMinuteBirth)
  }


  const onCheckRememberTimeBirth = (event: any) => {
    setIsRememberTimeBirth(!isRememberTimeBirth)
  }

  const onChangePlace = (event: any) => {
    setPlace(event.target.value)
  }


  const getUi = (step: string) => {
    if (step == 'FORM') {
      return getUiForm()
    } else if (step == 'LOADING') {
      return getUiLoading()
    } else if (step == 'FINISH') {
      return getUiFinish()
    }

    return null
  }

  const getUiForm = () => {
    return  (
            <div 
              className=" w-full  flex-wrap justify-center items-center h-full py-[32px]"
            >

                <div className="w-full flex flex-wrap justify-center">
                  <div className="w-full max-w-[534px] mx-[16px] lg:mx-0 backdrop-blur-sm bg-white/45  rounded-[32px] py-[32px] px-[32px] ">

                    <div className="w-full flex flex-wrap justify-center">
                      <span className="w-full text-center justify-center uppercase flex  font-ibm text-[24px] font-semibold text-moumate_blue">
                        📝 ก่อนอื่น บอกเราหน่อยว่าคุณเป็น...
                      </span>
                    

                      <div className=" w-full grid grid-cols-2 gap-[18px] mt-[24px]">

                        <div 
                        onClick={ () => { onChangeGender('MALE') }}
                        className={
                          ( gender == 'MALE' ? ' bg-moumate_blue_light border-2  border-moumate_blue  ' : '  bg-white  border border-gray-500 ' ) + 
                          " w-full flex flex-wrap cursor-pointer  items-center rounded-[16px]  p-[16px]   "}>

                      
                          <span className="flex  justify-center w-full text-moumate_black font-[16px] font-ibm ">
                            👨 ผู้ชาย
                          </span>
                        </div>

                        <div 
                        onClick={ () => { onChangeGender('FEMALE') }}
                        className={
                          ( gender == 'FEMALE' ? ' bg-moumate_blue_light border-2  border-moumate_blue  ' : '   bg-white  border border-gray-500 ' ) + 
                          " w-full flex flex-wrap cursor-pointer  items-center rounded-[16px]  p-[16px]   "}>


                        
                          <span className="flex justify-center w-full text-moumate_black font-[16px] font-ibm ">
                            👩 ผู้หญิง
                          </span>
                        </div>
  

                      </div>


                    </div>

        

                  </div>
                </div>

                <div className="w-full flex flex-wrap justify-center mt-[24px]">
                  <div className="w-full max-w-[534px] mx-[16px] lg:mx-0 backdrop-blur-sm bg-white/45  rounded-[32px] py-[32px] px-[32px] ">

                    <div className="w-full flex flex-wrap justify-center">
                      <span className="w-full text-center justify-center uppercase flex font-semibold  font-ibm text-[24px] text-moumate_blue">
                        เล่าให้ฟังหน่อยว่าคุณเกิดเมื่อไหร่?
                      </span>
                      <span className="w-full  text-center justify-center flex font-normal font-ibm text-[20px] text-moumate_gray">
                        🎯 ยิ่งละเอียด ยิ่งแม่นยำ!
                      </span>

                    

                      {/* <div className=" w-full flex flex-wrap mt-[24px]">
                        <div className="w-full flex flex-wrap">
                          <span className=" font-ibm font-medium text-[16px] text-moumate_black">วันเกิด</span> 
                          <span className=" font-ibm font-medium text-[16px] text-moumate_red pl-1">*</span>
                        </div>
                        <div className="w-full flex flex-wrap">
                          <input 
                          value={birthDay}
                          onChange={(e) => { onChangeBirthDay(e.target.value) }}
                          className={" w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"}
                          type="date" />
                        </div>


                      </div> */}

                      <div className=" w-full flex flex-wrap mt-[24px]">
                        <div className="w-full flex flex-wrap">
                          <span className=" font-ibm font-medium text-[16px] text-moumate_black">วันเกิด</span> 
                          <span className=" font-ibm font-medium text-[16px] text-moumate_red pl-1">*</span>
                        </div>
                                 <div className="w-full flex flex-wrap">

                                                            <BirthDayInput 
                                                              dob={birthDay}
                                                              onChangeDate={onChangeBirthDay}
                                                            />
                                                         </div>

                      </div>             
  
                    

                      <div className=" w-full flex flex-wrap mt-[24px]">
                        <div className="w-full flex flex-wrap">
                          <span className=" font-ibm font-medium text-[16px] text-moumate_black">เวลาเกิด</span> 
                          <span className=" font-ibm font-normal text-[16px] text-moumate_gray pl-2">(ถ้าจำได้)</span>
                        </div>

                        <div className=" w-full grid grid-cols-2 gap-3">
                          <div className="w-full flex flex-wrap">
                            <input 
                            value={timeHourBirth}
                            disabled={!isRememberTimeBirth}
                            onChange={(e) => { onChangeTimeHourBirth(e) } }
                            className={
                              ( isRememberTimeBirth ? ' bg-moumate_white  ' : '  bg-gray-200') + 
                              " w-full  border border-gray-200 p-[8px] rounded-[10px]"}
                            placeholder="ชั่วโมง"
                            type="text" />
                          </div>
                          <div className="w-full flex flex-wrap">
                            <input 
                            disabled={!isRememberTimeBirth}
                            value={timeMinuteBirth}
                            onChange={(e) => { onChangeTimeMinuteBirth(e) } }
                            placeholder="นาที"
                            className={

                              ( isRememberTimeBirth ? ' bg-moumate_white  ' : '  bg-gray-200') + 
                              " w-full  border border-gray-200 p-[8px] rounded-[10px]"}
                            type="text" />
                          </div>
                        </div>



                        <div 
                            className="mt-[24px] flex flex-wrap w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px] items-center"
                        >
                          <input 
                          
                          onChange={(e) => { onCheckRememberTimeBirth(e) } }
                          type="checkbox" />
                          <span
                          
                          className=" font-ibm  text-[16px] text-moumate_black pl-2"
                          >
                            จำไม่ได้
                          </span>
                        </div>
                      </div>
  
                    

                      <div className="hidden w-full flex flex-wrap mt-[24px]">
                        <div className="w-full flex flex-wrap">
                          <span className=" font-ibm font-medium text-[16px] text-moumate_black">สถานที่เกิด</span> 
                          <span className=" font-ibm font-medium text-[16px] text-moumate_red pl-1">*</span>
                        </div>
                        <div className="w-full flex flex-wrap">
                          <input 
                          value={place}
                          onChange={(e) => { onChangePlace(e) }}
                          className=" w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                          type="text" />
                        </div>
                        <div className="w-full flex flex-wrap mt-[8px]">
                          <Image
                            src={'/images/mumate/ic_circle_info.svg'}
                            width={16}
                            height={16}
                            alt="info"
                          />
                          <span
                           className=" font-ibm ml-2  text-[14px] text-moumate_gray"
                          >
                            สำคัญสำหรับการดูดวงแบบไทย</span>
                        </div>
                      </div>
  
                    

                      <div className=" w-full flex flex-wrap mt-[24px]   bg-moumate_white border border-gray-200 p-[16px] rounded-[16px]">
                        <div className="w-full flex flex-wrap">
                          <span className=" font-ibm font-semibold text-[16px] text-moumate_black">🔐 <span className="ml-2">ปลอดภัย 100%</span></span>
                        </div>
                        <div className="w-full flex flex-wrap">
                          <span className=" font-ibm  text-[14px] mt-2 text-moumate_gray">ข้อมูลที่คุณให้มา เราใช้แค่คำนวณดวงเท่านั้น ไม่เปิดเผย ไม่แชร์ เก็บไว้อย่างปลอดภัย</span>
                        </div>
                      </div>



                    <button
                      disabled={!isValid()}
                      onClick={ () => { onSubmit() }}
                      className={
                        ( isValid() ? '  bg-moumate_blue ' : ' bg-gray-400 ' ) + 
                        " w-full md:w-[200px] rounded-[16px] py-[16px] px-[16px] mt-[24px] text-white justify-center"}
                    >
                      เริ่มคำนวณ ✨
                    </button>

                    </div>


                  

                    

                  </div>
                </div>


            </div>
            
    )
  }

  const getUiLoading = () => {
      return  (
                 <div 
              className=" w-full  flex-wrap justify-center flex  items-center h-full py-[32px]"
            >
              <div className="w-full flex justify-center items-center flex-wrap">
                <div className=" w-full  flex-wrap justify-center  flex">
                  <Image
                    src={'/images/mumate/loading.png'}
                    width={184}
                    height={276}
                    alt="laoding"
                  />
                </div>

                <div className="flex flex-wrap relative justify-center w-full">
                       <AnimatePresence mode="wait">
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.8 }}
                            className="absolute w-full h-full"
                          >
                            {items[index]}
                          </motion.div>
                        </AnimatePresence>

                </div>
              </div>

            </div>

    )  
  }


  const getUiFinish = () => {
        return  (
         <div 
              className=" w-full  flex-wrap justify-center items-center h-full py-[32px]"
            >

                <div className="w-full flex flex-wrap justify-center">
                  <div className="w-full max-w-[534px] mx-[16px] lg:mx-0 backdrop-blur-sm bg-white/45  rounded-[32px] py-[32px] px-[32px] ">

                    <div className="w-full flex flex-wrap justify-center">
                      <span className="w-full text-center justify-center uppercase flex font-semibold  font-ibm text-[24px] text-moumate_blue">
                        🎉 ผลลัพธ์พร้อมแล้ว
                      </span>
                    

                      <div className=" w-full flex flex-wrap mt-[24px]">

                        <div
                        className=" w-full flex flex-none bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]">
                          
                            <div className="w-fit flex-none flex items-center ">
                              <Image
                                src={'/images/mumate/ic_result_1.png'}
                                width={32}
                                height={32}
                                alt="icon-result"/>
                            </div>

                            <div className="w-full grow flex items-center  pl-2">
                              <span className=" font-ibm  text-[16px] text-moumate_black">
                                คุณมี<span className=" text-moumate_blue">จุดเด่น</span>ที่คนอื่นเห็นแต่คุณยังไม่รู้ตัว
                              </span> 
                            </div>

                        </div>

                        <div
                        className=" w-full flex flex-none bg-moumate_white border border-gray-200 p-[8px] rounded-[10px] mt-[16px]">
                          
                            <div className="w-fit flex-none flex items-center ">
                              <Image
                                src={'/images/mumate/ic_result_2.png'}
                                width={32}
                                height={32}
                                alt="icon-result"/>
                            </div>

                            <div className="w-full grow flex items-center  pl-2">
                              <span className=" font-ibm  text-[16px] text-moumate_black">
                                ดวงชะตาคุณกำลัง<span className=" text-moumate_blue">เปลี่ยนแปลง</span> 
                              </span> 
                            </div>

                        </div>

                        <div
                        className=" w-full flex flex-none bg-moumate_white border border-gray-200 p-[8px] rounded-[10px] mt-[16px]">
                          
                            <div className="w-fit flex-none flex items-center ">
                              <Image
                                src={'/images/mumate/ic_result_3.png'}
                                width={32}
                                height={32}
                                alt="icon-result"/>
                            </div>

                            <div className="w-full grow flex items-center pl-2 ">
                              <span className=" font-ibm  text-[16px] text-moumate_black">
                                <span className=" text-moumate_blue">คำตอบ</span>ที่คุณตามหามานาน อยู่ตรงนี้
                              </span> 
                            </div>

                        </div>
                        
                        
                        <div
                        className=" w-full flex flex-none bg-moumate_white border-2 border-moumate_blue  p-[16px] rounded-[16px] mt-[16px]">
            
                            <div className="w-full grow flex items-center ">
                              <span className="w-full font-ibm justify-center text-center font-semibold  text-[16px] text-moumate_black">
                                Mumate ค้นพบ  <span className=" text-moumate_blue">&quot;ความลับพิเศษ&quot;</span> <br/>
                              เกี่ยวกับตัวคุณ!
                              </span>
                              
                            </div>

                        </div>
                        

                      </div>


                    </div>

        

                  </div>
                </div>

                <div className="w-full flex flex-wrap justify-center mt-[24px]">
                  <div className="w-full max-w-[534px] mx-[16px] lg:mx-0 bg-white  rounded-[32px] py-[32px] px-[32px] ">

                    <div className="w-full flex flex-wrap justify-center">
                      <span className="w-full text-center justify-center uppercase flex font-semibold font-ibm text-[24px] text-moumate_blue">
                        🎪 พร้อมเปิดเผย
                        <br/>ความจริงแล้วใช่ไหม?
                      </span>

                    

                    

                      <div className=" w-full flex flex-wrap mt-[24px]   bg-moumate_white border border-gray-200  p-[16px] rounded-[16px]">
                        <div className="w-full flex flex-wrap">
                          <span className=" font-ibm  font-semibold text-[16px] text-moumate_black">⚠️ <span className="ml-2">คำเตือน</span></span>
                        </div>
                        <div className="w-full flex flex-wrap">
                          <span className=" font-ibm  text-[14px] mt-2 text-moumate_gray">ผลลัพธ์นี้อาจเปลี่ยนมุมมองของคุณตลอดกาล</span>
                        </div>
                      </div>



                    <button
                      onClick={() => { gotoResult() }}
                      className="w-full md:w-[200px] rounded-[16px] py-[16px] px-[16px] bg-moumate_blue mt-[24px] text-white justify-center"
                    >
                     เปิดดูเลย
                    </button>

                    </div>


                  

                    

                  </div>
                </div>


            </div>
    )
  }


  const onSubmit = async () => {

    setStep('LOADING')

    if (!isValid()) {
      setStep('FORM')
      return
    }
    let time = ''
    if (isRememberTimeBirth) {
      let min  = timeMinuteBirth
      let hr  = timeHourBirth
      if (min == '') {
        min = '00'
      } else {
        min = parseInt(timeMinuteBirth) < 10 ? `0${parseInt(timeMinuteBirth)}` : parseInt(timeMinuteBirth) +''
      }
      if (hr == '') {
        hr = '00'
      } else {
        hr = parseInt(timeHourBirth) < 10 ? `0${parseInt(timeHourBirth)}` : parseInt(timeHourBirth) +'' 
      }
      time = `${hr}:${min}`
    }


    await callApiCalculate(userId, birthDay, time, gender, place)
    
  }


  const gotoResult = () => {
    if (code && code != '') {
      router.replace(PageRouter.RESULT.replaceAll(':code', code))
    }
  }

  return (
    <div
    className='w-full bg-white min-h-screen  flex justify-center h-fit font-ibm'
    >
    <Head>
        <title>Mumate</title>
      </Head>
      <div className="w-full flex flex-wrap"> 
          <Header 
            displayImage={displayImage}
            displayName={displayName}
            displaySurname={displaySurname}
          />

          <div 
            className="w-full min-h-full bg-cover bg-center pt-[72px]"
            style={{ backgroundImage: "url('/images/mumate/img_bg_home.jpg')" }}>


            {
              getUi(step)
            }

          </div>
      </div>

    
      
    </div>
  );
}
