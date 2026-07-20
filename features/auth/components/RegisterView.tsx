import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AvatarUpload } from './AvatarUpload'
import { SafetyBlock } from './SafetyBlock'

// RegisterView — MuMate v2 /v2/register presentational shell (DESIGN.md v3, Figma "04-profile-setup"
// 302-275). Route-swap: Figma "profile-setup" = code /register. I own the styled shell (header +
// avatar + safety block + submit); goo drops the EXISTING form (BirthDayInput / name / time /
// checkbox — reused, not rewritten) into `children`, and wires onSubmit(profile-save)/submitting/
// canSubmit. bg = ghost-white (app screen, not photo).
//
// The avatar is exposed via props so goo can bind it to the existing ModalImageCrop flow;
// omit them to use the built-in file picker.
export function RegisterView({
  children,
  onSubmit,
  submitting = false,
  canSubmit = true,
  avatarPreviewSrc,
  onSelectAvatar,
}: {
  /** The existing birth-data form fields (BirthDayInput etc.), slotted below the avatar. */
  children: ReactNode
  onSubmit: () => void
  submitting?: boolean
  canSubmit?: boolean
  avatarPreviewSrc?: string | null
  onSelectAvatar?: (file: File) => void
}) {
  return (
    <div className="flex min-h-screen flex-col bg-v3-ghost-white">
      <form
        className="mx-auto flex w-full max-w-md flex-1 flex-col px-8 pb-8 pt-8"
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit && !submitting) onSubmit()
        }}
      >
        {/* header */}
        <h1 className="text-center font-ibm text-2xl font-bold leading-8 text-v3-text-title">
          เริ่มต้นดูดวงเพียงเเค่ใส่
          <br />
          วันเดือน ปี เกิด
        </h1>

        {/* avatar */}
        <div className="mt-6 flex justify-center">
          <AvatarUpload previewSrc={avatarPreviewSrc} onSelectFile={onSelectAvatar} />
        </div>

        {/* existing form (goo reuses BirthDayInput etc.) */}
        <div className="mt-8 flex flex-col gap-5">{children}</div>

        {/* safety reassurance */}
        <SafetyBlock className="mt-6" />

        {/* footer submit */}
        <div className="mt-auto pt-8">
          <Button
            type="submit"
            loading={submitting}
            disabled={!canSubmit}
          >
            ถัดไป
          </Button>
        </div>
      </form>
    </div>
  )
}

export default RegisterView
