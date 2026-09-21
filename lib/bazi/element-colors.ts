// FE element-color + label helpers — SINGLE SOURCE mirrored from the engine so every FE pillar renderer
// colors 天干(stem)/地支(branch) identically to the engine (เอ็ม 2026-09-21: "check สีใน engine pdf-dev").
//
// SOURCE OF TRUTH: bazi-sft-dataset/src/lib/bazi/symbolic-engine.constants.ts
//   ELEMENT_COLORS_TH · STEM_TO_ELEMENT · BRANCH_TO_ELEMENT · BRANCH_LABELS_TH
// If the engine changes these, update here too (FE can't import across the repo boundary).
// เดิม FE มี 3 palette ไม่ตรงกัน (ทอง=เทา/ทอง/เทา, ดิน=น้ำตาล/โอลีฟ/ส้ม) + fallback ดำ = อาการ "สีเลอะ".

/** ธาตุ(ไทย) → สี hex (ตรง engine ELEMENT_COLORS_TH เป๊ะ) */
// เอ็ม 2026-09-21 (ยืนยันซ้ำจากภาพ mark): ทอง = "สีเทา" ตาม engine canonical (ไม่ใช่สีทอง — รอบ #749
// ตีความผิดว่าเป็นทอง; "สีธาตุทอง ไม่ใช่สีทอง" = metal element ไม่ใช่สีทองจริง ให้เป็นเทา)
export const ELEMENT_COLOR: Record<string, string> = {
  ไม้: "#388659", // wood — green
  ไฟ: "#CB2C2A", // fire — red
  ดิน: "#F19953", // earth — orange
  ทอง: "#5A5A5A", // metal — gray (engine ELEMENT_COLORS_TH)
  น้ำ: "#1455A4", // water — blue
};

// 天干 → ธาตุ (engine STEM_TO_ELEMENT)
const STEM_ELEMENT: Record<string, string> = {
  甲: "ไม้", 乙: "ไม้", 丙: "ไฟ", 丁: "ไฟ", 戊: "ดิน",
  己: "ดิน", 庚: "ทอง", 辛: "ทอง", 壬: "น้ำ", 癸: "น้ำ",
};
// 地支 → ธาตุ (engine BRANCH_TO_ELEMENT)
const BRANCH_ELEMENT: Record<string, string> = {
  子: "น้ำ", 丑: "ดิน", 寅: "ไม้", 卯: "ไม้", 辰: "ดิน", 巳: "ไฟ",
  午: "ไฟ", 未: "ดิน", 申: "ทอง", 酉: "ทอง", 戌: "ดิน", 亥: "น้ำ",
};

// อักษรที่แมปไม่เจอ (แทบไม่เกิดกับ 干支 ที่ถูกต้อง) — น้ำเงินเข้มสุขุม ไม่ใช่ดำเลอะ
const FALLBACK_INK = "#1A264D";

export function stemColor(stem?: string | null): string {
  return ELEMENT_COLOR[STEM_ELEMENT[(stem ?? "")[0]]] ?? FALLBACK_INK;
}
export function branchColor(branch?: string | null): string {
  return ELEMENT_COLOR[BRANCH_ELEMENT[(branch ?? "")[0]]] ?? FALLBACK_INK;
}
/** สีจาก "ชื่อธาตุไทย" ตรง ๆ (เช่นที่ engine ส่ง stemElement="ทอง") */
export function elementColorTh(elementTh?: string | null): string {
  return ELEMENT_COLOR[(elementTh ?? "").trim()] ?? FALLBACK_INK;
}

// ── ป้าย EN + ราศี (ซินแสขอ: "Yin Metal" / "rabbit") ──
const YANG_STEMS = new Set(["甲", "丙", "戊", "庚", "壬"]);
const ELEMENT_EN: Record<string, string> = { ไม้: "Wood", ไฟ: "Fire", ดิน: "Earth", ทอง: "Metal", น้ำ: "Water" };
const BRANCH_ZODIAC_EN: Record<string, string> = {
  子: "rat", 丑: "ox", 寅: "tiger", 卯: "rabbit", 辰: "dragon", 巳: "snake",
  午: "horse", 未: "goat", 申: "monkey", 酉: "rooster", 戌: "dog", 亥: "pig",
};

/** 天干 → "Yin Metal" / "Yang Wood" (polarity + ธาตุ EN) */
export function stemEnLabel(stem?: string | null): string {
  const s = (stem ?? "")[0];
  const el = ELEMENT_EN[STEM_ELEMENT[s]];
  if (!el) return "";
  return `${YANG_STEMS.has(s) ? "Yang" : "Yin"} ${el}`;
}
/** 地支 → ราศี EN ตัวเล็ก เช่น "rabbit" */
export function branchZodiacEn(branch?: string | null): string {
  return BRANCH_ZODIAC_EN[(branch ?? "")[0]] ?? "";
}

// ── ธาตุไทย + ราศีไทย (ใช้หน้า "สีมงคลวันเกิด") ──
const BRANCH_ZODIAC_TH: Record<string, string> = {
  子: "ชวด", 丑: "ฉลู", 寅: "ขาล", 卯: "เถาะ", 辰: "มะโรง", 巳: "มะเส็ง",
  午: "มะเมีย", 未: "มะแม", 申: "วอก", 酉: "ระกา", 戌: "จอ", 亥: "กุน",
};
/** 天干 → ธาตุไทย เช่น "ทอง" */
export function stemElementTh(stem?: string | null): string {
  return STEM_ELEMENT[(stem ?? "")[0]] ?? "";
}
/** 地支 → ราศีไทย เช่น "เถาะ" */
export function branchZodiacTh(branch?: string | null): string {
  return BRANCH_ZODIAC_TH[(branch ?? "")[0]] ?? "";
}
