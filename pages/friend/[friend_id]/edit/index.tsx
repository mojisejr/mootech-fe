import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { PageRouter } from "@/constants/router";
import Head from "next/head";
import { CookieKey } from "@/constants/cookie-key";
import { useSession } from "next-auth/react";
import { useCookies } from "react-cookie";
import getConfig from "next/config";
import { validateNumberOnlyFull } from "@/utils/validate";
import { AnimatePresence, motion } from "framer-motion";
import ModalImageCrop from "@/components/modal-image-crop";
import BirthDayInput from "@/components/birthday-input";
import HeaderMuMate from "@/components/header-v2";
import { MemberWithFriendGetDetailApi } from "@/constants/api/api-member-with-friend-get-detail";
import { MemberWithFriendUpdateProfileApi } from "@/constants/api/api-member-with-friend-update-profile";

export default function ProfileEditPage() {
    const topRef = useRef<HTMLDivElement>(null);

    const router = useRouter();

  const { publicRuntimeConfig } = getConfig()
      const inputRef = useRef<HTMLInputElement>(null);

  const [friendId, setFriendId] = useState<any>('')

  useEffect(() => {
    if (router.query) {
      const { friend_id } = router.query
      setFriendId(friend_id)

      callApiGetUser(friend_id)
    }
  }, [router.query]);


  const [name, setName] = useState<string>('')
  const [surname, setSurname] = useState<string>('')
  const [accountName, setAccountName] = useState<string>('')


  const [isShowEdit, setIsShowEdit] = useState<boolean>(false)


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
  

  


    const { data: session, status } = useSession();
    const [userId, setUserId] = useState<string>('')
    const [displayName, setDisplayName] = useState<string>('')
    const [displaySurname, setDisplaySurname] = useState<string>('')
    const [displayImage, setDisplayImage] = useState<string>('')


    const [myDob, setMyDob] = useState<string>('')
    const [myTime, setMyTime] = useState<string>('')
    const [myGender, setMyGender] = useState<string>('')
    const [myPlaceName, setPlaceName] = useState<string>('')
    const [friendImage, setFriendImage] = useState<string>('')
    


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
    if (isRememberTimeBirth == false) {
      setTimeHourBirth('')
      setTimeMinuteBirth('')
    }
  }, [isRememberTimeBirth] )

  useEffect(() => {

    if (step == 'LOADING' && index == items.length - 1 && code != '') {
      router.replace(PageRouter.PROFILE)
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


  const getUi = (step: string) => {
    if (step == 'FORM') {
      return getUiForm()
    } else if (step == 'LOADING') {
      return getUiLoading()
    }

    return null
  }
    const gotoBack = () => {
    router.replace(PageRouter.PROFILE)
  }
    

  
    const onChangeName = (event: any) => {
      setName(event.target.value)
    }
  
    const onChangeSurname = (event: any) => {
      setSurname(event.target.value)
    }
  
    const onChangeAccountName= (event: any) => {
      setAccountName(event.target.value)
    }
  

  const getUiForm = () => {
    return (
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
                        <span
                          className="flex w-full justify-center  text-[24px] font-ibm text-moumate_blue mt-4 font-semibold"
                        >
                          แก้ไขโปรไฟล์
                        </span>
                        <div className='w-full flex flex-nowrap items-center mt-2'>

           
                                 <div 
                                          className=" w-full  flex-wrap justify-center items-center h-full py-[32px]"
                                        >
                            
                                      
                            
                                            <div className="w-full flex flex-wrap justify-center mt-[24px]">

                                                    <div className="w-full flex flex-wrap justify-center">
                                                   
                                                        <div className="w-full flex flex-wrap justify-center">
                                                      

                                                      {
                                                          displayImage ?

                                                        <div className="w-fit relative">

                                                              <div className="flex  flex-none w-fit">
                                                                <Image
                                                                    src={friendImage}
                                                                    width={110}
                                                                    height={110}
                                                                    className=" rounded-full "
                                                                    alt="icon-result"/>
                                                              </div>

                                                      <div className="flex absolute  right-0 bottom-0  flex-none w-fit">
                                                                                     <input type="file" accept="image/*" className="hidden" ref={inputRef} onChange={onSelectFile} />
                                                                        
                                                  
                                                                                    <Image
                                                                                        onClick={showFileDialog}
                                                                                        src={'/images/mumate/ic_edit_profile.svg'}
                                                                                        width={32}
                                                                                        height={32}
                                                                                        className=" cursor-pointer "
                                                                                        alt="icon-result"/>
                                                                                  </div>

                                                          </div>
                                                          :

                                                          <div className="w-fit relative">

                                                              <div className="flex  flex-none w-fit">
                                                                <Image
                                                                    src={'/images/mumate/ic_user_avatar.svg'}
                                                                    width={110}
                                                                    height={110}
                                                                    alt="icon-result"/>
                                                              </div>

                                                          </div>
                                                        }
                                    
                                    
                                                        </div>
                                    
                                            
                                    
                                                      </div>
                                                    <div className="w-full flex flex-wrap justify-center">


                                                    <div className=" w-full flex flex-wrap mt-[24px]">
                                                         <div className="w-full flex flex-wrap">
                                                            <span className=" font-ibm font-medium text-[16px] text-moumate_black">เพศ</span> 
                                                            <span className=" font-ibm font-medium text-[16px] text-moumate_red pl-1">*</span>
                                                          </div>
                                                          <div className=" w-full grid grid-cols-2 gap-[18px] ">
                                    
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


          {/* Account input */}
          {/* <div className="w-full flex flex-wrap mt-[24px]">
            <div className="w-full flex flex-wrap">
              <span className="font-ibm font-medium text-[16px] text-moumate_black">
                ชื่อ Account
              </span>
              <span className="font-ibm font-medium text-[16px] text-moumate_red pl-1">
                *
              </span>
            </div>
            <div className="w-full flex flex-wrap">
              <input
                value={accountName}
                onChange={(e) => { onChangeAccountName(e) }}
                className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                type="text"
              />
            </div>
          </div> */}


          
          {/* Name input */}
          <div className="w-full flex flex-wrap mt-[24px]">
            <div className="w-full flex flex-wrap">
              <span className="font-ibm font-medium text-[16px] text-moumate_black">
                ชื่อ
              </span>
              <span className="font-ibm font-medium text-[16px] text-moumate_red pl-1">
                *
              </span>
            </div>
            <div className="w-full flex flex-wrap">
              <input
                value={name}
                onChange={(e) => { onChangeName(e) }}
                className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                type="text"
              />
            </div>
          </div>


          
          {/* Surname input */}
          <div className="w-full flex flex-wrap mt-[24px]">
            <div className="w-full flex flex-wrap">
              <span className="font-ibm font-medium text-[16px] text-moumate_black">
                นามสกุล
              </span>
              <span className="font-ibm font-medium text-[16px] text-moumate_red pl-1">
                *
              </span>
            </div>
            <div className="w-full flex flex-wrap">
              <input
                value={surname}
                onChange={(e) => { onChangeSurname(e) }}
                className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                type="text"
              />
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
                                                          checked={!isRememberTimeBirth}
                                                          onChange={(e) => { onCheckRememberTimeBirth(e) } }
                                                          type="checkbox" />
                                                          <span
                                                          
                                                          className=" font-ibm  text-[16px] text-moumate_black pl-2"
                                                          >
                                                            จำไม่ได้
                                                          </span>
                                                        </div>
                                                      </div>
                                  
                                                    
                                
                                                      <div className="hidden w-full  flex-wrap mt-[24px]">
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
                                  
                                                    
                                
                                               
                                
                                
                                                    <button
                                                      disabled={!isValid()}
                                                      onClick={ () => { onSubmit() }}
                                                      className={
                                                        ( isValid() ? '  bg-moumate_blue ' : ' bg-gray-400 ' ) + 
                                                        " w-full md:w-[200px] rounded-[16px] py-[16px] px-[16px] mt-[24px] text-white justify-center"}
                                                    >
                                                      บันทึก
                                                    </button>
                                
                                                    </div>
                                    
                                    
                                                      
                                    
                                                
                            
                                            </div>
                            
                            
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



  const isValid = () => {
  
    if (!(name && name != null && name != '')) {
      return false
    }


    if (!(surname && surname != null && surname != '')) {
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


      setDisplayImage(dataImage)

      setLinkRefer(publicRuntimeConfig.NEXT_STATIC_NEXTAUTH_URL+'/login?callback=' + dataReferCode)



    }
    
  
  },  [
        cookies[CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME, CookieKey.MEMBER_SURNAME, CookieKey.MEMBER_IMAGE, CookieKey.MEMBER_REFER_CODE]
      ]
  )


  const callApiGetUser = async (friend_id: any) => {
      if (!friend_id) {
        return
      }
      const result = await MemberWithFriendGetDetailApi(friend_id);
      if (result && result.id) {
        setBirthDay(result.dob)
        setMyTime(result.time)  
        setGender(result.gender)   
        setFriendImage(result.picture_url)
        setName(result.name)
        setSurname(result.surname)
        
  

        const time = result.time
        let hour = ''
        let minute = ''
        if (result.is_remember_time == true) {
          const timeArray = time.split(':')
          hour = timeArray[0]
          minute = timeArray[1]
          setTimeHourBirth(hour)
          setTimeMinuteBirth(minute)

          setIsRememberTimeBirth(true)
        } else {

          setIsRememberTimeBirth(false)
        }

  
      }
  }




    const onSubmit = async () => {
  
      
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
  
  
  
      const result = await MemberWithFriendUpdateProfileApi(
        friendId, birthDay,name,  surname, time, gender, isRememberTimeBirth )
      router.replace(PageRouter.FRIEND_PROFILE.replaceAll(':friend_id', friendId))
    }



const [imageSrc, setImageSrc] = useState<string | null>(null);

  const onSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setImageSrc(reader.result as string));
      reader.readAsDataURL(file);
            setIsShowEdit(true)
    }
  };
  
    const showFileDialog = () => {
      inputRef.current?.click();

    };


    const cancelEdit = () => {
      setIsShowEdit(false)
    }
    const submitEdit = async () => {
      setIsShowEdit(false)
      await callApiGetUser(friendId)
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
         <div className='w-full flex flex-wrap'>
              <HeaderMuMate isShowMenu={false} isLogin={true} image={displayImage}  />

            </div>

          <div 
            className="w-full  min-h-full  justify-center pt-0 lg:pt-[72px] mt-0 lg:mt-4">

              <div className="w-full flex flex-wrap mt-[90px] lg:mt-0 justify-center">
                

          

                
                <div className="w-full flex flex-wrap justify-center mt-10 px-4 md:px-0 ">

            
                  { getUi(step) }
                  

                </div>

              </div>
             
          </div>
      </div>
      {
          isShowEdit ? 
          <ModalImageCrop 
          customerId={friendId}
          imageSrc={imageSrc}
          is_friend={true}
          cancel={cancelEdit} submit={submitEdit} />
          :
          null
        }
    
    </div>
  );
}
