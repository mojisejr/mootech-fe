// features/v2-home/components/CalendarMenu.tsx — FORWARDER (PR2, ฟีม 2026-08-03).
//
// The implementation moved to features/v2-shell/components/Menubar.tsx: there is now ONE bottom menu for the
// whole app instead of two that had drifted apart (see that file's header for the why). This module stays so
// goo's contract keeps compiling untouched — `menu-state.ts` types against `CalendarMenuState`, and
// CalendarShell / V2HomeScreen / menu-preview import `CalendarMenu` — rather than rewriting a seam I don't own.
// New code should import Menubar from '@/features/v2-shell/components/Menubar'.
//
// Behaviour is identical, plus what home gains from the merge: the Figma tab ICONS it never had.
import { Menubar, type MenubarState } from '@/features/v2-shell/components/Menubar'

/** @deprecated use MenubarState from '@/features/v2-shell/components/Menubar' */
export type CalendarMenuState = MenubarState

/** @deprecated use <Menubar /> from '@/features/v2-shell/components/Menubar' */
export const CalendarMenu = Menubar

export default CalendarMenu
