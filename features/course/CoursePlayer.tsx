// features/course/CoursePlayer.tsx — เครื่องเล่นคลิปคอร์ส (YouTube Unlisted) ที่ "กันกดออกไป YouTube"
// เอ็ม 2026-10-21: กันการเปิดลิงก์ภายนอก เผื่อเอาไปส่งต่อ → ซ่อนแถบควบคุม YouTube (controls=0) แล้วคลุมทั้งกรอบด้วยชั้นของเรา
//   ผู้ชมแตะชื่อคลิป / ปุ่มแชร์ / โลโก้ "ดูบน YouTube" / คลิปแนะนำตอนจบ ไม่ได้ — ทุกการแตะตกที่ชั้นเรา (เล่น/หยุด)
//   ปุ่มเล่น-หยุด + แถบเลื่อนเวลา + เต็มจอ เป็นของเราเอง คุม player ผ่าน postMessage (enablejsapi) ไม่ต้องโหลดสคริปต์ภายนอก
// ⚠️ กันได้ระดับ "กดออกไม่ได้" — คนที่เปิดดูซอร์สหน้าเว็บยังเห็นรหัสคลิปได้ (ข้อจำกัดของ YouTube embed ทุกแบบ)
import { useCallback, useEffect, useRef, useState } from "react"

type Props = { videoId: string; title: string; autoplay?: boolean }

const fmt = (s: number) => {
  const t = Math.max(0, Math.floor(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
}

export function CoursePlayer({ videoId, title, autoplay = false }: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(autoplay)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [ended, setEnded] = useState(false)

  const send = useCallback((func: string, args: unknown[] = []) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*")
  }, [])

  // รับสถานะจาก player (เวลา/ความยาว/เล่น-หยุด) — ต้องส่ง "listening" ก่อน player ถึงจะส่ง infoDelivery มา
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (typeof e.origin !== "string" || !/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return
      let d: { event?: string; info?: { currentTime?: number; duration?: number; playerState?: number } } | null = null
      try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data } catch { return }
      const info = d?.info
      if (!info) return
      if (typeof info.currentTime === "number") setTime(info.currentTime)
      if (typeof info.duration === "number" && info.duration > 0) setDuration(info.duration)
      if (typeof info.playerState === "number") {
        setPlaying(info.playerState === 1 || info.playerState === 3)
        setEnded(info.playerState === 0)
      }
    }
    window.addEventListener("message", onMsg)
    return () => window.removeEventListener("message", onMsg)
  }, [])
  const onLoad = () => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: videoId, channel: "widget" }), "*")
  }

  const toggle = () => {
    if (ended) { send("seekTo", [0, true]); send("playVideo"); setEnded(false); setPlaying(true); return }
    if (playing) { send("pauseVideo"); setPlaying(false) } else { send("playVideo"); setPlaying(true) }
  }
  const seek = (v: number) => { setTime(v); send("seekTo", [v, true]) }
  const fullscreen = () => {
    const el = box.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.()
  }

  const params = new URLSearchParams({
    rel: "0", modestbranding: "1", controls: "0", disablekb: "1", fs: "0", iv_load_policy: "3",
    playsinline: "1", enablejsapi: "1", autoplay: autoplay ? "1" : "0",
    ...(typeof window !== "undefined" ? { origin: window.location.origin } : {}),
  })

  return (
    <div ref={box} className="absolute inset-0 bg-black" data-testid="course-player-box" onContextMenu={(e) => e.preventDefault()}>
      <iframe
        ref={frame}
        data-testid="course-player"
        className="pointer-events-none absolute inset-0 size-full"
        src={`https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`}
        title={title}
        onLoad={onLoad}
        allow="autoplay; encrypted-media; picture-in-picture"
        tabIndex={-1}
      />
      {/* ชั้นคลุมทั้งกรอบ — แตะ = เล่น/หยุด · กันแตะชื่อคลิป/แชร์/โลโก้ YouTube/คลิปแนะนำ */}
      <button type="button" onClick={toggle} aria-label={playing ? "หยุดชั่วคราว" : "เล่น"} data-testid="course-player-shield" className="absolute inset-0 grid place-items-center">
        {!playing && (
          <span className="grid size-16 place-items-center rounded-full bg-white/90 pl-1 text-2xl text-v3-sapphire shadow-lg">{ended ? "↻" : "▶"}</span>
        )}
      </button>
      {/* แถบควบคุมของเรา */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-white">
        <button type="button" onClick={toggle} aria-label={playing ? "หยุด" : "เล่น"} data-testid="course-player-toggle" className="w-6 text-base">{playing ? "❚❚" : "▶"}</button>
        <input
          type="range" min={0} max={duration || 0} step={1} value={Math.min(time, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="เลื่อนเวลา" data-testid="course-player-seek"
          className="h-1 flex-1 accent-v3-lime"
        />
        <span className="w-[74px] text-right text-[11px] tabular-nums">{fmt(time)} / {fmt(duration)}</span>
        <button type="button" onClick={fullscreen} aria-label="เต็มจอ" data-testid="course-player-fullscreen" className="text-base">⛶</button>
      </div>
    </div>
  )
}
