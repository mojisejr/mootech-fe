// B-3 — ApiGrade wire contract. Plain tsx + node:assert. 13 levels + null + LOUD on anything else.
import assert from "node:assert";
import { API_GRADES, isApiGrade, parseApiGrade, type ApiGrade } from "../lib/v2/api-grade";

let pass = 0;
const ok = (name: string, cond: boolean) => {
  assert.ok(cond, `FAIL: ${name}`);
  pass += 1;
};

// exactly bazi's 13 — same set/order as rating-scale (verified against gradeForPercent in PR-1/#18)
const EXPECTED = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];
ok("13 levels, exact order matches bazi rating-scale", JSON.stringify([...API_GRADES]) === JSON.stringify(EXPECTED));
for (const g of EXPECTED) ok(`isApiGrade("${g}") = true`, isApiGrade(g));
for (const g of EXPECTED) ok(`parseApiGrade("${g}") passes through`, parseApiGrade(g) === g);

// null / undefined = คิดไม่ได้ (PR-1) → null, NOT a throw
ok("parseApiGrade(null) → null", parseApiGrade(null) === null);
ok("parseApiGrade(undefined) → null", parseApiGrade(undefined) === null);

// anything else must be LOUD (throw), never silently pass
const invalid: unknown[] = ["-", "Z", "A++", "b", "C ", "", 42, 0, {}, [], true, "F ", "a+"];
for (const bad of invalid) {
  let threw = false;
  try {
    parseApiGrade(bad);
  } catch {
    threw = true;
  }
  ok(`parseApiGrade(${JSON.stringify(bad)}) THROWS (not silent)`, threw);
  ok(`isApiGrade(${JSON.stringify(bad)}) = false`, !isApiGrade(bad));
}
// the "-" sentinel specifically is NOT an ApiGrade — the pipe uses null, not "-"
ok('"-" sentinel is not an ApiGrade', !isApiGrade("-"));

console.log(`✅ api-grade.test.ts — ${pass} assertions passed`);
