import BirthDayInput from '@/components/birthday-input';
import Menu from '@/components/menu';
import ModalImageCrop from '@/components/modal-image-crop';
import ModalLoginSuccess from '@/components/modal-login-success';
import { ChineseHoroscopeCalculate } from '@/constants/api/api-chinese-horoscope';
import { UserGetById } from '@/constants/api/api-user-get';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { validateNumberOnlyFull } from '@/utils/validate';
import { signIn, signOut } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useCookies } from 'react-cookie';


export default function LoginPage() {


 const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
  ])

  const router = useRouter();
  const refresh = router.query.refresh as string;

  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Cookie-validated identity (never the raw NextAuth session status) — see
  // pages/index.tsx / CalculatorHomeExperience.tsx for the same pattern. Raw
  // `status` treats the register round-trip's in-flight window (session
  // authenticated, MEMBER_ID cookie not yet written) as indistinguishable from
  // truly-anon, which is exactly the class of bug behind #mootech-login-loop-fix-v2
  // and #mootech-cta-race-gate. (The old raw useSession() status is gone —
  // useCurrentUser() already reads the session internally.)
  const { status: authStatus } = useCurrentUser();
  const [userId, setUserId] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')
  const [displaySurname, setDisplaySurname] = useState<string>('')
  const [displayImage, setDisplayImage] = useState<string>('')

  const [code, setCode] = useState<string>('')

  const inputRef = useRef<HTMLInputElement>(null);
  const [isShowEdit, setIsShowEdit] = useState<boolean>(false)

  const [isLogin, setIsLogin] = useState<boolean>(false)

  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)

  const fallback = '/images/mumate/ic_avatar.svg' 
  const [imgSrc, setImgSrc] = useState(displayImage || fallback)

  // Defense-in-depth gate (#mootech-register-anon-gate): a genuinely anonymous
  // visitor must never dwell on this form — bounce to HOME (now a safe target:
  // the calculator). This is the SECOND layer — the "สมัครฟรี" CTA itself no
  // longer routes an anon visitor straight here (fixed alongside, see
  // CalculatorHomeExperience.tsx) — but a direct URL/bookmark must be gated too.
  //
  // NEVER redirect while authStatus === 'loading' — that state covers BOTH
  // NextAuth still resolving AND the register round-trip in flight (session
  // authenticated, MEMBER_ID cookie not yet written). Bouncing during that
  // window is exactly the login-loop/cta-race bug class this file must not
  // reintroduce. A first-time authed user filling this form (no chart yet) is
  // 'authed' the moment MEMBER_ID lands — never 'anon' — so this gate never
  // touches them regardless of whether they have a computed chart.
  useEffect(() => {
    if (authStatus === 'anon') {
      router.replace(PageRouter.HOME)
    } else if (authStatus === 'authed') {
      setIsLogin(true)
    }
    // authStatus === 'loading' -> do nothing; wait for it to settle.
  }, [authStatus]);

      
  useEffect(() => {


  
    const dataId = cookies[CookieKey.MEMBER_ID]
    const dataName = cookies[CookieKey.MEMBER_NAME]
    const dataSurName = cookies[CookieKey.MEMBER_SURNAME]
    const dataImage = cookies[CookieKey.MEMBER_IMAGE]
    

    if (dataId) {
 
      setUserId(dataId)
      // setDisplayName(dataName)
      setDisplaySurname(dataSurName)
      setDisplayImage(dataImage)

      setAccountName(dataName)

      if (refresh == '1') {
        callApiGetUser(dataId)
      } else if (refresh == '2') {
        router.replace(PageRouter.MATCHING)
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
        
        const resultCalculate = await callApiCalculate(
          user_id, result.dob, result.time, result.gender, result.picture_url, result.account_name, result.name, result.surname, '' )
          // #167 — callApiCalculate returns null on a Calculate error (unverified endpoint); optional-chain
          // so a null result no longer crashes on `.code`. gotoResult already no-ops on empty (happy path unchanged).
          gotoResult(resultCalculate?.code)
      }
    }
    
  
    const callApiCalculate = async (
      userId: string, birthDay: string, time: string, gender: string, 
      picture_url: string, 
      accountName: string,
      name: string,
      surname: string,
      familyCode: string,
    
    ) => {
      setIsLoading(true)
      const result = await ChineseHoroscopeCalculate(userId, name, birthDay, time, gender, picture_url, surname, accountName, familyCode);
      setIsLoading(false)
      // #167 — result.code is `unknown` (Calculate unverified); narrow to string before setCode (happy
      // path: real code is a string → unchanged; anything else → return null, same as before).
      if (result && typeof result.code === 'string') {
        // OK
        setCode(result.code)
        return result;
      }
      return null;
    }
    




  const [gender, setGender] = useState<string>('MALE') // FEMALE
  const [birthDay, setBirthDay] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [timeHourBirth, setTimeHourBirth] = useState<string>('')
  const [timeMinuteBirth, setTimeMinuteBirth] = useState<string>('')
  const [isRememberTimeBirth, setIsRememberTimeBirth] = useState<boolean>(true)

  const [familyCode, setFamilyCode] = useState<string>('')

  



  const [name, setName] = useState<string>('')
  const [surname, setSurname] = useState<string>('')
  const [accountName, setAccountName] = useState<string>('')


  useEffect(() => {
    if (isRememberTimeBirth == false) {
      setTimeHourBirth('')
      setTimeMinuteBirth('')
    }
  }, [isRememberTimeBirth] )

  const isValid = () => {


    if (!(accountName && accountName != null && accountName != '')) {
      return false
    }



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

    return true
  }



    const onChangeGender = (data: string) => {
      setGender(data)
    }
  
  
    const onChangeBirthDay = (data: string) => {

      setBirthDay(data)
    }

   const onChangeFamilyCode = (event: any) => {
      setFamilyCode(event.target.value)
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
  
    const onChangeName = (event: any) => {
      setName(event.target.value)
    }
  
    const onChangeSurname = (event: any) => {
      setSurname(event.target.value)
    }
  
    const onChangeAccountName= (event: any) => {
      setAccountName(event.target.value)
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
    const submitEdit = async (pic_url: string) => {
      setIsShowEdit(false)
      setDisplayImage(pic_url)
      setImgSrc(pic_url)
      // await callApiGetUser(userId)
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


        const result = await callApiCalculate(userId, birthDay, time, gender, displayImage, accountName, name, surname, familyCode)
        // #167 — callApiCalculate can return null on error; optional-chain (gotoResult no-ops on empty).
        gotoResult(result?.code)
    }


  const gotoResult = (code: any) => {
    if (code && code != '') {
      router.replace(PageRouter.RESULT.replaceAll(':code', code))
    }
  }


  return (
    <div 
    className="w-full bg-white  min-h-screen  justify-center h-fit font-prompt flex-wrap">
      <Head>
        <title>Mumate</title>
      </Head>

      <div 
    
        style={{
          background: 'linear-gradient(180deg, #1B9AAF 0%, #3A78A9 100%)'
        }}
      className="w-full flex flex-wrap">

        <div className='w-full  bg-[#1B9AAF] z-50 fixed top-0 left-0 h-[60px] flex items-center px-4 flex-nowrap'>
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
                  onError={() => {  }}
              />
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


        <div className="flex justify-center w-full flex-wrap mt-[60px] px-[32px] pb-[48px]">
          <div className="w-full lg:w-[400px] flex  flex-wrap">
            <div className="w-full flex-wrap">


              <div className='w-full flex flex-wrap'>
                <div className='w-full flex justify-end'>
                  <Image
                    src={'/images/mumate/ic_sparkles.svg'}
                    width={37}
                    height={37}
                    alt='icon-sparkles' />
                </div>

                <div className='w-full flex flex-wrap'>
                  <span className='w-full flex flex-wrap justify-center text-white text-[32px] font-semibold'>บอกเราหน่อย</span>
                  <span className='w-full flex flex-wrap justify-center text-[#F3FCA2] text-[32px] font-semibold'>ว่าคุณเป็นคือใคร</span>
                  <span className='w-full flex flex-wrap justify-center text-center text-white text-[16px]'>
                    หลังจากนั้นคุณจะได้ดวงส่วนตัวของคุณ
                  </span>
                </div>



              </div>



            </div>
          </div>

        </div>


      </div>


      <div className=' w-full flex flex-wrap px-[32px] pt-[32px] pb-[60px]'>

          {/* Account input */}
          <div className="w-full flex flex-wrap mt-[24px]">
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
          </div>


          
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
                className="mt-[12px] flex flex-wrap w-full bg-moumate_white  p-[8px] rounded-[10px] items-center"
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
          
          {/* GENDER */}
          <div className="w-full flex flex-wrap  mt-[24px]">
            <span className=" font-ibm font-medium text-[16px] text-moumate_black">เพศดั้งเดิมของคุณ</span> 
          </div>
          <div className=" w-full grid grid-cols-2 gap-[18px]  mt-[12px]">

          
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

                    
          {/* Surname input */}
          {/* <div className="w-full flex flex-wrap mt-[24px]">
            <div className="w-full flex flex-wrap">
              <span className="font-ibm font-medium text-[16px] text-moumate_black">
                Family Code
              </span>
            </div>
            <div className="w-full flex flex-wrap">
              <input
                value={familyCode}
                onChange={(e) => { onChangeFamilyCode(e) }}
                className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                type="text"
              />
            </div>
          </div> */}





          <div className='w-full flex flex-wrap mt-[24px] items-center '>
            <div className="w-fit flex items-center flex-wrap">
       

                      <div className="flex  flex-none w-fit">
                        <Image
                            src={imgSrc}
                            width={40}
                            height={40}
                            className=" rounded-full "
                            onError={() => setImgSrc(fallback)}
                            alt="icon-result"/>
                      </div>
                       <div className="flex   flex-wrap w-fit">
                          <input type="file" accept="image/*" className="hidden" ref={inputRef} onChange={onSelectFile} />
              

                          <span
                           onClick={showFileDialog}
                          className=' cursor-pointer text-[#1B9AAF] text-[16px] underline ml-4'>อัพโหลดภาพ</span>
                  
                        </div>

          
            </div>
            
          </div>

          

          <div className=" w-full flex flex-wrap mt-[24px]   bg-[#F2F7FD]  p-[16px] rounded-[16px]">
            <div className="w-full flex flex-wrap">
              <span className=" font-ibm font-semibold text-[16px] text-moumate_black">🔐 <span className="ml-2">ปลอดภัย 100%</span></span>
            </div>
            <div className="w-full flex flex-wrap">
              <span className=" font-ibm  text-[14px] mt-2 text-moumate_gray">ข้อมูลที่คุณให้มา เราใช้แค่คำนวณดวงเท่านั้น ไม่เปิดเผย ไม่แชร์ เก็บไว้อย่างปลอดภัย</span>
            </div>
          </div>


          <div className='w-full flex flex-wrap justify-center'>
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
        {
          isShowEdit ? 
          <ModalImageCrop 
          customerId={userId}
          imageSrc={imageSrc}
          is_friend={false}
          cancel={cancelEdit} submit={submitEdit} />
          :
          null
        }

      {
        isLoading ?
      
        <div 
        style={{
          'background': 'linear-gradient(180deg, #1B9AAF 0%, #3A78A9 100%)'
        }}
        className='w-full fixed top-0 left-0 h-full flex items-center justify-center '>

          <div className='w-full fex flex-wrap'>

            <div className='w-full flex flex-wrap justify-center'>
              <Image
                src={'/images/mumate/ic_bubbles.svg'}
                width={64}
                height={64}
                alt='icon-bubble'
              />
            </div>
            <div className='w-full flex flex-wrap justify-center mt-4'>
              <span className='w-full flex justify-center text-[#F3FCA2] text-[32px] font-semibold'>รอซักครู่น้าาา</span>
              <span className='w-full flex justify-center text-white text-[32px] font-semibold'>ระบบกำลังประมวลผล</span>
              <span className='w-full flex justify-center text-white text-[16px] font-normal text-center '>หลังจากนั้นคุณสามารถเอาดวงไปดูความสมพงค์<br/>และความเข้ากันของงานได้</span>

  

            </div>

          </div>

        </div>
        :
        null
      }

    </div>
  );
}
