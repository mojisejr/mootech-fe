import Image from 'next/image'
import { useRef } from 'react'
import { cn } from '@/lib/utils/cn'

// AvatarUpload — MuMate v2 profile avatar (DESIGN.md v3 §7, Figma 302-275).
// 110px circle placeholder + 32px sapphire camera badge (radius 16, 2px white border, icon 16).
// Presentational: `previewSrc` shows the chosen image; `onSelectFile` fires with the picked File.
// goo can wire this to the existing ModalImageCrop flow, or use the raw file directly.
function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 3.5 7.8 5.5H5A2 2 0 0 0 3 7.5v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2.8L15 3.5H9Z"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3.2" stroke="#fff" strokeWidth="1.6" />
    </svg>
  )
}

export function AvatarUpload({
  previewSrc,
  onSelectFile,
  className,
}: {
  previewSrc?: string | null
  onSelectFile?: (file: File) => void
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cn('relative h-[110px] w-[110px]', className)}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="อัปโหลดรูปโปรไฟล์"
        className="h-full w-full overflow-hidden rounded-full bg-v3-ghost-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v3-sapphire focus-visible:ring-offset-2"
      >
        {previewSrc ? (
          <Image
            src={previewSrc}
            alt="รูปโปรไฟล์"
            width={110}
            height={110}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-3xl text-v3-placeholder"
          >
            👤
          </span>
        )}
      </button>

      {/* camera badge */}
      <span
        aria-hidden="true"
        className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-2xl border-2 border-white bg-v3-sapphire"
      >
        <CameraIcon />
      </span>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && onSelectFile) onSelectFile(file)
        }}
      />
    </div>
  )
}

export default AvatarUpload
