import Image from 'next/image'

type ComponentProps = {
  code: string,
  onSubmitOK: any
}
const ModalFriendGetFriend = ({
  code,
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

        <div className=" w-full  lg:w-[400px] inline-block bg-white rounded-xl   overflow-hidden shadow-box transform transition-all  align-middle">
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
                src={'/images/mumate/ic_gift.svg'}
                width={64}
                height={64}
              /> 
            </div>
            <div className="  w-full flex flex-wrap ">
              <span
                className="flex w-full justify-center text-[18px]  md:text-[24px] font-ibm text-moumate_blue mt-4 font-semibold"
              >
                Friend get Friend
              </span>
              <span
                className={
                  ' text-center  ' +
                  ' flex justify-center w-full mt-2  text-[12px] md:text-[16px] text-black'
                }
              >
                เพียงชวนเพื่อนมาสมัครสมาชิกกับ MUMATE รับสิทธิเช็คเรื่องความรัก และการงานเพิ่มทันที
              </span>

              <div className='w-full flex flex-nowrap items-center bg-bg_gray py-4 px-4 rounded-[16px] mt-2'>

                <span className=' w-full grow text-left  text-moumate_gray font-ibm text-[14px] truncate '>{code}</span>

                <div className='flex-none w-fit'>
                    <Image
                      onClick={ () => { 
                      navigator.clipboard.writeText(code) }}
                      alt="ic_alert_success"
                      className=' cursor-pointer '
                      src={'/images/mumate/ic_link.svg'}
                      width={20}
                      height={20}
                    /> 
                </div>

              </div>


            </div>


            <div className="  w-full flex flex-wrap border rounded-[16px] border-border_gray mt-4 p-4 ">

              <span className=' font-ibm  font-semibold text-[16px]'>ขั้นตอนการร่วมกิจกรรม</span>

              <div className='w-full flex items-center flex-nowrap mt-2'>

                <span className=' flex-none rounded-full bg-[#EEFDFD] text-[#1B9AAF] w-[32px] h-[32px] flex items-center justify-center '>1</span>
                <span className=' pl-3 text-black text-left text-[14px]'>คัดลอกลิงค์ของคุณ</span>
              </div>


              <div className='w-full flex items-center flex-nowrap mt-2'>

                <span className=' flex-none rounded-full bg-[#EEFDFD] text-[#1B9AAF] w-[32px] h-[32px] flex items-center justify-center '>2</span>
                <span className=' pl-3 text-black text-left text-[14px]'>ส่งลิงค์ให้เพื่อนที่ต้องการสมัครสมาชิก</span>
              </div>


              <div className='w-full flex items-center flex-nowrap mt-2'>

                <span className=' flex-none rounded-full bg-[#EEFDFD] text-[#1B9AAF] w-[32px] h-[32px] flex items-center justify-center '>3</span>
                <span className=' pl-3 text-black text-left text-[14px]'>เมื่อสมัครสมาชิกเสร็จเรียบร้อย คุณจะได้รับสิทธิ์</span>
              </div>
            </div>
        

            <div className="  w-full flex flex-wrap border rounded-[16px] border-border_gray mt-4 p-4 ">

              <span className=' font-ibm  font-semibold text-[16px]'>เงื่อนไขกิจกรรม</span>

             <ul>
              <li className=' text-left text-black text-[14px]'>เมื่อมีการสมัครสมาชิก 1 ครั้ง <span className='text-moumate_blue'>รับสิทธิเพิ่ม 1 ครั้ง/เรื่อง</span></li>
              <li className=' text-left text-black mt-2 text-[14px]'>เมื่อมีการสมัครสมาชิก 3 ครั้ง <span className='text-moumate_blue'>รับสิทธิเพิ่ม 10 ครั้ง/เรื่อง </span></li>
             </ul>
            </div>
        
          </div>
        </div>


      </div>
    </div>
  )
}

export default ModalFriendGetFriend
