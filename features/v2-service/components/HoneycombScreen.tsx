// features/v2-service/components/HoneycombScreen.tsx — /v2/service/honeycomb
// เบอร์รังผึ้งเป็น "โหมด" ในหน้าดูเบอร์มือถือแล้ว (ฟีม 2026-09-10). route นี้เปิดหน้าเดียวกันโดยตั้งต้นโหมด honeycomb.
import { PhoneReadingScreen } from "@/features/v2-service/components/PhoneReadingScreen"

export function HoneycombScreen() {
  return <PhoneReadingScreen initialMode="honeycomb" />
}

export default HoneycombScreen
