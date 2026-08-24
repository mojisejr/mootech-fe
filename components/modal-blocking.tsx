// #427 — v1 ปิดการขายแล้ว (#376) โมดัลนี้จึงชวนคนไปทำสิ่งที่ระบบทำให้ไม่ได้
//
// ปุ่ม "ไปหน้าสมัครสมาชิก" เคยพาไป /package-price ด้วย router.replace สองชั้น: พาไปเจอ "ปิดการขายชั่วคราว"
// (ซึ่งตอบ ไม่ได้เงียบ) แต่ replace ทับ history ⇒ กด back ไม่กลับมาที่ดวงสมพงศ์/เซียมซีที่เขากำลังดูอยู่
// ⇒ ผู้ใช้เดินฟรีหนึ่งจอเพื่อไปรู้ว่าซื้อไม่ได้ แล้วกลับที่เดิมไม่ได้
//
// ตอบตรงที่ปุ่ม แทนการพาไปอีกหน้า — ท่าเดียวกับ chat-topup-notice / profile-topup-notice ใน #376
// `onGoSubscribe` ยังอยู่ในสัญญาของคอมโพเนนต์ ไม่ถูกลบ (Principle 1): เปิดการขายกลับเมื่อไหร่
// เอา onClick กลับไปเรียกมันได้ทันที โดยผู้เรียกทั้ง 4 ที่ไม่ต้องแก้อะไรเลย
import Image from 'next/image'
import { useState } from 'react'

type ComponentProps = {
  onSubmitOK: any
  /** ยังอยู่ในสัญญาเดิมโดยตั้งใจ — ดูหัวไฟล์ */
  onGoSubscribe: any
}

const ModalBlocking = ({
  onSubmitOK,
  onGoSubscribe,
}: ComponentProps) => {
  const [salesClosedNotice, setSalesClosedNotice] = useState(false)
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
                type="button"
                data-testid="blocking-subscribe"
                onClick={() => setSalesClosedNotice(true)}
                className="w-full bg-moumate_blue text-white py-3 rounded-[12px] font-semibold text-[16px] hover:opacity-90 transition"
              >
                ไปหน้าสมัครสมาชิก
              </button>
              {/* คำตอบอยู่ในโมดัลเดียวกัน (z-[9999] ที่บรรทัด 22) ไม่ใช่ toast ระดับ document ที่จะไปวาดอยู่ข้างใต้ */}
              {salesClosedNotice && (
                <p
                  data-testid="blocking-subscribe-notice"
                  role="status"
                  aria-live="polite"
                  className="mt-3 text-center text-[14px] leading-6 text-moumate_black"
                >
                  ตอนนี้ปิดการขายชั่วคราว เรากำลังปรับแพ็กเกจใหม่
                  <br />
                  สิทธิ์ที่ซื้อไว้แล้วยังใช้งานได้ตามปกติ
                </p>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

export default ModalBlocking