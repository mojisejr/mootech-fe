import Header from "@/components/header";
import HeaderMuMate from "@/components/header-v2";
import ModalImageCrop from "@/components/modal-image-crop";
import SurveyCard from "@/components/survey-card";
import { LogSurveyGet } from "@/constants/api/api-log-survey-get";
import { MemberPaymentCodeCheckApi } from "@/constants/api/api-member-payment-code-check";
import { UserGetById } from "@/constants/api/api-user-get";
import { CookieKey } from "@/constants/cookie-key";
import { PageRouter } from "@/constants/router";
import { formatDateTime } from "@/utils/formate-date-thai";
import { useSession } from "next-auth/react";
import getConfig from "next/config";
import dynamic from "next/dynamic";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useCookies } from "react-cookie";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import ScreenLoading from "@/components/screen-loading";
const ImageCropper = dynamic(() => import('../../components/image-cropper'), { ssr: false });

export default function ProfilePage() {
    const topRef = useRef<HTMLDivElement>(null);

    const inputRef = useRef<HTMLInputElement>(null);

  const { publicRuntimeConfig } = getConfig()


  const [isShowEdit, setIsShowEdit] = useState<boolean>(false)

  const [errorMessageCode, setErrorMessageCode] = useState<string>('')
  const [errorMessageSuccess, setErrorMessageSuccess] = useState<string>('')


  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
  ])

  const router = useRouter();

    const { data: session, status } = useSession();
    const { userId: authUserId, status: authStatus } = useCurrentUser();
    const [userId, setUserId] = useState<string>('')
    const [displayName, setDisplayName] = useState<string>('')
    const [displaySurname, setDisplaySurname] = useState<string>('')
    const [displayImage, setDisplayImage] = useState<string>('')
    const [referCode, setReferCode] = useState<string>('')

    
    const [memberType, setMemberType] = useState<string>('')
    const [memberExpired, setMemberExpired] = useState<string>('')

    const [code, setCode] = useState<string>('')

    const [myDob, setMyDob] = useState<string>('')
    const [myTime, setMyTime] = useState<string>('')
    const [myGender, setMyGender] = useState<string>('')
    const [myPlaceName, setPlaceName] = useState<string>('')

    const [logSurvey, setLogSurvey] = useState<any[]>([])

    

    const [totalPoint, setTotalPoint] = useState<string>('0')
    const [usedPoint, setUsedPoint] = useState<string>('0')
    


  const [isShowFGF, setIsShowFGF] = useState<boolean>(false)
  const [linkRefer, setLinkRefer] = useState<any>(null)

  
    // Single auth guard — redirect ONLY when truly anonymous; wait while loading.
    useEffect(() => {
      if (authStatus === "anon") {
        router.replace(PageRouter.LOGIN)
      }
    }, [authStatus]);


  // Load profile data ONLY once identity is resolved — never UserGetById(undefined).
  useEffect(() => {
    if (authStatus !== "authed") return

    setUserId(authUserId)
    setDisplayName(cookies[CookieKey.MEMBER_NAME])
    setDisplaySurname(cookies[CookieKey.MEMBER_SURNAME])
    if (cookies[CookieKey.MEMBER_IMAGE]) {
      setDisplayImage(cookies[CookieKey.MEMBER_IMAGE])
    }
    setReferCode(cookies[CookieKey.MEMBER_REFER_CODE])
    setLinkRefer(publicRuntimeConfig.NEXT_STATIC_NEXTAUTH_URL+'/login?callback=' + cookies[CookieKey.MEMBER_REFER_CODE])

    callApiGetUser(authUserId)
    callApiGetLogSurvey(authUserId)
  }, [authStatus, authUserId])


  const callApiGetUser = async (user_id: string) => {
    const result = await UserGetById(user_id);
    if (result && result.user_id) {
      setMyDob(result.dob)
      setMyTime(result.time)  
      setMyGender(result.gender)   
      setPlaceName(result.place_name)
      if (result.picture_url) {
        setDisplayImage(result.picture_url)
      }

      setTotalPoint(result.total_point)
      setUsedPoint(result.used_point)   

      if (result.payment && result.payment.expire_at) {
        setMemberType('VIP')
        setMemberExpired(result.payment.expire_at)
      }
    }
  }

    const callApiGetLogSurvey = async (user_id: string) => {
    const result = await LogSurveyGet(user_id);
    if (result) {
      setLogSurvey(result)
    }
  }
  


  const getDisplayBirthDay = (dob: string, time: string) => {

    const dobThai = formatDateTime(dob)
    let result = ''
    if (dobThai) {
      result +=  dobThai
    }
    if (time != '') {
      result +=  '  ( ' + time + ' ) '
    }

    if (result.length > 0) {
      return result;
    }

    return '-'
  }


  const onClickProfileEdit = () => {
    router.push(PageRouter.PROFILE_EDIT)
  }

  const onClickHowToEarn = () => {
    router.push(PageRouter.HOW_TO_EARN)
  }
  const onClickLogActivity = () => {
    router.push(PageRouter.LOG_ACTIVITY)
  }

  
  
  const gotoBack = () => {
    router.replace(PageRouter.RESULT)
  }
    

  const gotoSurvey = () => {
    router.replace(PageRouter.SURVEY)

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
      await callApiGetUser(userId)
    }
   
  const onChangeCode = (event: any) => {
    setCode(event.target.value)
  }

  const submitCode = async () => {
    setErrorMessageCode('')
    setErrorMessageSuccess('')
    if (code == '') {
      return
    }
    const r = await MemberPaymentCodeCheckApi(userId, code);
    if (r && r.id) {
      setCode('')
      setErrorMessageCode('')
      setErrorMessageSuccess('คุณได้เป็นสมาชิกสำเร็จ')
    }
    else {
      setErrorMessageCode('ไม่สามารถใช้งาน code นี้ได้')
    }
  }


  // Hold the page until identity resolves — prevents the blank/flash render.
  if (authStatus !== "authed") {
    return <ScreenLoading />
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
                <div className="w-full flex flex-wrap justify-center  ">

                    <div className="w-full lg:w-[690px] flex flex-wrap  justify-center">
                      <div className="  w-full  flex-wrap px-4 ">
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
                      


                      <div className="  w-full flex justify-center flex-wrap ">


                          <div className="  w-full flex justify-center flex-wrap ">
                          {
                            displayImage ?

                          <div className="w-fit relative">

                                <div className="flex  flex-none w-fit">
                                  <Image
                                      src={displayImage}
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

                              <div className="w-full flex justify-center mt-4">
                                <span className="w-it flex font-bold text-[20px] text-moumate_blue">{displayName}</span>
                              </div>

                              
                              {
                                memberType && <div className="w-full flex justify-center mt-4">
                                <span className="w-it flex font-bold text-[18px] text-moumate_blue">{memberType} <span className=" text-black font-normal ml-4">สิ้นสุด {formatDateTime(memberExpired)}</span></span>
                              </div>
                              }


                              <div className="w-full flex justify-center mt-4">

                                <div className="w-full  flex flex-wrap justify-center gap-1 text-[#444444]">
                                    <span className="w-fit flex">{ myGender == 'MALE' ? "👨 ผู้ชาย" :  "👩 ผู้หญิง"}</span>
                                    <span className="w-fit flex">&#9679;</span>
                                    <span className="w-fit flex">{getDisplayBirthDay(myDob, myTime)}</span>
                                    {/* <span className="w-fit flex">&#9679;</span> */}
                                    {/* <span className="w-fit flex">{myPlaceName}</span> */}
                                </div>

                              </div>
                          </div>
                    

                          <div className="w-full flex justify-center mt-4">
                              <div 
                                onClick={ () => { onClickProfileEdit() }}
                                className="w-fit cursor-pointer flex flex-nowrap justify-center border bg-moumate_blue  py-[12px] px-[24px] rounded-[16px] items-center ">

                                  <span className=" text-white w-full grow font-medium">
                                    แก้ไขโปรไฟล์ 
                                  </span>


                                </div>

                          </div>

                      </div>
                    </div>
                </div>

                <div className="w-full flex flex-wrap justify-center mt-10 px-4 md:px-0 ">

                    <div className="w-full lg:w-[690px]  grid grid-cols-1   gap-4 justify-center">


                        <div className="w-full  flex-wrap backdrop-blur-sm bg-white/45 p-[24px] rounded-[16px]">
                          <span className="w-full justify-start font-bold text-moumate_blue  text-[16px] mt-2 flex">Code Promotion</span>
                          <div className="w-full flex flex-wrap mt-6">
                            <input
                              value={code}
                              onChange={(e) => { onChangeCode(e) }}
                              className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                              type="text"
                            />
                          </div>
                            <div className='w-full flex  justify-center flex-wrap mt-4'>
                                                
                              <div 
                              onClick={() => { submitCode() }}
                              className={( code == '' ? ' bg-gray-200  ' : ' bg-[#1B9AAF] cursor-pointer ')  + 'w-full py-2 px-4 items-center flex flex-nowrap   rounded-[40px]'}>
  
                                <div className='w-full justify-center grow flex flex-wrap'>
  
                                  <span className='w-full flex text-white justify-start font-bold text-lg'>Continue</span>
  
                                </div>
  
                                <div className='w-fit flex flex-nowrap'>
                                  <Image
                                    src={'/images/icons/ic_arrow_next_white.svg'}
                                    width={40}
                                    height={40}
                                    alt='icon-next'
                                  />
                                </div>
  
                              </div>
  
                            </div> 
                          {
                            errorMessageSuccess ?
                            <span className=" text-green-600 text-sm flex  justify-center mt-2">{errorMessageSuccess}</span>
                            :
                            null
                          }

                          {
                            errorMessageCode ?
                            <span className=" text-red-600 text-sm flex  justify-center mt-2">{errorMessageCode}</span>
                            :
                            null
                          }
                        </div>

                    </div>

                </div>

                

                <div className="w-full hidden flex-wrap justify-center mt-10 px-4 md:px-0 ">

                    <div className="w-full lg:w-[690px]  grid grid-cols-1  md:grid-cols-3 gap-4 justify-center">


                        <div className="w-full  flex-wrap backdrop-blur-sm bg-white/45 p-[24px] rounded-[16px]">

                          <div className="w-full flex flex-wrap justify-center">
                              <Image
                                src={'/images/mumate/ic_point.svg'}
                                width={32}
                                height={32}
                                alt="icon-result"/>
                          </div>

                          <span className="w-full justify-center font-bold text-[#444444] text-[16px] mt-2 flex">Reward points</span>

                          <span className="w-full justify-center font-bold text-moumate_blue text-[32px] mt-2 flex">{usedPoint}/{totalPoint}</span>

                        </div>


                      
                        <div className="w-full  flex-wrap backdrop-blur-sm bg-white/45 p-[24px] rounded-[16px]">

                          <div className="w-full flex flex-wrap justify-center">
                              <Image
                                src={'/images/mumate/ic_list.svg'}
                                width={32}
                                height={32}
                                alt="icon-result"/>
                          </div>

                          <span className="w-full justify-center font-bold text-[#444444] text-[16px] mt-2 flex">Points Activities</span>

                          <span className="w-full justify-center  text-moumate_gray text-[16px] mt-2 flex  text-center">
                            ประวัติการใช้งาน
                            รับพ้อย ใช้พ้อย

                          </span>


                          <span 
                          
                          onClick={onClickLogActivity}
                          className={
                            " cursor-pointer  w-full justify-center text-moumate_blue underline font-semibold text-[16px] mt-2 flex"}>
                            See All Activities

                          </span>

                        </div>


                      
                        <div className="w-full  flex-wrap backdrop-blur-sm bg-white/45 p-[24px] rounded-[16px]">

                          <div className="w-full flex flex-wrap justify-center">
                              <Image
                                src={'/images/mumate/ic_step_1.svg'}
                                width={32}
                                height={32}
                                alt="icon-result"/>
                          </div>

                          <span className="w-full justify-center font-bold text-[#444444] text-[16px] mt-2 flex">How to earn</span>

                          <span className="w-full justify-center  text-moumate_gray text-[16px] mt-2 flex text-center">
                              ขั้นตอนการรับสิทธิเเละการใช้งาน
                          </span>


                          <span 
                          onClick={onClickHowToEarn}
                          className="w-full justify-center text-moumate_blue underline cursor-pointer font-semibold text-[16px] mt-2 flex">
                            See All Activities

                          </span>

                        </div>

                    </div>
                    
                    <div className="w-full flex flex-wrap justify-center">
                      <div className="w-full lg:w-[690px] backdrop-blur-sm bg-white/45 p-[24px] rounded-[16px]  justify-center flex flex-wrap mt-4">
                        <div className="w-full flex flex-wrap justify-center">
                          <Image
                            alt="ic_alert_success"
                            src={'/images/mumate/ic_gift.svg'}
                            width={35}
                            height={35}
                          /> 
                        </div>
                        <div className="  w-full flex flex-wrap ">
                          <span
                            className="flex w-full justify-center  text-[24px] font-ibm text-moumate_blue mt-4 font-semibold"
                          >
                            Refer your friend & earn point
                          </span>
                          <div className='w-full flex flex-nowrap items-center bg-bg_gray py-4 px-4 rounded-[16px] mt-2'>

                            <span className=' w-full grow text-left  text-moumate_gray font-ibm text-[14px] truncate '>{linkRefer}</span>

                            <div className='flex-none w-fit'>
                                <Image
                                  onClick={ () => { 
                                  navigator.clipboard.writeText(linkRefer) }}
                                  alt="ic_alert_success"
                                  className=' cursor-pointer '
                                  src={'/images/mumate/ic_link.svg'}
                                  width={40}
                                  height={40}
                                /> 
                            </div>

                          </div>


                        </div>

                      </div>
                    </div>

                    <div className="w-full flex flex-wrap justify-center">
                      <div className="w-full lg:w-[690px] gap-y-4  justify-center flex flex-wrap mt-4">
                          {
                            logSurvey.map(function(item, index){
                              return (
                                <SurveyCard 
                                  create_at={item.create_at}
                                  url={item.url}
                                  title={item.title}
                                  emoji={item.emoji}
                                  description={item.description}
                                  code={item.code}
                                  refer_code={referCode} 
                                  gotoSurvey={gotoSurvey}                                  
                                />
                              )
                            })
                          }

                      </div>
                    </div>
                    

                </div>





              </div>
             
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

    </div>
  );
}
