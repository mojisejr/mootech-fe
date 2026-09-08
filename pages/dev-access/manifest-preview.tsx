// DEV-ONLY visual harness — ManifestScreen (สมุดแมนิเฟสต์) onboarding state, no login needed.
import { ManifestScreen } from "@/features/v2-service/components/ManifestScreen"

const MOCK = { goals: [], element: { elementTh: "ไม้", dayGanzhi: "甲子" } } as never

export default function ManifestPreviewPage() {
  return <ManifestScreen previewData={MOCK} />
}
