import Image from 'next/image'

type ComponentProps = {
  onSubmitOK: any
}
const ModalComingSoon = ({
  onSubmitOK,
}: ComponentProps) => {
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

                      onClick={() => { onSubmitOK() }}
                alt="ic_alert_success"
                src={'/images/mumate/x-mark.svg'}
                width={24}
                className=' cursor-pointer '
                height={24}
              /> 
            </div>
            <div className="w-full flex flex-wrap justify-center">
              <Image
                alt="ic_alert_success"
                src={'/images/mumate/ic_lock.svg'}
                width={64}
                height={64}
              /> 
            </div>
            <div className=" grow w-full flex flex-wrap ">
              <span
                className="flex w-full justify-center  text-[24px] font-ibm text-moumate_blue mt-4 font-semibold"
              >
                Coming Soon!
              </span>
              <span
                className={
                  ' text-center  ' +
                  ' flex justify-center w-full mt-2  text-[16px] text-black'
                }
              >
                จะเปิดให้ใช้เร็วๆ นี้
              </span>
              <span
                className={
                  ' text-center  ' +
                  ' flex justify-center  w-full text-[24px] font-ibm text-black mt-4 font-semibold'
                }
              >
                ใครอยากเป็นคนแรกที่ได้ลอง?
              </span>
              <span
                className={
                  ' text-center  ' +
                  ' flex justify-center  w-full text-[16px]  text-moumate_blue mt-4 '
                }
              >
                เพิ่ม Mumate เป็นเพื่อนในไลน์ไว้เลย
              </span>
              <span
                className={
                  ' text-center  ' +
                  ' flex justify-center  w-full text-[16px]  text-black mt-4'
                }
              >
                Launch แล้ว บอกก่อนใครแน่นอน! 🚀
              </span>
              <span
                className={
                  ' text-center  ' +
                  ' flex justify-center  w-full text-black font-ibm font-semibold   text-[18px]  mt-4'
                }
              >
                Line ID: <span className=' ml-2 text-moumate_blue'>@mumate</span>
              </span>
              <span
                className={
                  ' text-center  ' +
                  ' flex justify-center  w-full  mt-2  text-[16px] text-black'
                }
              >
                (มี @ ด้วยนะ!)
              </span>



                <div className="w-full flex flex-wrap justify-center  mt-4">
                  <div className='w-fit p-4 rounded-[16px] border border-border_gray'>
                    <Image
                      alt="ic_alert_success"
                      src={'/images/mumate/qrcode_line.png'}
                      width={150}
                      height={150}
                    /> 
                  </div>
                </div>
            </div>

          <div className="w-full flex flex-wrap py-4  px-4 justify-center">
                        <a 
                    className=' w-full'
                    target="_blank" 

                    href="https://line.me/ti/p/~@mumate" 
                    rel="noopener noreferrer">       
                    <button
                      className="w-full  rounded-[16px] py-[16px] px-[16px] bg-moumate_blue mt-2 text-white justify-center"
                    >
                     เพิ่มเพื่อน
                    </button>

                    </a>

              

          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModalComingSoon
