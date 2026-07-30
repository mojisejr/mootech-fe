// features/v2-service/components/CompatResultTabs.tsx — ดวงสมพงศ์ 2E-2 · D47 pill tabs.
// Figma 636:18819 shows 4 tabs: ภาพรวม · รายมิติ · ธาตุ & เสา · รายคน. Per ฟีม ("มีก็เอามา ไม่มีก็ไม่ได้เอามา")
// the WIRING passes only the tabs whose section actually has data — this component just renders the given
// list as a scroll-to-section pill bar. Pure + controlled: active key + onSelect(key). Renders null for < 2 tabs.
export type CompatTab = { key: string; label: string }

export function CompatResultTabs({ tabs, active, onSelect }: { tabs: CompatTab[]; active: string; onSelect: (key: string) => void }) {
  if (!tabs || tabs.length < 2) return null // a single (or no) tab isn't a tab bar
  return (
    <nav data-testid="compat-result-tabs" className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="ส่วนของผลดวงสมพงศ์">
      {tabs.map((t) => {
        const isActive = t.key === active
        return (
          <button
            key={t.key}
            type="button"
            data-testid={`compat-tab-${t.key}`}
            data-active={isActive ? 'true' : undefined}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onSelect(t.key)}
            className={[
              'shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors',
              isActive ? 'bg-v3-sapphire text-white' : 'bg-white text-v3-navy',
            ].join(' ')}
          >
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}

export default CompatResultTabs
