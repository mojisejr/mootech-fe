import { UserRegisterOrLogin } from '@/constants/api/api-user-register-or-login'
import { UserRegisterTel } from '@/constants/api/api-user-register-tel'
import Image from 'next/image'
import { useState } from 'react'

type ComponentProps = {
  amount: number,
  onClose: any,
  onSubmitOK: any
}
const ModalPayment = ({
  amount,
  onClose,
  onSubmitOK,
}: ComponentProps) => {


  const [paymentMethod, setPaymentMethod] = useState<number>(1)


  const onClickSubmit = async () => {

      onSubmitOK(paymentMethod)
    
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
                เลือกช่องทางชำระเงิน
              </span>
              
             
              {/* Name input */}
              <div className="w-full flex flex-wrap mt-[24px]">
                <div className="w-full flex flex-wrap">
                  <input onChange={() => { setPaymentMethod(1) } } checked={paymentMethod == 1} type='radio' name="payment-method" value={1} />
                  <span className="font-ibm font-medium text-[16px] ml-4 text-moumate_black">
                    Credit card / Debit card
                  </span>
                </div>
              </div>
              <div className="w-full flex flex-wrap mt-[24px]">
                <div className="w-full flex flex-wrap">
                  <input onChange={() => { setPaymentMethod(2) } }  checked={paymentMethod == 2} type='radio' name="payment-method" value={2} />
                  <span className="font-ibm font-medium text-[16px] ml-4 text-moumate_black">
                    QR Code
                  </span>
                </div>
              </div>



              <div className="w-full flex flex-wrap mt-[24px]">
                <div className="w-full flex flex-wrap">
                  <span className="font-ibm font-medium text-3xl flex justify-center w-full ml-4 text-moumate_black">
                    ราคา {amount} บาท
                  </span>
                </div>
              </div>

            </div>

          <div className="w-full flex flex-wrap py-4   justify-center">
           
                        <button
                      onClick={() => { onClickSubmit() }}
                      className={
                        ' bg-moumate_blue ' + 
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

export default ModalPayment
