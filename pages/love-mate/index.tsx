import { ChineseHoroscopeCalculate } from "@/constants/api/api-chinese-horoscope";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from "next/router";
import { PageRouter } from "@/constants/router";
import Head from "next/head";
import { validateNumberOnlyFull, validateRefNumber } from "@/utils/validate";
import { ProductGet } from "@/constants/api/api-product-get";
import { CookieKey } from "@/constants/cookie-key";
import { useSession } from "next-auth/react";
import { useCookies } from "react-cookie";
import Header from "@/components/header";
import { UserGetById } from "@/constants/api/api-user-get";
import { formatDateTime } from "@/utils/formate-date-thai";
import { CompatibilityLoveGet } from "@/constants/api/api-compatibility-love";
import { CompatibilityLoveCheck } from "@/constants/api/api-check-compatibility-love";
import ModalFriendGetFriend from "@/components/modal-friend-get-friend";
import getConfig from "next/config";
import { CompatibilityWorkCheck } from "@/constants/api/api-check-compatibility-work";
import BirthDayInput from "@/components/birthday-input";

export default function LoveMatePage() {
    const topRef = useRef<HTMLDivElement>(null);


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
    const [userId, setUserId] = useState<string>('')
    const [displayName, setDisplayName] = useState<string>('')
    const [displaySurname, setDisplaySurname] = useState<string>('')
    const [displayImage, setDisplayImage] = useState<string>('')

    const [desc, setDesc] = useState<any>(null)


    const [totalPoint, setTotalPoint] = useState<string>('0')
    const [usedPoint, setUsedPoint] = useState<string>('0')
    



    const [myDob, setMyDob] = useState<string>('')
    const [myTime, setMyTime] = useState<string>('')
    const [myGender, setMyGender] = useState<string>('')


  const [isShowFGF, setIsShowFGF] = useState<boolean>(false)
  const [linkRefer, setLinkRefer] = useState<any>(null)

  
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

      setDisplayImage(result.picture_url)

      setTotalPoint(result.total_point)   
      setUsedPoint(result.used_point)   
    }
  }

  const [code, setCode] = useState<string>('')

  const [step, setStep] = useState<string>('FORM') // FORM FINISH

    const [products, setProducts] = useState<any[]>([])


  const [name, setName] = useState<string>('')
  const [gender, setGender] = useState<string>('MALE') // FEMALE
  const [birthDay, setBirthDay] = useState<string>('')
  const [timeHourBirth, setTimeHourBirth] = useState<string>('')
  const [timeMinuteBirth, setTimeMinuteBirth] = useState<string>('')
  const [isRememberTimeBirth, setIsRememberTimeBirth] = useState<boolean>(true)


  const [rating, setRating] = useState<number>(0)
  const [percentage, setPercentage] = useState<number>(0)
  const [note, setNote] = useState<string>('')


  
  
  const callGetProduct = async (percentage: number) => {
  
      const result = await ProductGet(
        'LOVE', '', percentage
      )
      if (result) {
        setProducts(result)
      }
  }

  useEffect(() => {
    if (isRememberTimeBirth == false) {
      setTimeHourBirth('')
      setTimeMinuteBirth('')
    }
  }, [isRememberTimeBirth] )


  const getUI = () => {
    if (step == 'FORM') {
      return getUiForm()
    } else if (step == 'FINISH') {
      return getUiFinish()
    }
  }


  const isValid = () => {
    if (name == '') {
      return false
    }

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



    return true
  }



 const onChangeName = (event: any) => {
    setName(event.target.value)
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


 const gotoBack = () => {
    router.replace(PageRouter.RESULT)
  }
    

  const getUiForm = () => {
    return  (
    <div 
                  className="w-full flex  justify-center px-4 lg:px-0 ">
                    <div className={
                        " w-full lg:w-[750px] flex flex-wrap p-[24px] " +
                        "rounded-[16px] border border-[rgba(255,255,255,0)] backdrop-blur-sm bg-white/45  shadow-custom"
                      }>
       <div className="  w-full flex flex-wrap px-4 ">
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
                        <div className="w-full flex justify-center flex-wrap">
                              <div className="flex  w-fit">
                              <Image
                                className=""
                                alt="mootech-icon"
                                src={'/images/mumate/ic_love_topic.svg'}
                                width={250}
                                height={80}
                              />
                            </div>
                        </div>

                        <div className="w-full flex flex-wrap justify-center text-center mt-4">
                          <span className="w-full  justify-center flex font-semibold text-[36px] text-moumate_blue">มาเช็คเคมีรักกัน (Love Mate)</span>
                          <span className=" w-full justify-center flex mt-1 text-[18px] text-moumate_gray">อยากรู้ไหมว่าคุณกับเขาเข้ากันได้กี่เปอร์เซ็นต์</span>

                        </div>

                        <div className="w-full flex flex-wrap mt-4 ">

                            <div className="w-full lg:w-1/2 pr-0 lg:pr-2  flex-wrap">
                              <div className="w-full bg-[#E3ECFB] flex-wrap rounded-[16px] p-[32px]">

                                  <span className="w-full flex  justify-center text-moumate_blue font-semibold text-[22px] text-center">ข้อมูลของฉัน</span>
                                  <div className="w-full flex flex-nowrap mt-2">
                                      <span className="flex flex-none w-[120px] text-black font-semibold">ชื่อ นามสกุล</span>
                                      <span className="flex  w-full grow text-moumate_gray ">{displayName} {displaySurname}</span>
                                  </div>
                                  <div className="w-full flex flex-nowrap mt-2">
                                      <span className="flex flex-none w-[120px] text-black font-semibold">เพศ</span>
                                      <span className="flex  w-full grow text-moumate_gray ">{myGender == 'MALE' ? 'ชาย' : 'หญิง'}</span>
                                  </div>
                                  <div className="w-full flex flex-nowrap mt-2">
                                      <span className="flex flex-none  w-[120px] text-black font-semibold">วันเกิด</span>
                                      <span className="flex w-full grow text-moumate_gray ">{formatDateTime(myDob)} {myTime ? ' ('+(myTime)+') ' : ''}</span>
                                      
                                  </div>

                              </div>
                            </div>

                            <div className="w-full lg:w-1/2 pl-0 lg:pl-2 mt-4 lg:mt-0 flex flex-wrap">
                              <div className="w-full bg-white flex-wrap rounded-[16px] p-[32px]">


                                  <span className="w-full flex  justify-center text-moumate_blue font-semibold text-[22px] text-center">ข้อมูลของเขา</span>

                            {/* Name input */}
                            <div className="w-full flex flex-wrap ">
                              <div className="w-full flex flex-wrap">
                                <span className="font-ibm font-medium text-[16px] text-moumate_black">
                                  ชื่อ นามสกุล
                                </span>
                                <span className="font-ibm font-medium text-[16px] text-moumate_red pl-1">
                                  *
                                </span>
                              </div>
                              <div className="w-full flex flex-wrap">
                                <input
                                  value={name}
                                  onChange={(e) => {  onChangeName(e) }}
                                  className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                                  type="text"
                                />
                              </div>
                            </div>

                            {/* GENDER */}
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


                            

                              <div className=" w-full flex flex-wrap mt-[24px]">
                                <div className="w-full flex flex-wrap">
                                  <span className=" font-ibm font-medium text-[16px] text-moumate_black">วันเกิด</span> 
                                  <span className=" font-ibm font-medium text-[16px] text-moumate_red pl-1">*</span>
                                </div>
                                {/* <div className="w-full flex flex-wrap">
                                  <input 
                                  value={birthDay}
                                  onChange={(e) => { onChangeBirthDay(e.target.value) }}
                                  className={" w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"}
                                  type="date" />
                                </div> */}

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


                              </div>
                            </div>



                        </div>
                    

                            <div className="w-full flex justify-center">
                              <button
                                disabled={!isValid()}
                                onClick={ () => { onSubmit() }}
                                className={
                                  ( isValid() ? '  bg-moumate_blue ' : ' bg-gray-400 ' ) + 
                                  " w-full md:w-[200px] rounded-[16px] py-[16px] px-[16px] mt-[24px] text-white justify-center"}
                              >
                                เริ่มคำนวนกันเลย
                              </button>
                            </div>


                    </div>

                </div>
            
    )
  }

  


  const getUiFinish = () => {
        return  (
          <div 
            className="w-full flex flex-wrap  justify-center px-0 lg:px-0 py-[72px]">

              <div className=" w-full justify-center flex flex-wrap">
                
                <div className={
                    " w-full lg:w-[750px] flex flex-wrap px-[40px] py-[60px] " +
                    " rounded-none lg:rounded-[32px] border border-[rgba(255,255,255,0)] backdrop-blur-sm bg-white/45  shadow-none  lg:shadow-custom"
                  }>

                    <div className="w-full flex flex-wrap justify-center">
                             <div className="  w-full flex flex-wrap px-4 ">
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
                    </div>

                    <div className="w-full flex flex-wrap justify-center mt-4">
                        <span className="w-full flex justify-center text-moumate_blue font-bold text-[32px]">เคมีรัก</span>
                        <span className="w-full flex justify-center text-[#F7BF26] font-bold text-[32px]">{percentage}%</span>
                    </div>


                    <div className="w-full flex flex-wrap px-[40px] mt-4">
                      {
                        desc ? 

                        <div className="w-full text-moumate_gray  text-[18px]  flex flex-wrap">
                          {desc}
                        </div>
                        :
                        null
                      }
                    </div>
  


                    <div className="w-full flex flex-wrap px-[40px] mt-4">
                     
                      <span className=" text-moumate_gray text-[18px] text-center">
                        {note}
                      </span>

                    </div>

                    


                </div>

                <div className="w-full flex justify-center flex-wrap px-4 md:px-0">
                    <div className="w-full md:w-[750px] flex flex-wrap ">
                        <div className="w-full md:w-1/2 pr-0 md:pr-2 flex flex-wrap">
                          <div
                          style={{
                              boxShadow: '0px 32px 24px -24px #1B9AAF26',
                              backdropFilter: 'blur(196px)',

                            background: 'var(--Endeavour-400, #4B96E5)',
                           }} 
                          className='w-full flex flex-wrap  p-[16px] rounded-[16px] mt-4'
                          >
    
    
                            <span className=" text-white w-full text-[15px] font-medium font-ibm">
                              เช็คดวงการทำงาน
                            </span>
    
                            <span className=" text-white w-full   text-[14px] font-normal">
                              (กรณีคุณอยากเช็คกับคู่กรณีอีกคน)
                            </span>
    
                          <div 
                          onClick={ () => { gotoWorkVibe() }}
                          className="w-full mt-4 cursor-pointer flex flex-nowrap justify-center border border-white py-[12px] px-[24px] rounded-[16px] items-center ">
    
                            <span className="mr-2 text-white w-full grow font-medium">
                              เช็คเลย <span className='ml-2 font-normal'>({usedPoint}/{totalPoint})</span>
                            </span>
    
    
                            <div className="flex  flex-none w-fit">
                              <Image
                                  src={'/images/mumate/ic_next.svg'}
                                  width={32}
                                  height={32}
                                  alt="icon-result"/>
                            </div>
                          </div>
                          </div>
                        </div>

                        <div className="w-full md:w-1/2 pl-0 md:pl-2 flex flex-wrap">
                          <div
                          className='w-full flex flex-wrap bg-moumate_blue p-[16px] rounded-[16px] mt-4'
                          >
    
    
                            <span className=" text-white w-full text-[15px] font-medium font-ibm">
                              เช็คเคมีรักเพิ่ม
                            </span>
    
                            <span className=" text-white w-full   text-[14px] font-normal">
                              เช็คหน่อยซิ ว่าเค้าเป็นคู่สร้าง คู่กรรม
                            </span>
    
                          <div 
                          onClick={ () => { gotoLoveMate() }}
                          className="w-full mt-4 cursor-pointer flex flex-nowrap justify-center border border-white py-[12px] px-[24px] rounded-[16px] items-center ">
    
                            <span className="mr-2 text-white w-full grow font-medium">
                              เช็คเลย <span className='ml-2 font-normal'>({usedPoint}/{totalPoint})</span>
                            </span>
    
    
                            <div className="flex  flex-none w-fit">
                              <Image
                                  src={'/images/mumate/ic_next.svg'}
                                  width={32}
                                  height={32}
                                  alt="icon-result"/>
                            </div>
                          </div>
                          </div>
                        </div>

                    </div>

                </div>


                <div className={
                  
                  ( products && products.length > 0 ? ' flex ' : ' hidden ') + 
                   " w-full  flex-wrap mt-[32px]"}>

                  <span className="w-full flex justify-center text-moumate_blue text-[24px] font-semibold">ของเสริมรัก</span>


            <div className='w-full flex flex-nowrap justify-center  gap-4 overflow-y-auto '>
                {
                  products?.map(function(item, index){
                    return (
                      <div
                      key={index}
                      className='w-[280px]  rounded-[16px]  bg-white '
                      >
                      
                      <div className="w-full flex flex-col justify-between h-full min-h-[360px] ">
                          <div className="w-full   flex flex-wrap">
                            <div className='w-[280px] justify-center lg:w-full flex flex-wrap mt-4'>
                                  <Image
                                    className=""
                                    alt="mootech-box"
                                    src={item.image} 
                                    width={176}
                                    height={112}
                                  />
                            </div>

                            <div className='w-full flex flex-wrap mt-4 px-4'>
                              <span className=' text-black text-[18px] font-semibold'>
                                {item.name}
                              </span>
                            </div>

                            <div className='w-full flex flex-wrap mt-4 px-4'>
                              <span className=' text-moumate_gray'>
                                {item.description}
                              </span>
                            </div>
                          </div>

                          <div className="w-full  flex  flex-wrap">

                            <div className='w-full items-end  flex flex-wrap mt-4  px-4 pb-4' >
                              <a 
                                className='w-fit'
                                href={item.url} 
                                target='_blank'
                                rel="noopener noreferrer"> 
                                <span className='  cursor-pointer text-moumate_blue font-bold'>
                                  ซื้อเลย
                                </span>
                              </a>
                            </div>
                          </div>
                      </div>

                      </div>

                    )
                  })
                }
            </div>

                </div>

              </div>


         
          </div>
        )
  }


  
  const getResultAnalyticScore = (result: any) => {
     if (result) {
      const analytic = result
      if (analytic) {
        const data = analytic.score
        if (data) {
          return data
        }
      }
    }

    return 0
  }

    const getResultAnalyticRating = (result: any) => {
     if (result) {
      const analytic = result.rating
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

    const getResultAnalyticRatingDesc = (result: any) => {
     if (result) {
      const analytic = result.rating
      if (analytic) {
        const data = analytic.note
        if (data) {
          return data
        }
      }
    }

    return ''
  }


  const getResultAnalytics = (raws: any) => {
    if (raws) {
        const result: any[] = []
        if (raws) {
          const analytic = raws.desc
            if (analytic) {
              
              for (let i = 0; i < analytic.length; i++) {
                const data = analytic[i]
                result.push(<li className='   text-moumate_gray text-[18px] mt-2  '><span className="  break-words">{data.note}</span></li>)
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



  const onSubmit = async () =>{



    const youBirthDay = birthDay;
    const youBirthDayArray = youBirthDay.split('-')
    const youYear = youBirthDayArray[0]
    const youMonth = youBirthDayArray[1]
    const youDate = youBirthDayArray[2]


    const youHour = timeHourBirth;
    const youMinute = timeMinuteBirth;
    const isShowTimeYouBOD = isRememberTimeBirth

    // คนรัก
    const youDob = `${youYear}-${((parseInt(youMonth)) < 10 ? `0${(parseInt(youMonth))}` : `${(parseInt(youMonth))}`)}-${(parseInt(youDate) < 10 ? `0${parseInt(youDate)}` : `${parseInt(youDate)}`)}`
    let youTime = ''
    if (isShowTimeYouBOD) {
      let min  = youMinute
      let hr  = youHour
      if (min == '') {
        min = '00'
      } else {
        min = parseInt(youMinute) < 10 ? `0${parseInt(youMinute)}` : `${parseInt(youMinute)}`
      }
      if (hr == '') {
        hr = '00'
      } else {
        hr = parseInt(youHour) < 10 ? `0${parseInt(youHour)}` : `${parseInt(youHour)}`
      }
      youTime = `${hr}:${min}`
    }

    const resultCheck = await callApiCheckLove()
    if (resultCheck == false) {
      setIsShowFGF(true)
      return
    }

    const result = await CompatibilityLoveGet(
      userId,
      `${displayName} ${displaySurname} `, myDob, myTime, myGender,
      name, youDob, youTime, gender
    )
    if (result && result.me && result.you && result.result) {
      const percentage = getResultAnalyticScore(result.result)
        setRating(getResultAnalyticRating(result.result))
        setPercentage(percentage)
        setNote(getResultAnalyticRatingDesc(result.result))
        setDesc(getResultAnalytics(result.result))
        setStep('FINISH')

        callGetProduct(percentage)

        if (topRef.current) {
          topRef.current.scrollIntoView({ behavior: 'smooth' });
        }
        await callApiGetUser(userId)
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

  const onClickCloseFGF = () => {
    setIsShowFGF(false)
  }

  const gotoLoveMate = async () => {
    const is_allow = await callApiCheckLove();
    if (is_allow) {
      router.push(PageRouter.LOVE_MATE)
    } else {
      setIsShowFGF(true)
    }
  }


  const gotoWorkVibe = async () => {
    const is_allow = await callApiCheckWork();
    if (is_allow) {
      router.push(PageRouter.WORK_VIBE)
    } else {
      setIsShowFGF(true)
    }
  }

  return (
    <div

    style={{
      background: 'linear-gradient(0deg, rgba(75, 150, 229, 0.05) 0%, rgba(251, 217, 226, 0.5) 132.05%)'
    }}
    className='w-full h-fit min-h-screen  flex justify-center  font-ibm'
    >
    <Head>
        <title>Mumate</title>
      </Head>
      <div 
      ref={topRef}
      className="w-full flex flex-wrap"> 
      <Header 
                    displayImage={displayImage}
                    displayName={displayName}
                    displaySurname={displaySurname}
                  />

          <div 
            className="w-full  min-h-full  justify-center pt-0 lg:pt-[72px] mt-0 lg:mt-4">
              {
                getUI()
              }
          </div>
      </div>

    
      {
        isShowFGF? 
          <ModalFriendGetFriend 
          code={linkRefer}
          onSubmitOK={onClickCloseFGF} />
          :
          null
      }

    </div>
  );
}
