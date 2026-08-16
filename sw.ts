/// <reference lib="webworker" />
// MuMate PWA · service worker (goo · mootech-fe#285 phase 1 — โครง PWA).
//
// The reference above pulls in ServiceWorkerGlobalScope for THIS file only (the app's tsconfig targets
// the DOM lib, not webworker) — no global tsconfig change, so the rest of the app is untouched.
//
// Built by Serwist (@serwist/next) → public/sw.js at build time. Registered by pages/_app.tsx.
//
// SCOPE of THIS ticket: install + receive push only. We deliberately DO NOT add runtime navigation
// caching (the "offline หน้าเว็บ" the ใบ says NOT to build in phase 1). Serwist still precaches the
// build's own hashed assets from `self.__SW_MANIFEST`, but with skipWaiting + clientsClaim a new
// deploy takes over on the NEXT load — never "ต้องปิดแท็บก่อน". That is ตู๋'s phase-1 gate:
//   deploy ใหม่ → refresh 1 ครั้ง → ได้ของใหม่ (maw-office#23 was the stale-SW trap we are avoiding).
//
// The `push` / `notificationclick` handlers below are the RECEIVER half only. Nothing SENDS a push in
// phase 1 (that is phase 3/4 on the server). They exist so the SW is push-ready the moment a
// subscription is created, and so a manual DevTools "Push" test shows a notification end-to-end.

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected by @serwist/next at build time — the precache manifest for THIS build.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // A new SW activates and controls open pages immediately → one refresh after deploy is enough.
  skipWaiting: true,
  clientsClaim: true,
  // Phase 1 = install + push ONLY. runtimeCaching is EMPTY on purpose: Serwist's defaultCache includes
  // `pages` / `pages-rsc` / `next-data` / `others` — that IS the HTML+navigation (offline page-shell)
  // caching the ใบ forbids this phase. We add nothing runtime; the build's own assets are already
  // covered by the precache manifest above. So navigations always hit the network → always fresh,
  // and there is no page shell to go stale. (verified: compiled public/sw.js has no runtime cache route.)
  runtimeCaching: [],
});

serwist.addEventListeners();

// ── Push receiver (ready for phase 4's server sender) ───────────────────────────────────────────
self.addEventListener("push", (event) => {
  // A phase-4 payload is JSON { title, body, url }. Fall back to plain text / defaults so a manual
  // DevTools push (which may send raw text or nothing) still renders instead of throwing.
  let title = "MuMate";
  let body = "ถึงเวลายามมงคลแล้ว";
  let url = "/";
  if (event.data) {
    try {
      const payload = event.data.json() as { title?: string; body?: string; url?: string };
      title = payload.title ?? title;
      body = payload.body ?? body;
      url = payload.url ?? url;
    } catch {
      body = event.data.text() || body;
    }
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => "focus" in c);
      if (existing) return (existing as WindowClient).focus();
      return self.clients.openWindow(url);
    }),
  );
});
