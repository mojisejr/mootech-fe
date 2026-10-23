// features/v2-privacy/PolicyText.tsx — นโยบายความเป็นส่วนตัวฉบับเต็มเป็นเนื้อความธรรมดา สำหรับหน้าจอในแอป
// (หน้าสมัครและหน้าฉบับปรับปรุง, CIEL mumate-pdpa-reconsent-001 plan 0.3). เนื้อหามาจาก constants/privacy-policy.ts
// ที่เดียวกับ /privacy/policy — ที่นี่แค่จัดรูปให้เข้ากับหน้าจอ v3. ไม่มีกรอบหรือไฮไลต์ข้อไหนเป็นพิเศษ (owner 2026-10-23).
import { PRIVACY_POLICY, thaiLongDate, type PolicySection } from '@/constants/privacy-policy'

export function PolicyText() {
  return (
    <article className="flex flex-col gap-5 font-ibm text-sm leading-[22px] text-v3-text-body" data-testid="policy-text">
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-bold leading-6 text-v3-text-title">{PRIVACY_POLICY.title}</h2>
        <p>{PRIVACY_POLICY.intro}</p>
      </div>
      {PRIVACY_POLICY.sections.map((sec: PolicySection) => (
        <section key={sec.id} className="flex flex-col gap-2">
          <h3 className="text-base font-bold leading-6 text-v3-text-title">{sec.title}</h3>
          {sec.intro ? <p>{sec.intro}</p> : null}
          {sec.items ? (
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              {sec.items.map((it) => (
                <li key={it.text}>
                  {it.lead ? <strong className="font-semibold text-v3-text-title">{it.lead} </strong> : null}
                  {it.text}
                </li>
              ))}
            </ul>
          ) : null}
          {sec.outro ? <p>{sec.outro}</p> : null}
        </section>
      ))}
      <p className="italic text-v3-text-muted">
        ฉบับ {PRIVACY_POLICY.version} · มีผลตั้งแต่ {thaiLongDate(PRIVACY_POLICY.effectiveDate)}
      </p>
    </article>
  )
}

export default PolicyText
