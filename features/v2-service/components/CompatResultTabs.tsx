// features/v2-service/components/CompatResultTabs.tsx — ดวงสมพงศ์ Zone 1 · pill tabs (Figma 636:19319).
// ONE pill container (#ECF0FC) holding equal-width tabs; the active tab is a sapphire pill with LIME text,
// inactive tabs are transparent with sapphire text. Colours sampled from the node, not guessed.
//
// WIDTH (ฟีม 2026-08-03): tabs are flex-1 with a min-width, so at @393 the 4 tabs fill the container exactly
// (4 × 86.25 = 345 = inner width, Figma-exact). On a narrower screen they refuse to shrink and the row SCROLLS
// horizontally instead of squashing — with the scrollbar hidden (.no-scrollbar), ฟีม's call. Measured: the
// widest label "ธาตุ & เสา" is 71px @16px bold, which does not fit the 68px/tab a 320-wide screen would give.
//
// TAB COUNT: Figma draws 4, but the WIRING passes only the tabs whose section has data (ฟีม's earlier rule
// "มีก็เอามา ไม่มีก็ไม่ได้เอามา") — flex-1 simply divides the row among however many arrive. Renders null for < 2.
export type CompatTab = { key: string; label: string }

export function CompatResultTabs({ tabs, active, onSelect }: { tabs: CompatTab[]; active: string; onSelect: (key: string) => void }) {
  if (!tabs || tabs.length < 2) return null // a single (or no) tab isn't a tab bar
  return (
    <nav
      data-testid="compat-result-tabs"
      aria-label="ส่วนของผลดวงสมพงศ์"
      className="no-scrollbar flex items-center overflow-x-auto rounded-full bg-[#ECF0FC] p-2"
    >
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
              'h-10 min-w-[86.25px] flex-1 whitespace-nowrap rounded-full px-2 text-[16px] font-bold transition-colors',
              isActive ? 'bg-v3-sapphire text-v3-lime' : 'bg-transparent text-v3-sapphire',
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
