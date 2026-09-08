// DEV-ONLY visual harness — ManifestScreen (สมุดแมนิเฟสต์). สลับ ?empty=1 เพื่อดู onboarding.
import { useRouter } from "next/router"
import { ManifestScreen } from "@/features/v2-service/components/ManifestScreen"

const goal = (id: string, aff: string, category: string, imageUrl: string) => ({
  id, title: aff.slice(0, 40), affirmation: aff, category, imageUrl,
  status: "active", tasks: [], progress: { done: 0, target: 0, percent: 0 },
})

const FILLED = {
  goals: [
    goal("g1", "ฉันได้ทำงานที่ใช่ และมีทีมที่เข้าใจกัน", "การงาน", "/images/v2/destiny/bg-destiny.jpg"),
    goal("g2", "ฉันมีวิลล่า 100 หลัง", "การเงิน", "/images/v2/destiny/bg-clouds.jpg"),
  ],
  element: { elementTh: "ไม้", dayGanzhi: "甲子" },
} as never

const EMPTY = { goals: [], element: { elementTh: "ไม้", dayGanzhi: "甲子" } } as never

export default function ManifestPreviewPage() {
  const empty = useRouter().query.empty === "1"
  return <ManifestScreen previewData={empty ? EMPTY : FILLED} />
}
