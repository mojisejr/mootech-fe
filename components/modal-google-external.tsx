import Image from "next/image";

// Consent notice shown when a LINE in-app webview user taps Google login
// (#mumate-line-webview-oauth, Fix A / P1.5). Google blocks OAuth inside the LINE
// webview, so the flow must continue in the external browser — this modal explains
// why before the jump so the user is not surprised, and nudges LINE login for those
// who want to stay in the app. Modeled on the existing modal-* pattern for grammar
// consistency (no new dialog primitive).
type ComponentProps = {
  onProceed: () => void;
  onCancel: () => void;
};

const ModalGoogleExternal = ({ onProceed, onCancel }: ComponentProps) => {
  return (
    <div
      className={"  fixed z-[9999] inset-0 overflow-y-auto  "}
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center md:items-end justify-center h-full md:h-fit lg:max-h-screen pt-4 px-4 md:px-12 lg:px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-black backdrop-blur-[10px] bg-opacity-[0.48] transition-opacity"
          aria-hidden="true"
        ></div>

        <span className="hidden sm:inline-block align-middle h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div className="w-full lg:w-[460px] inline-block bg-white rounded-xl overflow-hidden shadow-box transform transition-all align-middle">
          <div className="w-full flex flex-wrap py-[26px] px-6">
            <div className="w-full flex flex-wrap justify-end">
              <Image
                onClick={() => onCancel()}
                alt="ปิด"
                src={"/images/mumate/x-mark.svg"}
                width={24}
                className="cursor-pointer"
                height={24}
              />
            </div>

            <div className="w-full flex flex-wrap justify-center">
              <Image
                alt="google"
                src={"/images/mumate/ic_google.svg"}
                width={56}
                height={56}
              />
            </div>

            <div className="grow w-full flex flex-wrap">
              <span className="flex w-full justify-center text-[24px] font-ibm text-moumate_blue mt-4 font-semibold">
                เข้าสู่ระบบด้วย Google
              </span>
              <span className="text-center flex justify-center w-full mt-3 text-[16px] text-black">
                เพื่อความปลอดภัย Google กำหนดให้เข้าสู่ระบบผ่านเบราว์เซอร์
                (Chrome/Safari) เราจะพาคุณไปเข้าสู่ระบบและใช้งานต่อที่นั่นค่ะ
              </span>
              <span className="text-center flex justify-center w-full mt-4 text-[15px] text-moumate_blue">
                💡 หรือกด &ldquo;ดำเนินการต่อด้วย Line&rdquo; เพื่อใช้งานในแอปได้ทันที
              </span>
            </div>

            <div className="w-full flex flex-wrap gap-3 mt-6">
              <button
                onClick={() => onProceed()}
                className="w-full rounded-[16px] py-[16px] px-[16px] bg-moumate_blue text-white font-semibold justify-center"
              >
                เปิดในเบราว์เซอร์
              </button>
              <button
                onClick={() => onCancel()}
                className="w-full rounded-[16px] py-[16px] px-[16px] border border-border_gray bg-white text-black justify-center"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalGoogleExternal;
