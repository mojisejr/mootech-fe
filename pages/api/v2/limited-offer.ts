// BFF — GET /api/v2/limited-offer: โปรช่วงเวลา ("Limited time") สำหรับป๊อปอัปหน้าแรก (Home v3 รอบแรก · ประชุม 24 พ.ย. ข้อ 1).
// ปิดไว้จนกว่าเจ้าของจะตั้ง env ทั้งสองตัว: LIMITED_OFFER_PACKAGE (รหัสแพ็กใน payment_package) + LIMITED_OFFER_CODE (รหัสส่วนลด)
// ราคามาจาก priceFor — ตัวคิดเดียวกับหน้า checkout (list/discount/amount) จึงไม่มีทางป๊อปอัปบอกราคาหนึ่งแล้วหน้าจ่ายอีกแบบ
// โค้ดใช้ไม่ได้ (หมดอายุ/หยุด/ไม่ตรงแพ็ก) หรือไม่มีส่วนลด → { offer: null } = ป๊อปอัปทำงานแบบเดิม (ไม่มีข้อความ "ลดราคา" ปลอม)
// ไม่มีข้อมูลส่วนตัวใด ๆ ใน response → cache สั้น ๆ ที่ edge ได้
import type { NextApiRequest, NextApiResponse } from 'next'
import { priceFor } from '@/lib/discount/preview-flow'
import { limitedOfferConfig, limitedOfferFrom } from '@/features/v2-home/limited-offer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300')
  const cfg = limitedOfferConfig(process.env.LIMITED_OFFER_PACKAGE, process.env.LIMITED_OFFER_CODE)
  if (!cfg) {
    res.status(200).json({ offer: null })
    return
  }
  try {
    const priced = await priceFor(cfg.pkg, cfg.code, new Date())
    res.status(200).json({ offer: priced.ok ? limitedOfferFrom(priced, cfg.pkg, cfg.code) : null })
  } catch {
    res.status(502).json({ error: 'limited offer unreachable' })
  }
}
