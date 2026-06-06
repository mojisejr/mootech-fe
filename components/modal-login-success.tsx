import Image from 'next/image'

type ComponentProps = {
}
const ModalLoginSuccess = ({
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

        <div className=" w-[250xp]  lg:w-[250px] inline-block bg-white rounded-xl   overflow-hidden shadow-box transform transition-all  align-middle">
          <div className="w-full flex flex-wrap ">
           
       
            <div className="w-full flex flex-wrap justify-center">
              <Image
                alt="ic_alert_success"
                src={'/images/mumate/img_login_success.png'}
                width={250}
                height={250}
              /> 
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default ModalLoginSuccess
