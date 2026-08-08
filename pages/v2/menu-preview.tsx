// Preview of the shared CalendarMenu (verify the 4 states @393/360/320 + anchor target). Visibility
// owned by the v2 preview gate (V2_PREVIEW_KEY cookie), NOT NODE_ENV — same guard as the real /v2 pages
// so it opens on prod after the passkey instead of 404 (issue #220).
// ?menu=default|primary-cta|saved|form  ·  ?label=<cta text>  — real mounts = home (default) + the calendar flow (goo).
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { CalendarMenu, type CalendarMenuState } from '@/features/v2-home/components/CalendarMenu'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function MenuPreview() {
  const q = useRouter().query
  const state = ((q.menu as string) || 'default') as CalendarMenuState
  const label = (q.label as string) || undefined
  return (
    <div className="min-h-screen bg-v3-bg-cream">
      <p className="p-4 text-sm font-medium text-v3-text-body">menu-preview · state={state}</p>
      <CalendarMenu state={state} ctaLabel={label} onCta={() => undefined} />
    </div>
  )
}
