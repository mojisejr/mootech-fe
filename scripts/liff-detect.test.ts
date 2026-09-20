import { describe, test, expect, afterEach, vi } from "vitest";
import { isLineInAppBrowser } from "@/lib/line/liff";

// ล็อก regex ตรวจ "อยู่ใน in-app browser ของ LINE" จาก User-Agent (Line/<version>) —
// ใช้ตัดสินว่าจะโชว์ปุ่ม "เปิดในเบราว์เซอร์" (ติดตั้ง PWA/notification ที่ in-app browser ทำไม่ได้).
describe("isLineInAppBrowser", () => {
  afterEach(() => vi.unstubAllGlobals());
  const withUA = (ua: string) => vi.stubGlobal("navigator", { userAgent: ua });

  test("LINE in-app browser UA (มี Line/<ver>) → true", () => {
    withUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Line/13.5.0");
    expect(isLineInAppBrowser()).toBe(true);
  });

  test("Safari ปกติ (ไม่มี Line/) → false", () => {
    withUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1");
    expect(isLineInAppBrowser()).toBe(false);
  });

  test("Chrome Android ปกติ → false", () => {
    withUA("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36");
    expect(isLineInAppBrowser()).toBe(false);
  });
});
