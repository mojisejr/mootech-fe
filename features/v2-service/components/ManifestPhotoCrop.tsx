// ครอปรูปความปรารถนา (เอ็ม 2026-10-04: ผู้ใช้เลือกเองว่าจะโชว์ส่วนไหน + แก้รูปที่อัปแล้วได้)
//   ลาก = เลื่อนตำแหน่ง, slider/บีบนิ้ว = ซูม, ปุ่มหมุน 90° → ได้ jpeg สัดส่วน 3:2 (ตรงกรอบหน้าอ่าน 220px)
import { useCallback, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"

export const MANIFEST_PHOTO_ASPECT = 3 / 2

// ตัดตามพื้นที่ที่เลือก (รองรับหมุน) → dataURL jpeg ขนาดไม่เกิน maxW
async function cropToJpeg(src: string, area: Area, rotation: number, maxW = 1080, quality = 0.85): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new window.Image()
    i.crossOrigin = "anonymous" // รูปเดิมจาก storage (แก้รูปที่อัปแล้ว) — ต้อง CORS ไม่งั้น canvas อ่านไม่ได้
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"))
    i.src = src
  })
  const rad = (rotation * Math.PI) / 180
  const bw = Math.abs(Math.cos(rad) * img.width) + Math.abs(Math.sin(rad) * img.height)
  const bh = Math.abs(Math.sin(rad) * img.width) + Math.abs(Math.cos(rad) * img.height)
  // วาดภาพหมุนลง canvas ใหญ่ แล้วคัดส่วนที่ครอปลง canvas ผลลัพธ์ (ย่อในขั้นเดียว)
  const full = document.createElement("canvas")
  full.width = bw
  full.height = bh
  const fctx = full.getContext("2d")
  if (!fctx) throw new Error("no canvas")
  fctx.translate(bw / 2, bh / 2)
  fctx.rotate(rad)
  fctx.drawImage(img, -img.width / 2, -img.height / 2)
  const scale = Math.min(1, maxW / area.width)
  const out = document.createElement("canvas")
  out.width = Math.round(area.width * scale)
  out.height = Math.round(area.height * scale)
  const octx = out.getContext("2d")
  if (!octx) throw new Error("no canvas")
  octx.drawImage(full, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height)
  return out.toDataURL("image/jpeg", quality)
}

export function ManifestPhotoCrop({ src, onCancel, onDone }: { src: string; onCancel: () => void; onDone: (dataUrl: string) => void | Promise<void> }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const onComplete = useCallback((_: Area, px: Area) => setArea(px), [])

  const save = async () => {
    if (!area) return
    setBusy(true); setErr(null)
    try {
      await onDone(await cropToJpeg(src, area, rotation))
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ครอปรูปไม่สำเร็จ")
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" data-testid="manifest-crop">
      <div className="w-full max-w-md rounded-t-[24px] bg-white p-5 sm:rounded-[24px]">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-black text-v3-navy">ปรับรูป</h2>
          <button type="button" onClick={onCancel} disabled={busy} className="text-[16px] font-bold text-v3-text-muted">✕</button>
        </div>
        <p className="mt-1 text-[12px] text-v3-text-muted">ลากเพื่อเลือกส่วนที่จะโชว์ · ซูมด้วยแถบด้านล่างหรือบีบนิ้ว</p>
        <div className="relative mt-3 h-[300px] w-full overflow-hidden rounded-[16px] bg-black">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={MANIFEST_PHOTO_ASPECT}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onComplete}
            objectFit="contain"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-[12px] font-bold text-v3-navy">ซูม</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[#1B9AAF]" aria-label="ซูม" data-testid="manifest-crop-zoom" />
          <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)} className="rounded-full border border-v3-border-input px-3 py-1 text-[12px] font-bold text-v3-navy" data-testid="manifest-crop-rotate">⟳ หมุน</button>
        </div>
        {err ? <p className="mt-2 text-center text-[12px] font-bold text-v3-error">{err}</p> : null}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="flex-1 rounded-full border border-v3-navy py-3 text-[14px] font-bold text-v3-navy">ยกเลิก</button>
          <button type="button" onClick={() => void save()} disabled={busy || !area} className="flex-1 rounded-full bg-v3-navy py-3 text-[14px] font-bold text-white disabled:opacity-60" data-testid="manifest-crop-save">{busy ? "กำลังบันทึก…" : "ใช้รูปนี้"}</button>
        </div>
      </div>
    </div>
  )
}
