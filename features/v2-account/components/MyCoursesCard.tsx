// features/v2-account/components/MyCoursesCard.tsx — "คอร์สของฉัน" ในหน้าโปรไฟล์ (เอ็ม 2026-10-21)
// โชว์เฉพาะคอร์สที่ผู้ใช้มีสิทธิ์ (ซื้อแล้ว หรือสิทธิ์สมาชิก — /api/course/[slug] access) · ไม่มีสักคอร์ส = ไม่วาดการ์ด
import Link from "next/link"

export type MyCourse = { slug: string; name: string; via: "member" | "purchase" | null; ready: number; total: number }

export function MyCoursesCard({ courses }: { courses: MyCourse[] }) {
  if (courses.length === 0) return null
  return (
    <section data-testid="account-my-courses" className="v3-shadow-card flex w-full flex-col overflow-hidden rounded-[24px] bg-white">
      <p className="px-4 pt-3.5 text-[14px] font-bold text-v3-navy">🎓 คอร์สของฉัน</p>
      {courses.map((c) => (
        <Link key={c.slug} href={`/course/${c.slug}`} data-testid={`account-course-${c.slug}`} className="flex items-center gap-3 px-4 py-3.5">
          <span aria-hidden className="grid size-[38px] flex-none place-items-center rounded-[12px] bg-v3-sky-tint text-[18px]">▶</span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="truncate text-[14px] font-medium leading-5 text-v3-navy">{c.name}</p>
            <p className="text-[12px] leading-[18px] text-v3-text-body">
              {c.via === "member" ? "สิทธิ์สมาชิก" : "ซื้อแล้ว"} · พร้อมเรียน {c.ready}/{c.total} บท
            </p>
          </div>
          <span className="flex-none rounded-full bg-v3-sapphire px-3 py-1.5 text-[12px] font-bold text-v3-lime">เรียนต่อ</span>
        </Link>
      ))}
    </section>
  )
}
