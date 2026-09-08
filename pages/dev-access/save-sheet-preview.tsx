// DEV-ONLY — SaveSheet (บันทึกลงปฏิทิน เพื่อแจ้งเตือน) with the new เพิ่มปฏิทินภายนอก section, no login.
// Drives a hand-rolled draft so the note/yam/external toggles are all interactive.
import { useState } from 'react'
import { SaveSheet } from '@/features/v2-calendar/components/day-detail/SaveSheet'
import type { UseReminderDraft } from '@/features/v2-calendar/hooks/useReminderDraft'
import type { ReminderDestination, YamSlot } from '@/features/v2-calendar/types'

const YAMS: YamSlot[] = [
  { id: 'y1', label: 'ยามมงคล มีลาภผล ทรัพย์สิน', window: '03:00-06:59' } as YamSlot,
  { id: 'y2', label: 'ยามดี เหมาะเริ่มงานใหม่', window: '07:00-08:59' } as YamSlot,
  { id: 'y3', label: 'ยามเสริมความสัมพันธ์', window: '19:00-20:59' } as YamSlot,
  { id: 'y4', label: 'ยามพักผ่อน วางแผนอนาคต', window: '21:00-22:59' } as YamSlot,
]

export default function SaveSheetPreviewPage() {
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<string[]>(['y1'])
  const [external, setExternal] = useState<Record<ReminderDestination, boolean>>({ mumate: true, google: true, apple: false })

  const draft = {
    state: 'editing',
    draft: { date: '2026-07-14', selectedYamIds: selected, destinations: [], note },
    canCommit: selected.length > 0,
    menuState: 4,
    open: () => {},
    toggleYam: (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
    toggleDest: () => {},
    setNote,
    commit: async () => {},
    cancel: () => {},
    dismiss: () => {},
  } as unknown as UseReminderDraft

  return (
    <SaveSheet
      date="2026-07-14"
      yams={YAMS}
      draft={draft}
      onSave={() => alert('save (mock)')}
      notify="granted"
      onShowGuide={() => {}}
      statusFor={() => 'addable'}
      external={external}
      onToggleExternal={(d) => setExternal((s) => ({ ...s, [d]: !s[d] }))}
    />
  )
}
