// DEV-ONLY — ManifestHistoryScreen with mock, no login.
import { ManifestHistoryScreen } from "@/features/v2-service/components/ManifestHistoryScreen"

const MOCK = {
  streak: { current: 13, best: 28 },
  entries: [
    { entryDate: "2569-09-07".replace("2569", "2026"), mood: 4, note: "มีรุ่นพี่ทักมาชวนคุยเรื่องตำแหน่งใหม่ รู้สึกว่าเริ่มขยับจริง ๆ" },
    { entryDate: "2026-09-06", mood: 3, note: "วันนี้เฉย ๆ แต่ก็ยังอ่านครบทั้ง 3 ข้อ" },
    { entryDate: "2026-09-05", mood: 5, note: "ตัดสินใจสมัครงานที่ตั้งใจไว้แล้ว" },
  ],
} as never

export default function ManifestHistoryPreviewPage() {
  return <ManifestHistoryScreen previewData={MOCK} />
}
