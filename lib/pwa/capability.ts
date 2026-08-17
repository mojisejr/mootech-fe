// MuMate PWA · device capability — the contract มุน (phase 2, #286) waits for (goo · #285 phase 1).
//
// มุน's UI asks THREE questions before it can draw the notification controls:
//   canReceivePush — does THIS runtime actually have the push APIs right now?
//   needsInstall   — must the user Add-to-Home-Screen first before push can work? (iOS Safari)
//   permission     — 'default' | 'granted' | 'denied'
//
// 🔴 THE RULE THAT DECIDES THE SHAPE (มุน chose it): a value must distinguish "ยังไม่รู้" from "ตอบว่าไม่".
// On SSR and during the first client render the answer is genuinely UNKNOWN — so canReceivePush /
// needsInstall are `null` and permission is `'unknown'`, NOT `false`/`'denied'`. มุน draws a skeleton
// on unknown; sending `false` too early would make the screen LIE ("push not supported") on a device
// that actually supports it.
//
// 🔴 DETECT BY CAPABILITY, NOT BY OS NAME (มุน's catch): parsing the UA string for "iPhone" mis-routes
// the in-app LINE browser (a WKWebView) down the wrong path. Everything here is FEATURE detection:
//   • push support   = `'PushManager' in window` etc. — the API is literally present or not.
//   • iOS Safari     = `typeof navigator.standalone === 'boolean'` — this property EXISTS only in iOS
//                      Safari/WebKit, and is ABSENT in the LINE WKWebView. So "needs install" never
//                      fires for LINE's browser (it gets canReceivePush=false → "ไม่รองรับ" instead).
//   • standalone     = display-mode media query OR navigator.standalone === true.

import { useEffect, useState } from "react";

export type PermissionState = "default" | "granted" | "denied" | "unknown";

export interface PwaCapability {
  /** true = push APIs present now · false = absent · null = ยังไม่รู้ (SSR / first paint) */
  canReceivePush: boolean | null;
  /** true = must Add-to-Home-Screen first (iOS Safari tab) · false = no · null = ยังไม่รู้ */
  needsInstall: boolean | null;
  /** notification permission, or 'unknown' before we've read the runtime */
  permission: PermissionState;
}

/** The single "we don't know yet" value — SSR default and the hook's first-render state. */
export const UNKNOWN_CAPABILITY: PwaCapability = {
  canReceivePush: null,
  needsInstall: null,
  permission: "unknown",
};

/**
 * A pure snapshot of the runtime's push-relevant facts. Injected so capabilityFromEnv() is testable
 * without a real browser — the unit test feeds fabricated devices; readCapabilityEnv() fills it from
 * real globals at runtime. `null` means "no runtime to read" (SSR) → capability is UNKNOWN.
 */
export interface CapabilityEnv {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  /** running as an installed app (display-mode standalone, or iOS navigator.standalone === true) */
  isStandalone: boolean;
  /** iOS Safari, feature-detected via presence of navigator.standalone — NOT a UA string match */
  isIOSSafari: boolean;
  /** Notification.permission — only meaningful when hasNotification is true */
  notificationPermission: NotificationPermission;
}

/**
 * Pure decision function — the whole contract lives here so the unit test can prove all states differ.
 */
export function capabilityFromEnv(env: CapabilityEnv | null): PwaCapability {
  if (env === null) return UNKNOWN_CAPABILITY;

  const canReceivePush = env.hasServiceWorker && env.hasPushManager && env.hasNotification;

  // Install only UNLOCKS push on iOS Safari (where the tab has no PushManager until installed). On a
  // device that already has push, or one that will never get it (LINE webview), install is NOT the fix.
  const needsInstall = !canReceivePush && env.isIOSSafari && !env.isStandalone;

  const permission: PermissionState = env.hasNotification ? env.notificationPermission : "unknown";

  return { canReceivePush, needsInstall, permission };
}

/**
 * Read the real runtime. Client-only — returns null on the server (→ UNKNOWN capability), which is how
 * the hook stays SSR-safe and hands มุน a skeleton until the effect runs.
 */
export function readCapabilityEnv(): CapabilityEnv | null {
  if (typeof window === "undefined") return null;
  const nav = window.navigator as Navigator & { standalone?: boolean };

  const isIOSSafari = typeof nav.standalone === "boolean";
  const isStandalone =
    nav.standalone === true ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches);
  const hasNotification = "Notification" in window;

  return {
    hasServiceWorker: "serviceWorker" in nav,
    hasPushManager: "PushManager" in window,
    hasNotification,
    isStandalone,
    isIOSSafari,
    notificationPermission: hasNotification ? Notification.permission : "default",
  };
}

/**
 * #307 (มุน) — "ไปอ่านรันไทม์ใหม่เดี๋ยวนี้". visibilitychange ครอบเคส "ผู้ใช้ออกไปตั้งค่าเครื่องแล้วกลับมา"
 * ได้ แต่ครอบเคส "กดอนุญาตในกล่องของเบราว์เซอร์บนหน้าเดิม" ไม่ได้ — บนเดสก์ท็อป การกดอนุญาตไม่ทำให้
 * หน้าซ่อนหรือโผล่ ⇒ hook ไม่เคยรู้ว่าสิทธิ์เปลี่ยน แล้วจอจะค้างบอกว่า "ยังไม่ได้เปิด" ทั้งที่เปิดแล้ว.
 *
 * 🔴 event นี้เป็นแค่ "สัญญาณให้ไปอ่าน" ❌ ไม่ใช่ช่องส่งค่า — ผู้เรียกยัดค่า capability เข้ามาไม่ได้เลย
 * ทุก path ยังจบที่ readCapabilityEnv() ตัวเดียวกัน ⇒ ไม่มีทางที่จอจะแสดงสิทธิ์ที่ไม่ตรงกับของจริง
 */
export const CAPABILITY_CHANGED = "mumate:capability-changed";

/**
 * React hook มุน binds to (phase 2). SSR-safe by construction: returns UNKNOWN_CAPABILITY on the
 * server and the first client render (so the markup matches → no hydration mismatch), then resolves
 * to the real capability in an effect. Re-reads on visibility change so a permission the user grants
 * in the OS prompt (or an install completed in another tab) is reflected without a manual reload —
 * and on CAPABILITY_CHANGED, for the same-page grant that visibilitychange cannot see (#307).
 */
export function usePwaCapability(): PwaCapability {
  const [capability, setCapability] = useState<PwaCapability>(UNKNOWN_CAPABILITY);

  useEffect(() => {
    const read = () => setCapability(capabilityFromEnv(readCapabilityEnv()));
    read();
    document.addEventListener("visibilitychange", read);
    document.addEventListener(CAPABILITY_CHANGED, read);
    return () => {
      document.removeEventListener("visibilitychange", read);
      document.removeEventListener(CAPABILITY_CHANGED, read);
    };
  }, []);

  return capability;
}
