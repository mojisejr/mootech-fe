import Header from "@/components/header";
import { SurveyCalculate } from "@/constants/api/api-survey-calculate";
import { SurveyGet } from "@/constants/api/api-survey-get";
import { CookieKey } from "@/constants/cookie-key";
import { PageRouter } from "@/constants/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useCookies } from "react-cookie";
import { useCurrentUser } from "@/lib/auth/use-current-user";

export default function SurveyPage() {

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
      setDisplayImage(cookies[CookieKey.MEMBER_IMAGE])
      setReferCode(cookies[CookieKey.MEMBER_REFER_CODE])
  },  [authStatus, authUserId])

  const callback = router.query.callback as string || '/';

  const [no, setNo] = useState<number>(1)
  const [surveys, setSurveys] = useState<any[]>([])
  const [answer, setAnswer] = useState<any[]>([])


  const [choice, setChoice] = useState<number>(0)

  const [topic, setTopic] = useState<string>('')
  const [choice1, setChoice1] = useState<string>('')
  const [choice2, setChoice2] = useState<string>('')
  const [choice3, setChoice3] = useState<string>('')
  const [choice4, setChoice4] = useState<string>('')


  const [codeShare, setCodeShare] = useState<string>('')


  const [isShowResult, setIsShowResult] = useState<boolean>(false)


  const [resultCalculate, setResultCalculate] = useState<any>(null)

    useEffect(() => {
        callSurveyGet()
    }, [])

    useEffect(() => {
      getDisplay(no)

      
    }, [no, answer])

    const callSurveyGet = async () => {
  
      const result = await SurveyGet()
      if (result) {
        setSurveys(result)
        let list = []
        for (let i = 0; i < result.length; i++) {
          list.push({
            no: result[i].no,
            answer: '',
          });
        }
        setAnswer(list)
      }
    }


    const getDisplay = (no: number) => {

      if (surveys && surveys.length > 0) {
        const survey = surveys[no-1];

        setTopic(survey.topic)
        setChoice1(survey.choice_1)
        setChoice2(survey.choice_2)
        setChoice3(survey.choice_3)
        setChoice4(survey.choice_4)
        const prevAnswer = answer[no-1].answer
        setChoice(prevAnswer)
        
      }
    }

    const next = () => {
      let currentNo = no
      currentNo = currentNo + 1
      if (currentNo > surveys.length) {
        currentNo = surveys.length
      }

      const prevAnswer = [...answer]
      prevAnswer[no-1].answer = choice

      setAnswer(prevAnswer)

      setNo(currentNo)
      
    }


    const prev = () => {
      let currentNo = no
      currentNo = currentNo - 1
      if (currentNo < 1) {
        currentNo = 1
      }

      const prevAnswer = [...answer]
      prevAnswer[no-1].answer = choice

      setNo(currentNo)
      setAnswer(prevAnswer)
    }
  

    const calculate = async () => {

      const result = await SurveyCalculate(userId, answer)
      if (result) {
        setResultCalculate(result)
        setCodeShare(result.code)
        setIsShowResult(true)
      }
    }


    const gotoResult = () => {
      router.replace(PageRouter.RESULT.replaceAll(':code', callback))
    }


    const gotoResultShare = () => {
      router.replace(PageRouter.SHARE_TYPE.replaceAll(':code', codeShare) + '?callback=' + referCode)
    }

    const getPercentage = (no: number) => {
      return (parseFloat(no.toString()) -1 ) *  10
    }


 const gotoBack = () => {
    router.replace(PageRouter.RESULT)
  }
    



  return (
    <div
    className='w-full min-h-screen  flex justify-center h-fit font-ibm'
    style={{
      background: 'linear-gradient(0deg, rgba(75, 150, 229, 0.05) 0%, rgba(251, 217, 226, 0.5) 132.05%)'
    }}
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
            className="w-full min-h-full pt-[72px]">

            <div 
              className=" w-full flex flex-wrap justify-center items-center h-full "
            >


                <div className={

                  (isShowResult ? ' hidden ' : '  ' ) + 
                  " w-full max-w-[888px] mx-[16px] lg:mx-0 backdrop-blur-sm bg-white/60   rounded-[32px] py-[32px] px-[24px] "}>

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


                    <span className="w-full text-center justify-center uppercase flex font-semibold  font-ibm  text-[24px] md:text-[48px] text-moumate_blue">
                      ทดสอบจุดแข็งเฉพาะคุณ
                    </span>
                    <span className="w-full  text-center justify-center flex font-normal font-ibm text-[20px] text-moumate_gray">
                      ค้นหาพลังลับที่แท้จริงของคุณใน 10 คำถาม
                    </span>

                    <div className="w-full flex flex-nowrap mt-4">

                      <div className="w-fit flex-none">

                        <span>{no}/{surveys.length}</span>

                      </div>

                      <div className="w-full flex grow items-center pl-4">
                         <div className='w-full h-[8px] bg-gray-200 rounded overflow-hidden'>
                          <div
                              className="h-full transition-all duration-500"
                              style={{
                                width: `${getPercentage(no)}%`,
                                background: 'linear-gradient(90deg, #1AB1C0 0%, #FBD9E2 51.44%, #4B96E5 100%)'
                              }}
                            ></div>
                          </div>
                      </div>

                    </div>

                    <span className="w-full mt-[40px] font-semibold  text-center justify-center flex  font-ibm text-[24px] text-moumate_black">
                      {no}.{topic}
                    </span>


                    <div className=" w-full grid grid-cols-1 md:grid-cols-2 gap-[18px] mt-[24px]">

                      <div 
                      onClick={() => { setChoice(1) }}
                      className={
                        ( choice == 1 ? ' border-moumate_blue_dark bg-moumate_blue_light border-2 ' : '  border ') + 
                        " w-full  cursor-pointer flex flex-wrap items-center rounded-[16px]  py-[16px] px-[4px] border"}
                        >

                      
                        <span className="flex grow w-full text-moumate_black font-[16px] font-ibm pl-[8px]">
                          {choice1}
                        </span>


                      </div>


                    <div 
                      onClick={() => { setChoice(2) }}
                      className={
                        ( choice == 2 ? ' border-moumate_blue_dark bg-moumate_blue_light border-2 ' : '  border ') + 
                        " w-full  cursor-pointer flex flex-wrap items-center rounded-[16px]  py-[16px] px-[4px] border"}
                        >


                      
                        <span className="flex grow w-full text-moumate_black font-[16px] font-ibm pl-[8px]">
                          {choice2}
                        </span>


                      </div>


                    <div 
                      onClick={() => { setChoice(3) }}
                      className={
                        ( choice == 3 ? ' border-moumate_blue_dark bg-moumate_blue_light border-2 ' : '  border ') + 
                        " w-full  cursor-pointer flex flex-wrap items-center rounded-[16px]  py-[16px] px-[4px] border"}
                        >


                      
                        <span className="flex grow w-full text-moumate_black font-[16px] font-ibm pl-[8px]">
                          {choice3}
                        </span>


                      </div>


                      <div 
                      onClick={() => { setChoice(4) }}
                      className={
                        ( choice == 4 ? ' border-moumate_blue_dark bg-moumate_blue_light border-2 ' : '  border ') + 
                        " w-full  cursor-pointer flex flex-wrap items-center rounded-[16px]  py-[16px] px-[4px] border"}
                        >


                      
                        <span className="flex grow w-full text-moumate_black font-[16px] font-ibm pl-[8px]">
                          {choice4}
                        </span>


                      </div>

                    </div>


                    <div className="w-full flex flex-wrap gap-x-0 md:gap-x-4 justify-center">
                      <div className="w-1/2 md:w-[200px] items-center flex  pr-2">
                        
                        {

                          no > 1 ?
                            <button
                              onClick={() => { prev() }}
                              className="w-full md:w-[200px] flex items-center  rounded-[16px] py-[16px] px-[16px] bg-white border-moumate_blue text-moumate_blue font-medium  border-2 mt-[24px]  justify-center"
                            >
                              ย้อนกลับ
                            </button>
                            :
                            null

                        }
                      </div>


                      <div className="w-1/2 md:w-[200px] items-center flex  pl-2">

                            {
                              no < surveys.length ?
                              <button
                                onClick={() => { next() }}
                                disabled={choice == 0}
                                className={
                                  (choice == 0 ? ' bg-gray-200 ' : '  bg-moumate_blue ' )+
                                ( no == 1 ? ' w-full ' : '  w-full ' ) +" md:w-[200px] flex rounded-[16px] py-[16px] px-[16px]  mt-[24px] text-white justify-center"}
                              >
                                ถัดไป
                              </button>
                              :
                              null

                            }

                            {
                              no ==surveys.length?
                              <button
                                onClick={() => { calculate() }}
                                disabled={choice == 0}
                                className={
                                  (choice == 0 ? ' bg-gray-200 ' : '  bg-moumate_blue ' )+
                                  "w-full md:w-[200px] flex rounded-[16px] py-[16px] px-[16px]  mt-[24px] text-white justify-center"}>
                                ดูผลลัพธ์
                              </button>
                              :
                              null

                            }

                      </div>

                    </div>
                  </div>

                </div>

                 {/* RESULT  */}
                 {
                  resultCalculate ?
                  <div className={
                    (isShowResult ? '  ' : ' hidden ' ) + 
                    " w-full max-w-[720px] mx-[16px] lg:mx-0  bg-gray-100   rounded-[16px] py-[16px] px-[16px]   "}>

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
                      <span className="w-full text-center font-semibold justify-center uppercase flex  font-ibm text-[40px] text-moumate_blue">
                        ผลลัพธ์ออกมาแล้ว คุณคือ...
                      </span>

                      <div className="w-full max-w-[400px] flex flex-wrap  bg-white   rounded-[16px] py-[16px] px-[16px]  mt-4">
                            <span className="w-full flex mt-4 text-[30px] text-center justify-center">
                              {
                                resultCalculate.emoji
                              }
                            </span>
                            <span className="w-full flex mt-4 font-ibm text-black text-[20px] font-bold text-center justify-center">
                              {
                                resultCalculate.title
                              }
                            </span>
                            <span className="w-full flex mt-4  justify-center text-[14px] text-moumate_gray text-center">
                              {
                                resultCalculate.description
                              }
                            </span>
                      </div>

                      <div className="w-full max-w-[400px] flex flex-wrap  bg-white   rounded-[16px] py-[16px] px-[16px]  mt-4">
                            <span className="w-full flex mt-4 font-ibm text-black text-[20px] font-bold text-center justify-center">
                              จุดเด่น
                            </span>
                            <span className="w-full flex mt-4  justify-center text-[14px] text-moumate_gray text-center">
                              {
                                resultCalculate.strengths.join(" , ")
                              }
                            </span>
                      </div>



                  

                      <div className="w-full flex flex-wrap gap-x-0 md:gap-x-4 justify-center">
                        
                      
                          <div className="w-1/2 md:w-[200px] items-center flex">
                            <button
                              onClick={() => { gotoResultShare() }}
                              className={'  bg-moumate_blue w-full flex rounded-[16px] py-[16px] px-[16px]  mt-[24px] text-white justify-center'}
                              >

                            <div className="w-fit  mr-2">
                                <Image
                                  className=" "
                                  alt="mootech-icon"
                                  src={'/images/mumate/Share.svg'}
                                  width={24}
                                  height={24}
                                />
                            </div> 
                              
                            <span>แชร์</span>
                            </button>
                          </div>  
                          
                          {/* <div className="w-1/2 md:w-[200px]  items-center flex  pl-2">
                            <button
                              onClick={() => { gotoResult() }}
                                className="flex flex-wrap  w-full rounded-[16px] py-[16px] px-[16px] bg-white border-moumate_blue text-moumate_blue font-medium  border-2 mt-[24px]  justify-center"
                                >
                              <div className="w-fit  mr-2">
                                  <Image
                                    className="  "
                                    alt="mootech-icon"
                                    src={'/images/mumate/Inactive.svg'}
                                    width={24}
                                    height={24}
                                  />
                              </div> 
                              <span>บันทึก</span>
                            </button>
                          </div> */}

                    
                      </div>
                    </div>

                  </div>
                  :
                  null

                 }

            </div>
            
          </div>
      </div>

    
    
      
    </div>
  );
}
