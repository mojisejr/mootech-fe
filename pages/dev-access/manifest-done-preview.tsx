// DEV-ONLY — ManifestDoneScreen with mock, no login.
import { ManifestDoneScreen } from "@/features/v2-service/components/ManifestDoneScreen"

const MOCK = {
  affirmation: "ฉันได้ทำงานที่ใช่ และมีทีมที่เข้าใจกัน",
  startedAt: new Date(Date.now() - 43 * 86400000).toISOString(),
  reads: 38,
  balance: 595,
} as never

export default function ManifestDonePreviewPage() {
  return <ManifestDoneScreen previewData={MOCK} />
}
