// DEV-ONLY — ManifestReadScreen (read/review) with mock goals, no login.
import { ManifestReadScreen } from "@/features/v2-service/components/ManifestReadScreen"

const MOCK = {
  goalId: "g1",
  goals: [
    { id: "g1", title: "ฉันได้ทำงานที่ใช่", affirmation: "ฉันได้ทำงานที่ใช่ และมีทีมที่เข้าใจกัน", category: "การงาน", imageUrl: "/images/v2/destiny/bg-destiny.jpg", status: "active" },
    { id: "g2", title: "ฉันมีวิลล่า 100 หลัง", affirmation: "ฉันมีวิลล่า 100 หลัง", category: "การเงิน", imageUrl: "/images/v2/destiny/bg-clouds.jpg", status: "active" },
  ],
} as never

export default function ManifestReadPreviewPage() {
  return <ManifestReadScreen previewData={MOCK} />
}
