import Image from 'next/image'
import { useState } from 'react'

type ComponentProps = {
  onClose: any,
  onSubmitOK: any
}
const ModalPaymentCreditCard = ({
  onClose,
  onSubmitOK,
}: ComponentProps) => {


  const [name, setName] = useState<string>("");
  const [number, setNumber] = useState<string>("");
  const [expMonth, setExpMonth] = useState<string>("");
  const [expYear, setExpYear] = useState<string>("");
  const [cvv, setCvv] = useState<string>("");

  const onChangeName = (event: any) => {
    setName(event.target.value)
  }
  const onChangeNumber = (event: any) => {
    setNumber(event.target.value)
  }
  const onChangeExpMonth = (event: any) => {
    setExpMonth(event.target.value)
  }
  const onChangeExpYear = (event: any) => {
    setExpYear(event.target.value)
  }
  const onChangeCVV = (event: any) => {
    setCvv(event.target.value)
  }

  const isValid = () => {
    if (name == '') {
      return false
    }
    if (number == '') {
      return false
    }
    if (expMonth == '') {
      return false
    }
    if (expYear == '') {
      return false
    }
    if (cvv == '') {
      return false
    }
    return true
  }


  const onClickSubmit = async () => {
    if (isValid()) {
      onSubmitOK(name, number, expMonth, expYear, cvv)
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

                      onClick={() => { onClose() }}
                alt="ic_alert_success"
                src={'/images/mumate/x-mark.svg'}
                width={24}
                className=' cursor-pointer '
                height={24}
              /> 
            </div>
            <div className=" grow w-full flex flex-wrap ">
              <span
                className="flex w-full justify-center  text-[24px] font-ibm text-moumate_blue mt-4 font-bold"
              >
                กรุรากรอกข้อมูลบัตร
              </span>
              
             
              {/* Name input */}
              <div className="w-full flex flex-wrap mt-[24px]">
                <div className="w-full flex flex-wrap">
                  <span className="font-ibm font-medium text-[16px] text-moumate_black">
                    ชื่อ - นามสกุล (ภาษาอังกฤษ)
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

              <div className="w-full flex flex-wrap mt-[24px]">
                <div className="w-full flex flex-wrap">
                  <span className="font-ibm font-medium text-[16px] text-moumate_black">
                    หมายเลขบัตร 16 หลัก
                  </span>
                  <span className="font-ibm font-medium text-[16px] text-moumate_red pl-1">
                    *
                  </span>
                </div>
                <div className="w-full flex flex-wrap">
                  <input
                    value={number}
                    onChange={(e) => { onChangeNumber(e) }}
                    className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                    type="text"
                    placeholder='4444555566667777'
                  />
                </div>
              </div>

            <div className='w-full grid grid-cols-3 gap-x-3 mt-[24px]'>
              <div className="w-full flex flex-wrap">
                <div className="w-full flex flex-wrap">
                  <input
                    value={expMonth}
                    onChange={(e) => { onChangeExpMonth(e) }}
                    className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                    type="text"
                    placeholder='MM'
                  />
                </div>
              </div>
              <div className="w-full flex flex-wrap">
                <div className="w-full flex flex-wrap">
                  <input
                    value={expYear}
                    onChange={(e) => { onChangeExpYear(e) }}
                    className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                    type="text"
                    placeholder='YYYY'
                  />
                </div>
              </div>
              <div className="w-full flex flex-wrap">
                <div className="w-full flex flex-wrap">
                  <input
                    value={cvv}
                    onChange={(e) => { onChangeCVV(e) }}
                    className="w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]"
                    type="text"
                    placeholder='CVV'
                  />
                </div>
              </div>
            </div>






            </div>

          <div className="w-full flex flex-wrap py-4   justify-center">
           
                        <button
                      onClick={() => { onClickSubmit() }}
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

export default ModalPaymentCreditCard
