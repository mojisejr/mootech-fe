import { OTPGet } from '@/constants/api/api-otp-get'
import { OTPVerify } from '@/constants/api/api-otp-verify'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

type ComponentProps = {
  tel: string,
  refCode: string
  onClose: any,
  onSubmitOK: any
}
const ModalOTP = ({
  tel,
  refCode,
  onClose,
  onSubmitOK,
}: ComponentProps) => {

  const [otp, setOtp] = useState(Array(6).fill(''));

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);


  const [refCodeInfo, setRefCodeInfo] = useState<string>(refCode)
  const [counting, setCounting] = useState<number>(60)

  const [isError, setIsError] = useState<boolean>(false)

    useEffect(() => {
    if (counting === 0) return;

    const timer = setInterval(() => {
      setCounting((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer); // เคลียร์เมื่อ component unmount หรือ counting เปลี่ยน
  }, [counting]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return; // ให้เฉพาะตัวเลข

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };



  const onClickClose = () => {
    onClose()
  }

  const onClickSubmit = () => {
    onClose()
  }


  const isValid = () => {
    if (otp.toString().replaceAll(',', '').length == 6) {
      return true
    }

    return false
  }

  const getOTP = async () => {
    setIsError(false)
    setOtp(Array(6).fill(''))
    await callApiGetOtp();

  }


  const onSubmit = async () => {

    setIsError(false)

    if (isValid()) {
      await callApiVerifyOtp()
    }
  }


  const callApiGetOtp = async () => {
    const result = await OTPGet(tel)
    // #167 — OTPGet is unverified (live SMS, can't hit), so ref_code is `unknown`; narrow at runtime
    // before using it as a string instead of trusting the old blind cast.
    if (result && typeof result.ref_code === 'string') {
      setRefCodeInfo(result.ref_code);
      setCounting(60)
    }
  }


    const callApiVerifyOtp = async () => {
      const otpData = otp.toString().replaceAll(',', '')
      const result = await OTPVerify(refCodeInfo, otpData)
      if (result && result.status && result.status == 200) {
        onSubmitOK(result.is_new, result.user_id, result.name, result.surname, result.refer_code)
      } else {
        setIsError(true)
      }
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

        <div className=" w-full  lg:w-[460px] inline-block bg-white rounded-xl   overflow-hidden shadow-box transform transition-all  align-middle">
          <div className="w-full flex flex-wrap py-[26px] px-6">
                 <div className="w-full flex flex-wrap justify-end">
                         <Image
           
                          onClick={() => { onClickClose() }}
                           alt="ic_alert_success"
                           src={'/images/mumate/x-mark.svg'}
                           width={24}
                           className=' cursor-pointer '
                           height={24}
                         /> 
                       </div>
           
            <div className=" grow w-full flex flex-wrap ">
             
              <span
                className={
                  ' text-center  ' +
                  ' flex justify-center  w-full text-[24px] font-ibm text-black mt-4 font-semibold'
                }
              >
                ยืนยันเบอร์โทรศัพท์
              </span>
              <span
                className={
                  ' text-center  ' +
                  ' flex justify-center  w-full text-[16px]  text-black mt-4'
                }
              >
                ระบุรหัส OTP
              </span>
              <span
                className={
                  ' text-center  ' +
                  ' flex justify-center  w-full  mt-2  text-[16px] text-black'
                }
              >
                Ref: <span className=' text-moumate_blue font-semibold ml-2'>{refCodeInfo}</span>
              </span>
              <span
                className={
                  ' text-center  ' +
                  ' flex justify-center  w-full text-[16px]  text-black mt-4'
                }
              >
                รหัสอ้างอิงจะหมดอายุภายใน 5 นาที
              </span>

              <div className='w-full flex flex-wrap gap-4 justify-center  mt-4'>

                {
                  otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type='text'
                    inputMode='numeric'
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className={
                      (isError ? ' border-red-600  ' : ' border-gray-200 ' ) + 
                      'w-[42px] h-[56px] flex justify-center text-center rounded-[4px] border border-gray-200'}

                  />
                ))}
              </div>

              {
                isError ? 
                <span
                className={
                  ' text-center  ' +
                  ' flex justify-center  w-full text-[16px]  text-red-600 mt-4'
                }
              >
                รหัสไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง

                </span>
                :
                null
              }

              {
                counting == 0 ?

              <span
                className={
                  ' text-center  ' +
                  ' flex justify-center  w-full text-[16px]  text-black mt-4'
                }
              >
                ขอรหัสใหม่ได้ในอีก  <span 
                onClick={() => { getOTP() }}
                className=' text-moumate_blue ml-2 underline cursor-pointer '>ขอรหัสใหม่</span>
              </span>

                :
                <span
                  className={
                    ' text-center  ' +
                    ' flex justify-center  w-full text-[16px]  text-black mt-4'
                  }
                >
                  ขอรหัสใหม่ได้ในอีก  <span className=' text-moumate_blue ml-2'>{counting}</span>
                </span>


              }


            </div>

          <div className="w-full flex flex-wrap py-4  px-4 justify-center">
                  
                    <button
                      onClick={() => { onSubmit() }}
                      disabled={!isValid()}
                      className={
                        ( isValid()?  ' bg-moumate_blue ' : ' bg-gray-200 ' ) + 
                        "w-full  rounded-[16px] py-[16px] px-[16px]  mt-2 text-white justify-center"}
                    >
                     ยืนยัน
                    </button>

              

          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModalOTP
