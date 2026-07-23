// DEV-ONLY preview of V2HomeScreen with mock props (verify @393 + BG-continuity anchor target).
// The REAL mount is goo's /v2 index authed-branch (useV2Home/useV2Logout wired). notFound in prod.
import type { GetServerSideProps } from 'next'
import { V2HomeScreen } from '@/features/v2-home/components/V2HomeScreen'

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV === 'production') return { notFound: true }
  return { props: {} }
}

export default function V2HomePreview() {
  return <V2HomeScreen greeting={{ name: 'มิลา' }} mascotCharacter="/images/v2/mascot/01.png" onLogout={() => window.alert('logout()')} />
}
