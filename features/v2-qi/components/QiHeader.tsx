// features/v2-qi/components/QiHeader.tsx — หัวจอย่อยของกลุ่ม /v2/qi (missions/history/referral).
// รูปแบบเดียวกับหัวจอ QiScreen เดิม (ลิงก์ย้อน + ชื่อจอ) — จอย่อยของชี่ใช้ header นี้ ไม่ใช่ AppHeader
// (พื้นที่ชี่ไม่โชว์ป้ายสิทธิ์/ปุ่มขาย — เดิมที QiScreen เองก็ไม่ผ่าน AppHeader)
import Head from "next/head"
import type { ReactNode } from "react"

import { BackButton } from "@/features/v2-profile/components/kit"

export function QiHeader({ title, testId, right }: { title: string; testId: string; right?: ReactNode }) {
  return (
    <>
      <Head>
        <title>{title} — Mumate</title>
      </Head>
      <header className="flex w-full items-center gap-2 pt-4">
        <BackButton fallbackHref="/v2/qi" testId={`${testId}-back`} />
        <h1 className="text-lg font-black leading-6 text-v3-navy">{title}</h1>
        {right ? <div className="ml-auto flex-none">{right}</div> : null}
      </header>
    </>
  )
}
