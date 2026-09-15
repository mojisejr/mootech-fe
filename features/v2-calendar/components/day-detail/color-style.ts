// ชื่อสีไทย → ชิปสีจริงของคำนั้น (พื้น/อักษร/ขอบ) — เลือกให้ตัวอักษรอ่านออกบนพื้น (สีอ่อน=อักษรเข้ม+ขอบ, สีเข้ม=อักษรขาว).
// แหล่งเดียวใช้ร่วม ShirtColors (สีเสื้อประจำวัน) + LuckyColors (ทิศ สีมงคล) — ไม่ให้ตารางสีแตกเป็น 2 ก๊อป.
// ดีไซน์เจ้าของเคาะ 2026-09-14: แต่ละสี = "ชิปสีจริง" (เขียว=เขียว แดง=แดง ขาว=ขอบเทา) อ่านง่ายกว่าตัวหนังสือเฉย ๆ.
export const COLOR_STYLE: Record<string, { bg: string; text: string; border?: string }> = {
  เขียว: { bg: '#2E9E5B', text: '#FFFFFF' },
  แดง: { bg: '#D6453A', text: '#FFFFFF' },
  ชมพู: { bg: '#F0A6BE', text: '#7A2942' },
  ส้ม: { bg: '#E8863A', text: '#FFFFFF' },
  ม่วง: { bg: '#7C5CBF', text: '#FFFFFF' },
  ครีม: { bg: '#F5ECCB', text: '#7A6A2A', border: '#E4D6A6' },
  เหลือง: { bg: '#F4CE3B', text: '#6B5410' },
  น้ำตาล: { bg: '#8A5A2B', text: '#FFFFFF' },
  ขาว: { bg: '#FFFFFF', text: '#5A5A5A', border: '#D8D8D8' },
  ฟ้า: { bg: '#7FC0EC', text: '#0F3E63' },
  น้ำเงิน: { bg: '#1F4E9E', text: '#FFFFFF' },
  เทา: { bg: '#8A929B', text: '#FFFFFF' },
  ดำ: { bg: '#2B2B2B', text: '#FFFFFF' },
}

export const COLOR_NEUTRAL = { bg: '#EDEFF2', text: '#3A4A5E' }
