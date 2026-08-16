// #285 phase 1 — teeth on lib/pwa/capability.ts's decision function (goo).
//
// The ใบ's test spec: feed 5 fabricated devices + a no-PushManager case, and every result must DIFFER.
// The silent bug this guards: collapsing "ยังไม่รู้" into `false`/'denied' — then มุน draws a closed/
// unsupported state on a device that is actually fine (or still being detected), and the screen lies.
// So the assertions pin the tri-state (null vs false) explicitly, and a fingerprint set proves the 5
// named states are genuinely distinct — not accidentally equal.
//
// .test.tsx on purpose: ci.yml's tsx lane globs `scripts/*.test.ts`, so this vitest-only spec is
// invisible to it (no skip-list to hand-sync — see vitest.config.mts). Registered in that include list.
import { describe, it, expect } from "vitest";
import {
  capabilityFromEnv,
  UNKNOWN_CAPABILITY,
  type CapabilityEnv,
  type PwaCapability,
} from "@/lib/pwa/capability";

/** base = a fully push-capable tab (Android Chrome / desktop). Cases override only what differs. */
const base: CapabilityEnv = {
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  isStandalone: false,
  isIOSSafari: false,
  notificationPermission: "default",
};

const fingerprint = (c: PwaCapability) => `${c.canReceivePush}|${c.needsInstall}|${c.permission}`;

describe("capabilityFromEnv — the 5 device states + no-PushManager", () => {
  it("① รับ push ได้ (Android/desktop tab): capable, no install, permission default", () => {
    expect(capabilityFromEnv(base)).toEqual<PwaCapability>({
      canReceivePush: true,
      needsInstall: false,
      permission: "default",
    });
  });

  it("② ต้องติดตั้งก่อน (iOS Safari tab: no PushManager, is iOS Safari, not standalone)", () => {
    const env: CapabilityEnv = {
      ...base,
      hasPushManager: false,
      hasNotification: false,
      isIOSSafari: true,
      isStandalone: false,
    };
    expect(capabilityFromEnv(env)).toEqual<PwaCapability>({
      canReceivePush: false,
      needsInstall: true,
      permission: "unknown", // no Notification API → permission is unknown, NOT 'denied'
    });
  });

  it("③ ปฏิเสธไปแล้ว: still capable, but permission denied", () => {
    expect(capabilityFromEnv({ ...base, notificationPermission: "denied" })).toEqual<PwaCapability>({
      canReceivePush: true,
      needsInstall: false,
      permission: "denied",
    });
  });

  it("④ อนุญาตแล้ว: capable, permission granted", () => {
    expect(capabilityFromEnv({ ...base, notificationPermission: "granted" })).toEqual<PwaCapability>({
      canReceivePush: true,
      needsInstall: false,
      permission: "granted",
    });
  });

  it("⑤ ยังไม่รู้ (SSR / first paint): null env → all unknown, NOT false", () => {
    const cap = capabilityFromEnv(null);
    expect(cap).toEqual(UNKNOWN_CAPABILITY);
    // the whole point: unknown must be distinguishable from "ตอบว่าไม่"
    expect(cap.canReceivePush).toBeNull();
    expect(cap.needsInstall).toBeNull();
    expect(cap.permission).toBe("unknown");
  });

  it("no PushManager at all (e.g. LINE WKWebView): not capable AND install won't help", () => {
    const env: CapabilityEnv = {
      ...base,
      hasPushManager: false,
      hasNotification: false,
      isIOSSafari: false, // WKWebView: navigator.standalone absent → not flagged iOS Safari
    };
    expect(capabilityFromEnv(env)).toEqual<PwaCapability>({
      canReceivePush: false,
      needsInstall: false, // ← key: does NOT send them down the install path
      permission: "unknown",
    });
  });

  it("all 5 named states produce DISTINCT results (the ใบ's 'ต่างกันครบ 5')", () => {
    const states = [
      capabilityFromEnv(base), // ①
      capabilityFromEnv({ ...base, hasPushManager: false, hasNotification: false, isIOSSafari: true }), // ②
      capabilityFromEnv({ ...base, notificationPermission: "denied" }), // ③
      capabilityFromEnv({ ...base, notificationPermission: "granted" }), // ④
      capabilityFromEnv(null), // ⑤
    ];
    const prints = new Set(states.map(fingerprint));
    expect(prints.size).toBe(5);
  });

  it("iOS Safari but ALREADY installed (standalone) → capable, no install prompt", () => {
    const env: CapabilityEnv = { ...base, isIOSSafari: true, isStandalone: true };
    expect(capabilityFromEnv(env)).toMatchObject({ canReceivePush: true, needsInstall: false });
  });
});
