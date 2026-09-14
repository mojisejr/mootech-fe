// รางวัลติดตั้งแอป — +30 QI "ครั้งเดียวต่อบัญชี" (ผู้ใช้ 2026-09-14).
//
// เมื่อผู้ใช้เปิดแอปในโหมดที่ติดตั้งแล้ว (standalone) เรายิง POST /api/qi-earn { code:"install_pwa" } หนึ่งครั้ง.
// การกันจ่ายซ้ำอยู่ฝั่ง engine (earnQi + ตาราง bazi_qi_claim, key = anonId+code+"all") → ผูกกับ "บัญชี" ไม่ใช่
// เครื่อง → ลบแอปแล้วติดตั้งใหม่ก็ไม่ได้รับซ้ำ. ฝั่ง client กันยิงถี่ ๆ ด้วย module-flag (ยิงครั้งเดียวต่อการโหลด
// หน้า) แล้ว broadcast ผลให้ทุก component ที่ subscribe (โฮม/โปรไฟล์) แสดงตรงกัน — เลียน pattern use-install-prompt.
import { useEffect, useState } from 'react'
import { usePwaInstall } from './use-install-prompt'

export type InstallRewardState = 'idle' | 'earned' | 'already'

let rewardState: InstallRewardState = 'idle'
let claimTried = false
let rewardBalance: number | null = null
const CHANGED = 'mumate:install-reward-changed'

async function claimOnce(): Promise<void> {
  if (claimTried) return
  claimTried = true
  try {
    const r = await fetch('/api/qi-earn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'install_pwa' }),
    })
    if (r.ok) {
      const d = (await r.json()) as { awarded?: boolean; balance?: number }
      rewardState = d?.awarded ? 'earned' : 'already'
      if (typeof d?.balance === 'number') rewardBalance = d.balance
    } else {
      claimTried = false // ล้มเหลว (เช่น 401 ยังไม่ล็อกอิน) → ให้ลองใหม่รอบหน้าได้
    }
  } catch {
    claimTried = false
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED))
}

/** ยิงรับรางวัลติดตั้ง (idempotent) เมื่อรันเป็นแอปที่ติดตั้งแล้ว + คืนสถานะให้โชว์ผล. */
export function useInstallReward(): { state: InstallRewardState; balance: number | null } {
  const { installed } = usePwaInstall()
  const [state, setState] = useState<InstallRewardState>(rewardState)
  const [balance, setBalance] = useState<number | null>(rewardBalance)

  useEffect(() => {
    const sync = () => { setState(rewardState); setBalance(rewardBalance) }
    window.addEventListener(CHANGED, sync)
    if (installed) void claimOnce()
    sync()
    return () => window.removeEventListener(CHANGED, sync)
  }, [installed])

  return { state, balance }
}
