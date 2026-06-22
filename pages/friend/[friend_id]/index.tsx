import BoxChineseTable from "@/components/box-chinese-table";
import BoxInfo from "@/components/box-info";
import HeaderMuMate from "@/components/header-v2";
import HologramScale from "@/components/hologram-scale";
import ModalImageCrop from "@/components/modal-image-crop";
import { ChineseHoroscopeCalculate } from "@/constants/api/api-chinese-horoscope";
import { MemberPaymentCodeCheckApi } from "@/constants/api/api-member-payment-code-check";
import { MemberWithFriendGetDetailApi } from "@/constants/api/api-member-with-friend-get-detail";
import { ChineseElement } from "@/constants/chinese-element";
import { CookieKey } from "@/constants/cookie-key";
import { PageRouter } from "@/constants/router";
import { formatDateTime } from "@/utils/formate-date-thai";
import { useSession } from "next-auth/react";
import getConfig from "next/config";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useCookies } from "react-cookie";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export default function FriendProfilePage() {
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


    const [friendId, setFriendId] = useState<any>('')
    const [friendName, setFriendName] = useState<any>('')
    const [friendSurname, setFriendSurname] = useState<any>('')
    const [friendImage, setFriendImage] = useState<any>('')
    const [friendBirthDay, setFriendBirthDay] = useState<any>('')
    const [friendTime, setFriendTime] = useState<any>('')
    const [friendGender, setFriendGender] = useState<any>('')
    const [resultHoroscope, setResultHoroscope] = useState<any>(null)
    const [resultPower, setResultPower] = useState<any>(null)
    const [resultSummary, setResultSummary] = useState<any>(null)


    const [isShowToolTipFinance, setIsShowToolTipFinance ] = useState<boolean>(false)
    const [isShowToolTipCustomer, setIsShowToolTipCustomer ] = useState<boolean>(false)
    const [isShowToolTiEducation, setIsShowToolTipEducation ] = useState<boolean>(false)
    const [isShowToolTipFriendly, setIsShowToolTipFriendly ] = useState<boolean>(false)
    const [isShowToolTipKnowledge, setIsShowToolTipKnowledge ] = useState<boolean>(false)


    const [isShowEditor, setIsShowEditor ] = useState<boolean>(false)



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


    const  clearToolTip = () => {
      setIsShowToolTipCustomer(false)
      setIsShowToolTipFinance(false)
      setIsShowToolTipFriendly(false)
      setIsShowToolTipEducation(false)
      setIsShowToolTipKnowledge(false)
    }


  
    // Identity guard (am I logged in): redirect only when truly anon; wait while the id
    // cookie hydrates. The friend data fetch below is a SEPARATE axis keyed by friend_id.
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
      setDisplayImage(cookies[CookieKey.MEMBER_IMAGE])
      setReferCode(cookies[CookieKey.MEMBER_REFER_CODE])
  },  [authStatus, authUserId])

  useEffect(() => {
    if (router.query) {
      const { friend_id } = router.query
      setFriendId(friend_id)

      callApiGetUser(friend_id)
    }
  }, [router.query]);


  const callApiGetUser = async (friend_id: any) => {
    if (!friend_id) {
      return
    }
    const result = await MemberWithFriendGetDetailApi(friend_id);
    if (result && result.id) {
      setFriendBirthDay(result.dob)
      setFriendTime(result.time)  
      setFriendGender(result.gender)   
      setFriendImage(result.picture_url)
      setFriendName(result.name)
      setFriendSurname(result.surname)

      setIsShowEditor(result.member_id == '')

      await getChineseHoroscope(
        result.name, result.surname,
        result.dob, result.time,
        result.gender,
        result.picture_url
      )

    }
  }


  const getChineseHoroscope = async (
    name: string, surname: string,
    dob: string, time: string,
    gender: string, image: string
  ) => {
    const result = await ChineseHoroscopeCalculate(
      '', 
      name, dob, 
      time, gender, 
      image, 
      surname, 
      '', 
      ''
    )
    if (result && result) {

      const data = result
      setResultHoroscope(data)

      const power = data.power
      if (power) {
        setResultPower(power)
      }

      const summary = data.summary
      if (summary) {
        setResultSummary(summary)
        // setMyElement(summary.element)
      }
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
    router.push(PageRouter.FRIEND_PROFILE_EDIT.replaceAll(':friend_id', friendId))
  }

  const onClickHowToEarn = () => {
    router.push(PageRouter.HOW_TO_EARN)
  }
  const onClickLogActivity = () => {
    router.push(PageRouter.LOG_ACTIVITY)
  }

  
  
  const gotoBack = () => {
    router.replace(PageRouter.MATCHING)
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
      await callApiGetUser(friendId)
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
  

  const getResultElementTopic = () => {
    if (resultHoroscope) {

      const analytic = resultHoroscope.elementCycle
   
        if (analytic) {

          const element = analytic.element
          let desc = ''
          if (element == 'METAL') {
            desc += ChineseElement.METAL
          } else if (element == 'WOOD') {
            desc += ChineseElement.WOOD
          } else if (element == 'WATER') {
            desc += ChineseElement.WATER
          } else if (element == 'FIRE') {
            desc += ChineseElement.FIRE
          }else if (element == 'EARTH') {
            desc += ChineseElement.EARTH
          }
          const power = analytic.power
          if (desc != '') {
            if (power == 'YIN') {
              desc += 'หยิน'
            } else if (power == 'YANG') {
              desc += 'หยาง'
            }
          }

          return 'ธาตุ'+desc;
             
        }
    }
    

    return null
  }

  const getResultElement = () => {
        if (resultHoroscope) {

        const analytic = resultHoroscope.elementCycle
   
        if (analytic) {

            return analytic
             
        }
    }
    

    return null
  }


  const getResultAnalyticBase = () => {
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic
      if (analytic) {
        const data = analytic.base
        if (data) {
          return data.description
        }
      }
    }

    return '-'
  }

    
  const getResultAnalyticHabit = () => {
    const result: any[] = []
    let word = ''
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic

      if (analytic) {
        const raw = analytic.behaviors
        if (raw) {
          for (let i = 0; i < raw.length; i++) {
            const data = raw[i]
            result.push( <div className="w-full flex flex-wrap mb-2">
              <span className="w-full flex text-sm font-bold flex-wrap">{data.element}</span>
              <span className="w-full flex flex-wrap">{data.behavior}</span>
            </div>
            )
              word += data.behavior + '\n'
          }
        }
      }
    }

    return word
  }


  const getResultAnalyticStrongTopic = () => {
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic
      if (analytic) {
        const data = analytic.elemental_characteristics
        const data2 = analytic.habit
        if (data && data2) {

          const element = data2.day_above_element
          let desc = ''
          if (element == 'METAL') {
            desc += ChineseElement.METAL
          } else if (element == 'WOOD') {
            desc += ChineseElement.WOOD
          } else if (element == 'WATER') {
            desc += ChineseElement.WATER
          } else if (element == 'FIRE') {
            desc += ChineseElement.FIRE
          }else if (element == 'EARTH') {
            desc += ChineseElement.EARTH
          }


          const power = data2.power
          if (desc != '') {
            if (power == 'YIN') {
              desc += 'หยิน'
            } else if (power == 'YANG') {
              desc += 'หยาง'
            }
          }


          const level = data2.level;
          if (desc != '') {
            if (level == 'WEAK') {
              desc += 'อ่อนแอ'
            } else if (power == 'YANG') {
              desc += 'แข็งแรง'
            }
          }


          return 'ธาตุ'+desc;

        }
      }
    }

    return '-'
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
                              friendImage ?

                            <div className="w-fit relative">

                                  <div className="flex  flex-none w-fit">
                                    <Image
                                        src={friendImage}
                                        width={110}
                                        height={110}
                                        className=" rounded-full "
                                        alt="icon-result"/>
                                  </div>

                                  {
                                    isShowEditor && <div className="flex absolute  right-0 bottom-0  flex-none w-fit">
                                    <input type="file" accept="image/*" className="hidden" ref={inputRef} onChange={onSelectFile} />
                        

                                    <Image
                                        onClick={showFileDialog}
                                        src={'/images/mumate/ic_edit_profile.svg'}
                                        width={32}
                                        height={32}
                                        className=" cursor-pointer "
                                        alt="icon-result"/>
                                  </div>
                                  }

                              </div>
                              :

                              <div className="w-fit relative">
                                  {
                                    isShowEditor ?  
                                    <div className="flex  flex-none w-fit">
                                      <input type="file" accept="image/*" className="hidden" ref={inputRef} onChange={onSelectFile} />
                        

                                      <Image
                                          onClick={showFileDialog}
                                          src={'/images/mumate/ic_user_avatar.svg'}
                                          width={110}
                                          height={110}
                                          className=" cursor-pointer "
                                          alt="icon-result"/>
                                    </div>
                                    :
                                    <div className="flex  flex-none w-fit">
                                      
                                      <Image
                                          src={'/images/mumate/ic_user_avatar.svg'}
                                          width={110}
                                          height={110}
                                          className="  "
                                          alt="icon-result"/>
                                    </div>
                                  }

                              </div>
                            }

                                <div className="w-full flex justify-center mt-4">
                                  <span className="w-it flex font-bold text-[20px] text-moumate_blue">{friendName} {friendSurname}</span>
                                </div>



                                <div className="w-full flex justify-center mt-4">

                                  <div className="w-full  flex flex-wrap justify-center gap-1 text-[#444444]">
                                      <span className="w-fit flex">{ friendGender == 'MALE' ? "👨 ผู้ชาย" :  "👩 ผู้หญิง"}</span>
                                      <span className="w-fit flex">&#9679;</span>
                                      <span className="w-fit flex">{getDisplayBirthDay(friendBirthDay, friendTime)}</span>
      
                                  </div>

                                </div>
                            </div>
                      

                            {
                               isShowEditor && <div className="w-full flex justify-center mt-4">
                                  <div 
                                    onClick={ () => { onClickProfileEdit() }}
                                    className="w-fit cursor-pointer flex flex-nowrap justify-center border bg-moumate_blue  py-[12px] px-[24px] rounded-[16px] items-center ">

                                      <span className=" text-white w-full grow font-medium">
                                        แก้ไขโปรไฟล์ 
                                      </span>


                                    </div>

                              </div>
                            }

                        </div>
                      </div>
                  </div>

                  <div className={
                    ( resultHoroscope ? ' flex ' : ' hidden  ') + 
                    "w-full  flex-wrap justify-center mt-10 px-4 md:px-0 "}>

                      <div className="w-full flex flex-wrap justify-center">


                            
                            <div className="w-[348px]   md:w-[400px] lg:w-1/2  flex-wrap justify-center pl-0 lg:pl-2">
                            

                                  <div className="w-full h-fit bg-white rounded-[16px] p-[24px]  flex flex-wrap ">

                                    <div className="w-full flex flex-nowrap">

                                      <div className="w-fit flex-none ">
                                          <div className="w-full relative">

                                              <div className="w-full flex md:hidden lg:flex justify-center flex-wrap ">
                                                <Image
                                                  src={resultSummary?.mascot?.url}
                                                  width={100}
                                                  height={250}
                                                  className=" rounded-xl "
                                                  alt="icon-result"/>
                                              </div>

                                              <div className="w-full  hidden md:flex lg:hidden  justify-center flex-wrap ">
                                                <Image         
                                                  src={resultSummary?.mascot?.url}
                                                  width={150}
                                                  height={300}
                                                  className=" rounded-xl "
                                                  alt="icon-result"/>
                                              </div>

                                          </div>
                                      </div>

                                      <div className="w-full grow flex flex-wrap pl-2">
                                        <div className="w-full flex flex-wrap mb-[20px]">
                                          <HologramScale 
                                          data={resultPower}
                                          type="finance"
                                          isShowToolTip={isShowToolTipFinance}
                                          onClickToolTip={ () => {  clearToolTip(); setIsShowToolTipFinance(!isShowToolTipFinance); }}
                                          description="ความสามารถในการหาเงิน หารายได้ หาทรัพย์สินเข้าตัว"
                                          left_label={"สกิลเรียกทรัพย์"} left_value={0} right_label={"สายสัญชาตญาณ"} right_value={0} />
                                        </div>
                                        <div className="w-full flex flex-wrap mb-[20px]">
                                          <HologramScale 
                                          type="education"
                                          data={resultPower}
                                          isShowToolTip={isShowToolTiEducation}
                                          onClickToolTip={ () => {  clearToolTip(); setIsShowToolTipEducation(!isShowToolTiEducation) }}
                                          description="ความโดดเด่นในวงการที่เราอยู่ อาจจะมาจากการเข้าสังคม ความเก่ง หรือประสิทธิภาพของตัวเราเอง"
                                          left_label={"ตัวท๊อป"} left_value={0} right_label={"สายลุยไว"} right_value={0} />
                                        </div>
                                        <div className="w-full flex flex-wrap mb-[20px]">
                                          <HologramScale 
                                          type="customer"
                                          data={resultPower}
                                          isShowToolTip={isShowToolTipCustomer}
                                          onClickToolTip={ () => { clearToolTip();  setIsShowToolTipCustomer(!isShowToolTipCustomer) }}
                                          description="การมีอิทธิพลต่อสังคมวงกว้าง คาริสม่าที่มี เราทำเราใช้อะไร คนก็เห็นดีเห็นงาม ทำตามซื้อตามด้วย"
                                          left_label={"สกิลอินฟลู"} left_value={0} right_label={"สายลองของ"} right_value={0} />
                                        </div>
                                        <div className="w-full flex flex-wrap mb-[20px]">
                                          <HologramScale 
                                          type="friendly" 
                                          data={resultPower}
                                          isShowToolTip={isShowToolTipFriendly}
                                          onClickToolTip={ () => {  clearToolTip(); setIsShowToolTipFriendly(!isShowToolTipFriendly) }}
                                          description="จำนวนหรือความช่วยเหลือจากเพื่อนฝูง"
                                          left_label={"เพื่อนฝูง"} left_value={0} right_label={"สายทีมเวิร์ค"} right_value={0} />
                                        </div>
                                        <div className="w-full flex flex-wrap">
                                          <HologramScale 
                                          type="knowledge" 
                                          data={resultPower}
                                          isShowToolTip={isShowToolTipKnowledge}
                                          onClickToolTip={ () => {  clearToolTip(); setIsShowToolTipKnowledge(!isShowToolTipKnowledge) }}
                                          description="ความสามารถในการเรียนรู้สิ่งต่างๆได้ง่าย อ่านหรือฟังรอบเดียวก็เข้าใจ"
                                          left_label={"สกิลเรียนรู้"} left_value={0} right_label={"สายลุยเลย"} right_value={0} />
                                        </div>
                                      </div>
                                    </div>
                                  </div>


                                  <div className="w-full h-fit  flex flex-wrap mt-[24px] ">

                                    <div className=" grid grid-cols-1  lg:grid-cols-2 w-full gap-5 mt-[24px]">
                                      <div className="w-full flex flex-wrap">
                                        <BoxInfo 
                                          icon={'/images/mumate/ic_box_1.svg'} 
                                          topic={'พื้นฐานบุคลิก'} 
                                          note={getResultAnalyticBase()} 
                                        />
                                      </div>



                                      <div className="w-full flex flex-wrap">
                                        <BoxInfo 
                                          icon={'/images/mumate/ic_box_3.svg'} 
                                          topic={'นิสัย'} 
                                          note={getResultAnalyticHabit()} 
                                        />
                                      </div>


                                    </div>

                                  </div>


                                  <div className="w-full flex flex-wrap ">

                                    <BoxChineseTable 
                                      data={resultHoroscope}
                                      summary={resultSummary}
                                    />

                                  </div>


                                  <div className="w-full h-fit  flex flex-nowrap mt-[24px] ">
                                        <div className="w-full  flex-wrap">
                                          <div className="w-full flex flex-wrap">
                                            <BoxInfo 
                                              icon={'/images/mumate/ic_element.svg'} 
                                              topic={getResultAnalyticStrongTopic()} 
                                              elements={getResultElement()} 
                                              note={''}
                                              type="ELEMENT"
                                            />
                                          </div>
                                        </div>
                                  </div>





                            </div>


                    

                      </div>

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
