// features/v2-settings/components/DocReaderScreen.tsx — /v2/help/doc/[slug]
// เฟรม `document-reader — template`: อ่านเอกสารฉบับเต็มหน้าเดียว (หัวเรื่อง + เนื้อหา + ย้อนกลับ)
// ใช้ซ้ำกับบทความช่วยเหลือทุกบท (ข้อมูลจาก engine เดียวกับ FAQ)
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { AppHeader } from '@/features/v2-shell/components/AppHeader'
import { useV2Tier } from '@/features/auth/hooks/useV2Tier'

const CARD = 'flex w-full flex-col rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'

export function DocReaderScreen({ slug }: { slug: string }) {
  const tier = useV2Tier(false)
  const [title, setTitle] = useState<string | null>(null)
  const [body, setBody] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'failed'>('loading')

  const load = useCallback(async () => {
    if (!slug) {
      setState('notfound')
      return
    }
    setState('loading')
    try {
      const res = await fetch(`/api/faq?slug=${encodeURIComponent(slug)}`)
      if (res.status === 404) {
        setState('notfound')
        return
      }
      if (!res.ok) {
        setState('failed')
        return
      }
      const j = (await res.json()) as { title?: string; body?: string }
      setTitle(j.title ?? null)
      setBody(j.body ?? null)
      setState('ok')
    } catch {
      setState('failed')
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head><title>{title ?? 'เอกสาร'} · MuMate</title></Head>
      <AppHeader testId="doc-header" title="เอกสาร" backHref="/v2/help/faq" membership={tier} upgradeCta={false} className="items-center py-4" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        {state === 'loading' && <div aria-hidden className="h-[180px] w-full animate-pulse rounded-[20px] bg-white" data-testid="doc-loading" />}

        {state === 'failed' && (
          <section className={CARD} data-testid="doc-error">
            <p className="text-sm font-bold text-v3-navy">โหลดเอกสารไม่สำเร็จ</p>
            <button onClick={() => void load()} className="mt-2 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              ลองใหม่
            </button>
          </section>
        )}

        {state === 'notfound' && (
          <section className={CARD} data-testid="doc-notfound">
            <p className="text-[13px] leading-5 text-v3-text-body">ไม่พบเอกสารนี้</p>
            <Link href="/v2/help/faq" data-testid="doc-back-faq" className="mt-2 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              กลับหน้าช่วยเหลือ
            </Link>
          </section>
        )}

        {state === 'ok' && (
          <article className={CARD} data-testid="doc-article">
            <h1 className="text-lg font-black leading-6 text-v3-navy" data-testid="doc-title">{title}</h1>
            <p className="whitespace-pre-line text-[14px] leading-[24px] text-v3-text-body" data-testid="doc-body">{body}</p>
          </article>
        )}
      </div>
    </div>
  )
}

export default DocReaderScreen
