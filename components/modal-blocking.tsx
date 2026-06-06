import Image from 'next/image'

type ComponentProps = {
  onSubmitOK: any
  onGoSubscribe: any
}

const ModalBlocking = ({
  onSubmitOK,
  onGoSubscribe,
}: ComponentProps) => {
  return (
    <div
      className="fixed z-[9999] inset-0 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-center h-full px-4 pb-20 text-center sm:block sm:p-0">
        
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black backdrop-blur-[10px] bg-opacity-[0.48] transition-opacity"
          aria-hidden="true"
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>

        {/* Modal */}
        <div className="w-full max-w-[400px] inline-block bg-white rounded-xl overflow-hidden shadow-box transform transition-all align-middle">

          <div className="w-full flex flex-wrap py-[32px] px-6">

            {/* Close */}
            <div className="w-full flex justify-end">
              <Image
                onClick={() => onSubmitOK()}
                alt="close"
                src={'/images/mumate/x-mark.svg'}
                width={24}
                height={24}
                className="cursor-pointer"
              />
            </div>

            {/* Icon */}
            <div className="w-full flex justify-center mt-2">
              <Image
                alt="membership"
                src={'/images/mumate/ic_gift.svg'}
                width={64}
                height={64}
              />
            </div>

            {/* Title */}
            <div className="w-full mt-4">
              <span className="flex w-full justify-center text-[20px] md:text-[24px] font-ibm font-semibold text-moumate_blue text-center">
                กรุณาสมัครสมาชิก
              </span>
            </div>

            {/* Description */}
            <div className="w-full mt-3">
              <span className="block text-center text-[14px] md:text-[16px] text-black leading-relaxed">
                กรุณา สมัครสมาชิกรายเดือน หรือ รายปี <br />
                เพื่อเข้าใช้งาน Mumate ได้อย่างต่อเนื่อง
              </span>
            </div>

            {/* Button */}
            <div className="w-full mt-6">
              <button
                onClick={() => onGoSubscribe()}
                className="w-full bg-moumate_blue text-white py-3 rounded-[12px] font-semibold text-[16px] hover:opacity-90 transition"
              >
                ไปหน้าสมัครสมาชิก
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

export default ModalBlocking