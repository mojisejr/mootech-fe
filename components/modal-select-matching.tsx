
type ComponentProps = {
  onClickMatching: any,
}
const ModalSelectMatching = ({
  onClickMatching
}: ComponentProps) => {




  const onSelectMatching = (type: string, desc: string) => {
    onClickMatching(type, desc)
  } 
  

  return (
    <div
      className={' w-full  fixed z-[9999] inset-0 overflow-y-auto  '}
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center md:items-end justify-center h-full md:h-fit  lg:max-h-screen pt-4 px-4 md:px-12 lg:px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed  inset-0 bg-black backdrop-blur-[10px] bg-opacity-[0.48] transition-opacity"
          aria-hidden="true"
        ></div>

        <span className="hidden sm:inline-block align-middle h-screen" aria-hidden="true">
          &#8203;
        </span>

<div className="
  fixed bottom-0 left-1/2
  -translate-x-1/2
  w-full lg:w-[460px]
  mt-5 overflow-hidden
  shadow-box transform transition-all
  align-middle
">
      

                        <div 
                className="w-full bg-[#F2F7FD]  rounded-t-[32px] h-fit  justify-center font-prompt flex-wrap">

       


                  <div className=' w-full flex flex-wrap px-[32px] py-6 '>

                



                      <div className='w-full flex flex-wrap justify-center'>
                          <div 
                          onClick={() => { onSelectMatching('LOVE', 'ดวงสมพงศ์ในฐานะคู่รัก') }}
                          className='w-full flex text-[18px] flex-wrap py-6 px-4  cursor-pointer justify-start'>
                              ดวงสมพงศ์ในฐานะคู่รัก
        
                          </div>
                          <div 
                          
                          onClick={() => { onSelectMatching('WORK', 'ดวงสมพงศ์ในฐานะเพื่อนร่วมงาน') }}
                          className='w-full flex text-[18px] flex-wrap py-6 px-4  cursor-pointer justify-start'>
                              ดวงสมพงศ์ในฐานะเพื่อนร่วมงาน
        
                          </div>

                          

                      </div>


                  </div>

          

              
                </div>


        </div>
      </div>
    </div>
  )
}

export default ModalSelectMatching
