// features/v2-account/components/InstallAppCard.tsx — การ์ด "ติดตั้งแอปลงหน้าจอ" แบบถาวรบนหน้าโปรไฟล์
// (ผู้ใช้ 2026-09-14: ป็อปอัปหน้าแรกกดปิดแล้วหาย หาไม่เจอ → เอาที่ถาวรมาไว้ตรงที่หาเจอ). กดติดตั้งได้ทุกเมื่อ
// เพราะ deferred prompt อยู่ที่ module scope (usePwaInstall). + รางวัล +30 QI ครั้งเดียว/บัญชี (useInstallReward).
import { useState } from 'react'

import { usePwaInstall } from '@/lib/pwa/use-install-prompt'
import { useInstallReward } from '@/lib/pwa/use-install-reward'
import { InstallGuideSheet } from '@/features/v2-calendar/components/InstallGuideSheet'
import { KitButton, SectionCard } from '@/features/v2-profile/components/kit'

export function InstallAppCard() {
  const { canInstall, installed, promptInstall } = usePwaInstall()
  const { state: reward } = useInstallReward()
  const [guideOpen, setGuideOpen] = useState(false)

  const onInstall = () => {
    if (canInstall) { void promptInstall(); return } // Android/Chromium → native dialog
    setGuideOpen(true) // iOS / อื่น ๆ → สอนมือ (InstallGuideSheet)
  }

  return (
    <SectionCard testId="account-install" className="!rounded-[20px] gap-3">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-11 flex-none place-items-center rounded-[14px] bg-v3-sapphire/10 text-[22px]">📲</span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-v3-navy">
            {installed ? 'แอปอยู่บนหน้าจอแล้ว 🎉' : 'ติดตั้งแอปลงหน้าจอ'}
          </p>
          <p className="text-[13px] leading-[18px] text-v3-text-body">
            {installed
              ? reward === 'earned'
                ? 'รับ 30 QI โบนัสติดตั้งเรียบร้อย!'
                : reward === 'already'
                  ? 'ได้รับโบนัสติดตั้ง 30 QI ไปแล้ว'
                  : 'เปิดจากไอคอน MuMate บนหน้าจอได้เลย'
              : 'เพิ่มลงหน้าจอโฮม · แจ้งเตือนเด้งเหมือนแอป · เปิดได้เร็ว แม้ปิดจอ'}
          </p>
        </div>
      </div>

      {!installed && (
        <>
          {/* โบนัส 30 QI ครั้งเดียว/บัญชี — บอกชัดตามที่เจ้าของสั่ง */}
          <div className="flex items-center gap-2 rounded-[14px] bg-v3-lime/25 px-3 py-2" data-testid="account-install-reward">
            <span aria-hidden className="text-[18px]">🎁</span>
            <p className="text-[13px] font-bold leading-[18px] text-v3-navy">
              ติดตั้งครั้งแรกรับ <span className="text-v3-sapphire">+30 QI</span>
              <span className="block text-[11px] font-medium text-v3-text-muted">ครั้งเดียวต่อบัญชี · ลบแล้วติดตั้งใหม่ไม่ได้รับซ้ำ</span>
            </p>
          </div>
          <KitButton onClick={onInstall} testId="account-install-btn">
            {canInstall ? 'ติดตั้งเลย · รับ 30 QI' : 'ดูวิธีติดตั้ง · รับ 30 QI'}
          </KitButton>
        </>
      )}

      {guideOpen && <InstallGuideSheet variant="install" onClose={() => setGuideOpen(false)} />}
    </SectionCard>
  )
}
