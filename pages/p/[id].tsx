// /p/[id] — หน้าแชร์สาธารณะของสถานที่ศักดิ์สิทธิ์ (ไม่ต้องล็อกอิน)
// สิ่งที่เพื่อนเห็นเมื่อกดลิงก์จาก LINE/FB — มี OG meta ให้ crawler สร้าง rich preview
// ดึงข้อมูลฝั่ง server จาก engine โดยตรง (verified เท่านั้น) → 404 ถ้าไม่พบ
import type { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"

type PublicLocation = {
  id: string
  slug: string | null
  name: string
  deity: string | null
  description: string | null
  province: string | null
  address: string | null
  lat: number
  lng: number
  direction: string | null
  element: string | null
  needs: string[]
  worshipGuide: string | null
  hasImage?: boolean
  googleMapUrl: string | null
}

type Props = {
  loc: PublicLocation
  origin: string
  show: { route: boolean; guide: boolean; direction: boolean }
}

const EL_TH: Record<string, string> = { wood: "ไม้", fire: "ไฟ", earth: "ดิน", metal: "ทอง", water: "น้ำ" }

function isValidCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 5.5 && lat <= 21 && lng >= 97 && lng <= 106
}
function mapsLink(loc: PublicLocation): string {
  if (loc.googleMapUrl && loc.googleMapUrl.trim()) return loc.googleMapUrl.trim()
  const q = isValidCoord(loc.lat, loc.lng) ? `${loc.name} ${loc.lat},${loc.lng}` : [loc.name, loc.province].filter(Boolean).join(" ")
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const id = String(ctx.params?.id ?? "").trim()
  const base = process.env.BAZI_BASE_URL || "http://localhost:3000"
  const q = ctx.query
  // แฟล็กจาก share sheet: r=แนบเส้นทาง, g=แนบโพยการมู, d=แนบทิศ (ค่าเริ่ม: route+guide เปิด, ทิศปิด)
  const flag = (k: string, def: boolean) => (q[k] === undefined ? def : q[k] === "1" || q[k] === "true")
  try {
    const r = await fetch(`${base}/api/sacred-map/${encodeURIComponent(id)}`)
    if (!r.ok) return { notFound: true }
    const j = (await r.json()) as { ok?: boolean; location?: PublicLocation }
    if (!j.ok || !j.location) return { notFound: true }
    const proto = (ctx.req.headers["x-forwarded-proto"] as string)?.split(",")[0] || "https"
    const host = ctx.req.headers.host ?? ""
    ctx.res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600")
    return {
      props: {
        loc: j.location,
        origin: `${proto}://${host}`,
        show: { route: flag("r", true), guide: flag("g", true), direction: flag("d", false) },
      },
    }
  } catch {
    return { notFound: true }
  }
}

export default function SacredPlacePublicPage({ loc, origin, show }: Props) {
  const needsText = loc.needs?.length ? loc.needs.join(" ") : "เสริมดวง"
  const title = `${loc.name} · MuMate`
  const desc = `คุณพี่มูชวนคุณไปขอพรเรื่อง${needsText}${show.route ? " · มีเส้นทาง" : ""}${show.guide ? "และโพยการมูพร้อม" : ""}`
  const ogImage = loc.hasImage ? `${origin}/api/v2/sacred-map/image/${encodeURIComponent(loc.id)}` : `${origin}/images/v2/mascot/01-nav.png`
  const pageUrl = `${origin}/p/${encodeURIComponent(loc.slug || loc.id)}`

  return (
    <div className="min-h-[100dvh] w-full bg-v3-bg-cream font-ibm">
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={loc.name} />
        <meta property="og:description" content={desc} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:site_name" content="MuMate" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={loc.name} />
        <meta name="twitter:description" content={desc} />
        <meta name="twitter:image" content={ogImage} />
      </Head>

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-16 pt-4">
        <div className="flex items-center gap-2 pb-1">
          <img src="/images/v2/mascot/01-nav.png" alt="MuMate" className="h-8 w-8 rounded-full object-cover" />
          <span className="text-[16px] font-black text-v3-navy">MuMate</span>
        </div>

        <div className="overflow-hidden rounded-[24px] bg-white v3-shadow-card">
          {loc.hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/v2/sacred-map/image/${encodeURIComponent(loc.id)}`} alt={loc.name} className="aspect-[16/10] w-full object-cover" />
          ) : (
            <div className="grid aspect-[16/10] w-full place-items-center bg-v3-ghost-white text-[44px]">🙏</div>
          )}
          <div className="flex flex-col gap-2 p-5">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-[20px] font-black leading-6 text-v3-navy">{loc.name}</h1>
              {loc.element && EL_TH[loc.element] ? <span className="mt-0.5 flex-none rounded-full bg-v3-lime px-2 py-[2px] text-[11px] font-bold text-v3-navy">{EL_TH[loc.element]}</span> : null}
            </div>
            {loc.deity ? <p className="text-[13px] text-v3-text-body">{loc.deity}</p> : null}
            {loc.description ? <p className="text-[13px] leading-5 text-v3-text-body">{loc.description}</p> : null}
            {loc.needs?.length ? (
              <div className="flex flex-wrap gap-1">
                {loc.needs.map((n) => <span key={n} className="rounded-full bg-[#FBEAF0] px-2 py-[1px] text-[11px] font-bold text-[#B14A6C]">{n}</span>)}
              </div>
            ) : null}
            {loc.province ? <p className="text-[11px] text-v3-text-muted">{[loc.province, loc.address].filter(Boolean).join(" · ")}</p> : null}
          </div>
        </div>

        {show.route ? (
          <a href={mapsLink(loc)} target="_blank" rel="noopener noreferrer" className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold text-white v3-shadow-card">
            เปิดเส้นทางใน Google Maps
          </a>
        ) : null}

        {show.guide && (loc.worshipGuide || (show.direction && loc.direction)) ? (
          <section className="rounded-[20px] bg-white p-4 v3-shadow-card">
            <h2 className="text-[15px] font-black text-v3-navy">โพยการมู</h2>
            <div className="my-3 border-t border-dashed border-v3-border-card" />
            <div className="flex flex-col gap-2">
              {loc.worshipGuide ? (
                <div className="rounded-[12px] bg-[#EDF7EE] p-3">
                  <p className="text-[13px] font-black text-[#2F7A46]">ของไหว้</p>
                  <p className="mt-0.5 whitespace-pre-line text-[13px] leading-5 text-v3-text-body">{loc.worshipGuide}</p>
                </div>
              ) : null}
              {show.direction && loc.direction ? (
                <div className="rounded-[12px] bg-[#EDF7EE] p-3">
                  <p className="text-[13px] font-black text-[#2F7A46]">ทิศมงคล</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-v3-text-body">หันหน้าไปทาง{loc.direction}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="mt-1 rounded-[20px] bg-white p-5 text-center v3-shadow-card">
          <p className="text-[14px] font-black text-v3-navy">อยากรู้ดวงและสถานที่มงคลของคุณเอง?</p>
          <p className="mt-1 text-[12px] leading-5 text-v3-text-muted">MuMate ช่วยหาสถานที่ศักดิ์สิทธิ์ที่เหมาะกับธาตุคุณ พร้อมเส้นทางและโพยการมู</p>
          <Link href="/v2/service/sacred-map" className="mt-3 grid h-11 w-full place-items-center rounded-full bg-v3-lime text-[14px] font-bold text-v3-navy">
            เปิดใน MuMate
          </Link>
        </div>
      </div>
    </div>
  )
}
