// features/v2-account/components/MyCoursesCard.tsx — "คอร์สเรียน" ในหน้าโปรไฟล์ (เอ็ม 2026-10-21)
// ทุกคนเห็น: มีสิทธิ์แล้ว (ซื้อ/สมาชิก/ได้รับสิทธิ์) → "เรียนต่อ" เข้าหน้าคอร์ส · ยังไม่มี → "ดูคอร์ส" ไปหน้าขาย (ซื้อได้จากหน้านั้น)
import Link from "next/link"

export type MyCourse = {
  slug: string
  name: string
  access: boolean
  via: "member" | "purchase" | "grant" | null
  ready: number
  total: number
  /** ป้ายราคาบนปุ่มตอนยังไม่มีสิทธิ์ เช่น ฿490 */
  priceLabel?: string
}

export function MyCoursesCard({ courses }: { courses: MyCourse[] }) {
  if (courses.length === 0) return null
  const owned = courses.some((c) => c.access)
  return (
    <section data-testid="account-my-courses" className="v3-shadow-card flex w-full flex-col overflow-hidden rounded-[24px] bg-white">
      <p className="px-4 pt-3.5 text-[14px] font-bold text-v3-navy">🎓 {owned ? "คอร์สของฉัน" : "คอร์สเรียน Mumate"}</p>
      {courses.map((c) => (
        <Link key={c.slug} href={`/course/${c.slug}`} data-testid={`account-course-${c.slug}`} className="flex items-center gap-3 px-4 py-3.5">
          <span aria-hidden className="grid size-[38px] flex-none place-items-center rounded-[12px] bg-v3-sky-tint text-[18px]">{c.access ? "▶" : "🎓"}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="truncate text-[14px] font-medium leading-5 text-v3-navy">{c.name}</p>
            <p className="text-[12px] leading-[18px] text-v3-text-body">
              {c.access
                ? `${c.via === "member" ? "สิทธิ์สมาชิก" : c.via === "grant" ? "ได้รับสิทธิ์" : "ซื้อแล้ว"} · พร้อมเรียน ${c.ready}/${c.total} บท`
                : `${c.total} บท · ดูตัวอย่างฟรีได้`}
            </p>
          </div>
          {c.access ? (
            <span data-testid={`account-course-${c.slug}-learn`} className="flex-none rounded-full bg-v3-sapphire px-3 py-1.5 text-[12px] font-bold text-v3-lime">เรียนต่อ</span>
          ) : (
            <span data-testid={`account-course-${c.slug}-buy`} className="flex-none rounded-full border border-v3-sapphire px-3 py-1.5 text-[12px] font-bold text-v3-sapphire">
              {c.priceLabel ? `ซื้อคอร์ส ${c.priceLabel}` : "ดูคอร์ส"}
            </span>
          )}
        </Link>
      ))}
    </section>
  )
}
