import { describe, expect, it } from "vitest";

import { nextIdentityAction, shouldBackfillSub } from "@/lib/auth/identity-binding";

describe("nextIdentityAction", () => {
  it("ไม่มี MEMBER_ID → register (first login)", () => {
    expect(nextIdentityAction(false, "sub-A", undefined)).toBe("register");
    expect(nextIdentityAction(false, "", undefined)).toBe("register");
  });

  // ⚠️ CRITICAL (regression #755/#760): ผู้ใช้เดิมที่ยังไม่มี MEMBER_SUB ต้อง "hydrate" เท่านั้น
  // ห้าม re-register — ไม่งั้นทุกคนค้างโหลด
  it("มี MEMBER_ID แต่ยังไม่ผูก sub → hydrate (ไม่ re-register)", () => {
    expect(nextIdentityAction(true, "sub-A", undefined)).toBe("hydrate");
    expect(nextIdentityAction(true, "sub-A", "")).toBe("hydrate");
  });

  it("มี MEMBER_ID + sub ตรง → hydrate", () => {
    expect(nextIdentityAction(true, "sub-A", "sub-A")).toBe("hydrate");
  });

  it("currentSub ว่างชั่วขณะ (session ยัง hydrate) → hydrate เสมอ (ไม่ค้าง)", () => {
    expect(nextIdentityAction(true, "", "sub-A")).toBe("hydrate");
    expect(nextIdentityAction(true, undefined, "sub-A")).toBe("hydrate");
  });

  it("boundSub ต่าง currentSub จริง (ทั้งคู่ไม่ว่าง) → clear-and-register (cross-account)", () => {
    expect(nextIdentityAction(true, "sub-B", "sub-A")).toBe("clear-and-register");
  });
});

describe("shouldBackfillSub", () => {
  it("backfill เฉพาะ: มี MEMBER_ID, ยังไม่ผูก sub, รู้ currentSub", () => {
    expect(shouldBackfillSub(true, "sub-A", undefined)).toBe(true);
    expect(shouldBackfillSub(true, "sub-A", "")).toBe(true);
  });
  it("ไม่ backfill เมื่อผูกแล้ว / ไม่มี currentSub / ไม่มี MEMBER_ID", () => {
    expect(shouldBackfillSub(true, "sub-A", "sub-A")).toBe(false);
    expect(shouldBackfillSub(true, "", undefined)).toBe(false);
    expect(shouldBackfillSub(false, "sub-A", undefined)).toBe(false);
  });
});
