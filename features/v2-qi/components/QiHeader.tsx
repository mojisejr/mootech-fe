// features/v2-qi/components/QiHeader.tsx — หัวจอย่อยของกลุ่ม /v2/qi (missions/history/referral).
// รูปแบบเดียวกับหัวจอ QiScreen เดิม (ลิงก์ย้อน + ชื่อจอ) — จอย่อยของชี่ใช้ header นี้ ไม่ใช่ AppHeader
// (พื้นที่ชี่ไม่โชว์ป้ายสิทธิ์/ปุ่มขาย — เดิมที QiScreen เองก็ไม่ผ่าน AppHeader)
import Head from "next/head"
import Link from "next/link"

export function QiHeader({ title, testId }: { title: string; testId: string }) {
  return (
    <>
      <Head>
        <title>{title} — Mumate</title>
      </Head>
      <header className="flex w-full items-center gap-2 pt-4">
        <Link
          href="/v2/qi"
          aria-label="ย้อนกลับ"
          data-testid={`${testId}-back`}
          className="grid h-9 w-9 flex-none place-items-center rounded-full text-v3-navy hover:bg-black/5"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="text-lg font-black leading-6 text-v3-navy">{title}</h1>
      </header>
    </>
  )
}
