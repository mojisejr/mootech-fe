import type { ReactNode } from 'react'
import { AppShell } from './AppShell'

// AppScreen — MuMate v2 container-contract (DESIGN.md §layout), the counterpart to FullBleedScreen.
// A screen that lives INSIDE the app: centered max-width column + bottom Menubar (via AppShell).
// Home / service / calendar / shop live here. Thin, deliberate wrapper around AppShell so the
// container choice is a NAMED contract at the page level, not an ad-hoc import —
// a page reads `<AppScreen>` or `<FullBleedScreen>` and its viewport behaviour is unambiguous.
export function AppScreen({ title, children }: { title?: string; children: ReactNode }) {
  return <AppShell title={title}>{children}</AppShell>
}

export default AppScreen
