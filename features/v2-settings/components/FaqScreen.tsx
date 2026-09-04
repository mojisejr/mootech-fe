// features/v2-settings/components/FaqScreen.tsx — /v2/help/faq (เฟรม help-faq)
// accordion จาก GET /api/faq (engine bazi_help_article) + ทางเข้าอ่านฉบับเต็มต่อบทความ
// (document-reader template อยู่ /v2/help/doc/[slug])
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { SkyBackdrop, SkyHeader } from '@/features/v2-profile/components/kit'

const CARD = 'flex w-full flex-col rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'

type Article = { slug: string; title: string; body: string }

export function FaqScreen() {
  const [articles, setArticles] = useState<Article[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetch('/api/faq')
      if (!res.ok) {
        setFailed(true)
        return
      }
      const j = (await res.json()) as { articles?: Article[] }
      setArticles(j.articles ?? [])
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>ช่วยเหลือ · MuMate</title></Head>
      <SkyHeader title="ช่วยเหลือ" backHref="/v2/settings" testId="faq" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-36 pt-2">
        {loading && <div aria-hidden className="h-[120px] w-full animate-pulse rounded-[20px] bg-white" data-testid="faq-loading" />}

        {failed && (
          <section className={CARD} data-testid="faq-error">
            <p className="text-sm font-bold text-v3-navy">โหลดคำถามที่พบบ่อยไม่สำเร็จ</p>
            <button onClick={() => void load()} className="mt-2 grid h-11 w-full place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              ลองใหม่
            </button>
          </section>
        )}

        {!loading && !failed && articles && articles.length === 0 && (
          <section className={CARD} data-testid="faq-empty">
            <p className="text-[13px] leading-5 text-v3-text-body">ยังไม่มีบทความช่วยเหลือ — ถ้ามีข้อสงสัยติดต่อทีมงานได้ทางหน้าโซเชียลของเรา</p>
          </section>
        )}

        {articles && articles.length > 0 && (
          <ul className="flex flex-col gap-3" data-testid="faq-list">
            {articles.map((a) => {
              const isOpen = open === a.slug
              return (
                <li key={a.slug} className={CARD}>
                  <button
                    onClick={() => setOpen(isOpen ? null : a.slug)}
                    data-testid={`faq-item-${a.slug}`}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="text-[14px] font-bold text-v3-navy">{a.title}</span>
                    <svg
                      width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden
                      className={'flex-none text-v3-text-muted transition-transform ' + (isOpen ? 'rotate-90' : '')}
                    >
                      <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {isOpen && (
                    <>
                      <p className="whitespace-pre-line text-[13px] leading-5 text-v3-text-body" data-testid={`faq-body-${a.slug}`}>
                        {a.body}
                      </p>
                      <Link href={`/v2/help/doc/${a.slug}`} data-testid={`faq-read-${a.slug}`} className="text-[12px] font-bold text-v3-cyan">
                        อ่านแบบเต็มหน้า →
                      </Link>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default FaqScreen
