// lib/v2/api-grade.ts — the grade contract on the PIPE side (goo lane).
//
// Kept SEPARATE from μุน's UI `Grade` (features/v2-calendar/types.ts, which drives GRADE_COLORS as a
// Record<Grade,…>): the wire already speaks 13 levels (bazi's rating-scale), but the screen must not be
// forced to know all 13 — extending `Grade` would turn her color build red until every tint is painted.
// So the pipe carries `ApiGrade`; the UI adopts levels at its own pace. Do NOT touch her `Grade`.
//
// 13 levels, exactly bazi's rating-scale order (same table gradeForPercent maps to). `null` = "คิดไม่ได้"
// (PR-1: overallPercent null → grade null, NOT the "-" sentinel gradeForPercent returns).

export const API_GRADES = [
  "F",
  "D-",
  "D",
  "D+",
  "C-",
  "C",
  "C+",
  "B-",
  "B",
  "B+",
  "A-",
  "A",
  "A+",
] as const;

export type ApiGrade = (typeof API_GRADES)[number];

const API_GRADE_SET: ReadonlySet<string> = new Set(API_GRADES);

/** true iff x is one of the 13 wire grades. */
export function isApiGrade(x: unknown): x is ApiGrade {
  return typeof x === "string" && API_GRADE_SET.has(x);
}

/**
 * Validate a grade off the pipe: one of the 13, or `null` (คิดไม่ได้). Anything else — a typo, the "-"
 * sentinel, a rounded number, a stray shape — THROWS. An unknown grade must be LOUD, never silently passed
 * downstream where it would render as an empty cell nobody notices.
 */
export function parseApiGrade(x: unknown): ApiGrade | null {
  if (x === null || x === undefined) return null;
  if (isApiGrade(x)) return x;
  throw new Error(
    `[api-grade] ค่าเกรดไม่รู้จัก: ${JSON.stringify(x)} — ต้องเป็น 1 ใน ${API_GRADES.length} ระดับ (${API_GRADES.join(" ")}) หรือ null`,
  );
}
