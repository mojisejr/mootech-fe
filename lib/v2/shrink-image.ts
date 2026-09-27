// lib/v2/shrink-image.ts — make a picked photo small enough to upload (CIEL mumate-be-retirement-001 slice 1f).
//
// WHY: the friend-photo upload moved from mootech-be (50 MB limit, on Render) to an FE route. On Vercel a
// function refuses any request body over 4.5 MB before our code runs, and the route itself caps the file at
// 4 MB (lib/storage/friend-photo.ts). A phone camera photo is often 3-8 MB, so sending the original would turn
// an ordinary pick into "อัปโหลดไม่สำเร็จ". The photo is shown at 40 px; 1024 px on the long edge is plenty.
//
// Browser only. Every failure path returns the ORIGINAL file untouched — this is an optimisation, never a gate:
// if the browser cannot decode the image (an old webview without createImageBitmap, a format it cannot read),
// the server's own checks decide, exactly as they would without this step.
export const SHRINK_MAX_EDGE = 1024
export const SHRINK_QUALITY = 0.85

export async function shrinkImageForUpload(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, SHRINK_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', SHRINK_QUALITY))
    // Keep the original when re-encoding did not help (a small PNG can grow as a JPEG).
    if (!blob || blob.size >= file.size) return file
    return new File([blob], 'friend.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}
