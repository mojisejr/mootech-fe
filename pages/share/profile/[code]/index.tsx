import Image from "next/image";
import { useRouter } from "next/router";
import Head from "next/head";
import { useEffect, useState } from "react";
import { ChineseHoroscopeGetShareProfile } from "@/constants/api/api-chinese-horoscope-get-share-profile";
import { PageRouter } from "@/constants/router";
import html2canvas from 'html2canvas';

export default function ShareProfilePage() {
  const router = useRouter();

    const [code, setCode] = useState<any>(null)
    const callback = router.query.callback as string 

    const [resultHoroscope, setResultHoroscope] = useState<any>(null)

    useEffect(() => {
  
      if (router.query) {
        const {code} = router.query
        if (code) {
          setCode(code)
          callGetResult(code)
        }
      }
  
    }, [router.query])

    const callGetResult = async (code: any) => {
  
      const result = await ChineseHoroscopeGetShareProfile(code)
      if (result && result.data) {
  
        const data = result.data
        setResultHoroscope(data)

        
      } else {
        router.replace(PageRouter.HOME)
      }
    }
    
    

  const gotoLogin = () => {
    router.push(PageRouter.LOGIN + '?callback=' + callback)
  }


 const gotoBack = () => {
    router.replace(PageRouter.HOME)
  }
    


  return (
    <div
    className='w-full bg-white min-h-screen  flex justify-center h-fit font-ibm'
    >
    <Head>
        <title>Mumate</title>
      </Head>
      <div className="w-full flex flex-wrap"> 
          <div className="w-full bg-moumate_blue h-[72px] flex justify-center items-center z-50 fixed top-0 left-0">

                <div 
                            onClick={gotoBack}
                className="flex  w-[110px] cursor-pointer">
                  <Image
                    className=""
                    alt="mootech-icon"
                    src={'/images/mumate/ic_logo.svg'}
                    width={110}
                    height={26}
                  />
                </div>
          </div>

          <div 
            className="w-full min-h-full bg-cover bg-center pt-[72px]"
            style={{ backgroundImage: "url('/images/mumate/img_bg_home.jpg')" }}>


            <div className="w-full flex flex-wrap py-0 lg:py-[60px] h-full items-center justify-center">
              <div className="w-full md:w-[500px] flex flex-wrap px-8 md:px-0">

                <span className="w-full text-white text-center font-chonburi text-[48px] font-semibold">{ resultHoroscope?.mascot?.name}</span>

                <div className="mt-4 w-full flex flex-wrap ">

                  <div className="w-full flex md:hidden lg:hidden justify-center flex-wrap ">
                    <Image
                      src={ resultHoroscope?.mascot?.url}
                      width={174}
                      height={261}
                      className=" rounded-xl shadow-lg "
                      alt="icon-result"/>
                  </div>

                  <div className="w-full  hidden md:flex lg:flex  justify-center flex-wrap ">
                    <Image         
                      src={ resultHoroscope?.mascot?.url}
                      width={200}
                      height={261}
                      className=" rounded-xl shadow-lg "
                      alt="icon-result"/>
                  </div>


                </div>

                <span className="w-full text-white text-center text-[24px] mt-4 font-semibold">พื้นฐานบุคลิกของฉัน</span>
                <span className="w-full text-white text-center text-[18px] mt-4 font-normal">
                  { resultHoroscope?.analytic?.base}
                </span>


                <span className="w-full text-white text-center text-[18px] mt-12 font-normal">อยากรู้ไหมว่าเราเหมือนกันมั้ย?</span>
                
                <div className="mt-4 w-full flex flex-wrap justify-center ">

                    <button
                        onClick={ () => { gotoLogin() }}
                        className={
                          ' bg-moumate_blue ' + 
                          " w-full md:w-[200px] rounded-[16px] py-[16px] px-[16px] mt-[24px] text-white justify-center"}
                      >
                      เช็คของคุณดู! ✨
                    </button>
                </div>
            </div>
            </div>

          </div>
      </div>

    </div>
  );
}
