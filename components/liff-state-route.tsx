import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { safeNextPath } from "@/features/auth/hooks/useV2Login";

// slice 7c (2026-10-02) — แทน LiffBoot.
//
// entry ผ่าน LIFF URL (https://liff.line.me/<id>/<path>, เช่น rich menu) — LINE พามาที่ endpoint พร้อม
// ?liff.state=<path> แล้ว liff.init() เคยเป็นคนพาต่อไป <path>. LiffBoot (init SDK ทุกหน้า) ถอดออกแล้ว เพราะ LIFF
// ไม่ใช้กับล็อกอินอีก (ช่อง LIFF คนละ Provider) → ทำส่วน "พาต่อ" เองตรงนี้ โดยไม่โหลด SDK.
// รับเฉพาะ path ภายในเว็บ (safeNextPath: ขึ้นต้น '/', ไม่ใช่ '//' ไม่มี '://') กัน open redirect.
export function liffStateTarget(search: string): string | null {
  const raw = new URLSearchParams(search).get("liff.state");
  return safeNextPath(raw ?? "");
}

export default function LiffStateRoute(): null {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || typeof window === "undefined") return;
    done.current = true;
    const target = liffStateTarget(window.location.search);
    if (target) void router.replace(target);
  }, [router]);
  return null;
}
