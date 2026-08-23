import { UserRegisterOrLogin } from '@/constants/api/api-user-register-or-login'
import { UserRegisterTel } from '@/constants/api/api-user-register-tel'
import { validateNumberOnlyFull } from '@/utils/validate'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import BirthDayInput from './birthday-input'
import ModalImageCrop from './modal-image-crop'
import { PageRouter } from '@/constants/router'
import { ChineseHoroscopeCalculate } from '@/constants/api/api-chinese-horoscope'
import { UserGetById } from '@/constants/api/api-user-get'
import { CookieKey } from '@/constants/cookie-key'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useCookies } from 'react-cookie'
import { MemberWithFriendCreateApi } from '@/constants/api/api-member-with-friend-create'

type ComponentProps = {
  userId: string,
  name: string,
  image: string,
  refer_code: string,
  provider: string,
  onClose: any,
  onSubmitOK: any
}
const ModalAddFriend = ({
  userId,
  onClose,
  onSubmitOK,
}: ComponentProps) => {


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

  const { data: session, status } = useSession();
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

  const [imageProfile, setImageProfile] = useState<string>('')

  


     
  
    const callApiCreate = async (
      userId: string, birthDay: string, time: string, gender: string, 
      picture_url: string, 
      name: string,
      surname: string,
      is_remember_time: boolean,
    
    ) => {

      setIsLoading(true)
      const result = await MemberWithFriendCreateApi(userId, birthDay, name, surname, time, gender, is_remember_time, imageProfile,);
      setIsLoading(false)
      onClose()
      return null;
    }


    
    




  const [gender, setGender] = useState<string>('MALE') // FEMALE
  const [birthDay, setBirthDay] = useState<string>('')
  const [timeHourBirth, setTimeHourBirth] = useState<string>('')
  const [timeMinuteBirth, setTimeMinuteBirth] = useState<string>('')
  const [isRememberTimeBirth, setIsRememberTimeBirth] = useState<boolean>(true)


  



  const [name, setName] = useState<string>('')
  const [surname, setSurname] = useState<string>('')


  useEffect(() => {
    if (isRememberTimeBirth == false) {
      setTimeHourBirth('')
      setTimeMinuteBirth('')
    }
  }, [isRememberTimeBirth] )

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
  
    const onChangeName = (event: any) => {
      setName(event.target.value)
    }
  
    const onChangeSurname = (event: any) => {
      setSurname(event.target.value)
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
      setImageProfile(pic_url)
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


      
        callApiCreate(
          userId, birthDay, time, gender, 
          imgSrc, 
          name,
          surname,
          isRememberTimeBirth,
        )
  
    }



  return (
    <div
      className={'  fixed z-[9999] inset-0 overflow-y-auto  '}
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex  items-center md:items-end justify-center h-full md:h-fit  lg:max-h-screen pt-4 px-4 md:px-12 lg:px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-black backdrop-blur-[10px] bg-opacity-[0.48] transition-opacity"
          aria-hidden="true"
        ></div>

        <span className="hidden sm:inline-block align-middle h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div className=" w-full  lg:w-[460px] inline-block mt-5     overflow-hidden shadow-box transform transition-all  align-middle">
      

             <div 
    className="w-full bg-[#F2F7FD]  rounded-t-[32px]  min-h-screen  justify-center h-fit font-prompt flex-wrap">

      <div 
    
      className="w-full flex flex-wrap">

         

        <div className="flex justify-center w-full flex-wrap pt-[300px] md:pt-[20px] px-[32px]">
          <div className="w-full lg:w-[400px] flex  flex-wrap">
            <div className="w-full flex-wrap">


              <div className='w-full flex flex-wrap'>
                <div className='w-full flex justify-end'>
                  <Image
                    src={'/images/mumate/ic_close_modal_add_friend.svg'}
                    width={40}
                    height={40}
                    className=' cursor-pointer '
                    onClick={() => {onClose()}}
                    alt='icon-sparkles' />
                </div>

                <div className='w-full flex flex-wrap'>
                  <span className='w-full flex flex-wrap justify-center text-[#1B9AAF] text-[32px] font-semibold'>เพิ่มเพื่อนหรือ</span>
                  <span className='w-full flex flex-wrap justify-center text-[#1B9AAF] text-[32px] font-semibold'>คู่ค้าที่กำหนดเอง</span>
                  <span className='w-full flex flex-wrap justify-center text-center text-[#444444] text-[16px]'>
                    หากคุณมีข้อมูลทั้งหมดของเขาไม่ครบ<br/>
ไม่ต้องกังวลน้าาาา<br/>คุณสามารถอัปเดตได้ในภายหลัง
                  </span>
                </div>



              </div>



            </div>
          </div>

        </div>


      </div>


      <div className=' w-full flex flex-wrap px-[32px] pb-[60px]'>

     

          
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
            {/* #413 — was "เพศดั้งเดิมของคุณ" on a modal that collects a FRIEND's birth data. Same defect as #277
                fixed on the v2 sheet, except this one is on the version real users are using today, so the
                cost of leaving it is not hypothetical: a birth date entered for the wrong person produces a
                reading that looks entirely normal and is about somebody else.
                ONLY the words change — v1 takes real money and this ticket is not a refactor. */}
            <span className=" font-ibm font-medium text-[16px] text-moumate_black">เพศดั้งเดิมของเพื่อน</span> 
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

                   



          <div className='w-full flex flex-wrap mt-[24px] items-center '>
            <div className="w-fit flex items-center flex-wrap">
       

                      <div className="flex  flex-none w-fit">
                        <Image
                            src={imgSrc}
                            width={40}
                            height={40}
                            className=" rounded-full "
                            onClick={() => { router.push(PageRouter.PROFILE)}}
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

          

          <div className=" w-full flex flex-wrap mt-[24px]   bg-[#E3ECFB]  p-[16px] rounded-[16px]">
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
              Save
            </button>
          </div>


      </div>
        {
          isShowEdit ? 
          <ModalImageCrop 
                  customerId={userId}
                  imageSrc={imageSrc}
                  cancel={cancelEdit} submit={submitEdit} is_friend={false} />
          :
          null
        }

    </div>


        </div>
      </div>
    </div>
  )
}

export default ModalAddFriend
