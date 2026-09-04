// MuMate v2 — จอ "Mate AI" (/v2/chat). Behind the v2 gate. Glue only.
//
// Design: Figma "Mumate app_ final" page "- Mumate AI", frame mumate-ai-chat (node 55271-8612).
// No Menubar on purpose — the composer docks to the bottom edge (same reasoning as /v2/shop).
import type { GetServerSideProps } from 'next'
import { v2RedirectIfUnauthed } from '@/lib/v2/gate'
import { ChatScreen } from '@/features/v2-chat/components/ChatScreen'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  ctx.res.setHeader('Cache-Control', 'no-store, must-revalidate')
  const redirect = v2RedirectIfUnauthed(ctx.req)
  if (redirect) return redirect
  return { props: {} }
}

export default function V2ChatPage() {
  return <ChatScreen />
}
