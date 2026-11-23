// ปีชง 2570 (revision 0.13): what /v2 shows while it sends a member back to /taisui-2570 after LINE login.
// The page's own night colours, so login → this → the page reads as one dark sequence, not a white flash.
import Link from 'next/link'
import { useEffect, useState } from 'react'

const WRAP: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: 18, background: '#071a36', color: '#fff7e6', fontFamily: "'IBM Plex Sans Thai', system-ui, sans-serif",
}
const FACE: React.CSSProperties = { width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', background: '#fff7e6', boxShadow: '0 0 0 4px #ebbf30, 0 0 40px rgba(235,191,48,.5)' }
const SPIN: React.CSSProperties = { width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(201,214,242,.25)', borderTopColor: '#e1ff00' }

export function ReturnLoading() {
  const [slow, setSlow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(t) }, [])
  return (
    <div style={WRAP} role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div style={FACE}><img src="/images/v2/mascot/personas/mu/happy.png" alt="" width={96} height={96} style={{ objectFit: 'cover', objectPosition: '50% 18%' }} /></div>
      <div style={SPIN} className="animate-spin motion-reduce:animate-none" />
      <p style={{ margin: 0, fontSize: 16 }}>กำลังพากลับไปหน้าปีชง…</p>
      {slow && <Link href="/taisui-2570" style={{ color: '#c9d6f2', fontSize: 14, textDecoration: 'underline', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>ไปหน้าปีชงเลย</Link>}
    </div>
  )
}
