// หน้าจ่ายสำเร็จของเลน COURSE (คอร์สล้วน ไม่มีสมาชิก — เช่น downsell Bazi Life Matrix +199)
import { KitButton } from '@/features/v2-profile/components/kit'

export function CoursePaySuccess() {
  return (
    <div data-testid="course-only-success" className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-6 pb-8 pt-[90px] text-center font-ibm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/v2/shop/check-circle.svg" alt="" width={64} height={64} className="size-16" aria-hidden />
      <h1 role="status" aria-live="polite" className="text-2xl font-bold text-v3-sapphire">ชำระเงินสำเร็จ</h1>
      <p className="text-base font-bold text-v3-navy">🎓 ปลดล็อกคอร์ส Bazi Life Matrix แล้ว</p>
      <p className="text-sm leading-6 text-v3-text-body">เข้าเรียนได้ทั้งคอร์สปฏิทิน Win the Day และ Bazi Life Matrix · ดูซ้ำได้ตลอดชีพ</p>
      <KitButton href="/course/calendar" testId="course-only-success-cal" className="!h-[52px]">เข้าเรียนคอร์สปฏิทิน</KitButton>
      <KitButton href="/course/life-matrix" testId="course-only-success-matrix" className="!h-[52px]">ไปคอร์ส Bazi Life Matrix</KitButton>
    </div>
  )
}
