// features/v2-settings/components/FaqScreen.tsx — /v2/help/faq (เฟรม help-faq)
// accordion จาก GET /api/faq (engine bazi_help_article) + ทางเข้าอ่านฉบับเต็มต่อบทความ
// (document-reader template อยู่ /v2/help/doc/[slug])
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { SkyBackdrop, SkyHeader } from '@/features/v2-profile/components/kit'

const CARD = 'flex w-full flex-col rounded-[24px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'

type Article = { slug: string; title: string; body: string }

export function FaqScreen() {
  const [articles, setArticles] = useState<Article[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [q, setQ] = useState('')

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
      <SkyHeader title="คำถามที่พบบ่อย" backHref="/v2/settings" testId="faq" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pb-36 pt-2">
        {/* ช่องค้นหา (client-side กรองจากบทความที่โหลดมา) */}
        {!loading && !failed && articles && articles.length > 0 && (
          <div className="relative">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-v3-text-muted"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาคำถาม"
              data-testid="faq-search"
              className="h-12 w-full rounded-full border border-v3-border-input bg-white pl-11 pr-4 text-[14px] outline-none focus:border-v3-navy placeholder:text-v3-placeholder"
            />
          </div>
        )}

        {loading && <div aria-hidden className="h-[120px] w-full animate-pulse rounded-[24px] bg-white" data-testid="faq-loading" />}

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

        {articles && articles.length > 0 && (() => {
          const kw = q.trim().toLowerCase()
          const shown = kw ? articles.filter((a) => a.title.toLowerCase().includes(kw) || a.body.toLowerCase().includes(kw)) : articles
          if (shown.length === 0) {
            return <section className={CARD} data-testid="faq-no-match"><p className="text-[13px] leading-5 text-v3-text-body">ไม่พบคำถามที่ตรงกับ “{q.trim()}” — ลองคำอื่น หรือทักทีมงานด้านล่าง</p></section>
          }
          return (
          <ul className="flex flex-col gap-3" data-testid="faq-list">
            {shown.map((a) => {
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
          )
        })()}

        {/* ติดต่อทีม (เฟรม: ไม่เจอคำตอบ) */}
        {!loading && !failed && (
          <section className="mt-1 flex items-center gap-3 rounded-[24px] bg-[#ECF0FD] p-4" data-testid="faq-contact">
            <span aria-hidden className="grid size-10 flex-none place-items-center rounded-full bg-white text-v3-sapphire">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-v3-navy">ไม่เจอคำตอบที่ต้องการ?</p>
              <p className="text-[12px] leading-4 text-v3-text-body">ทักเราได้ที่ LINE @mumate.co</p>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export default FaqScreen
