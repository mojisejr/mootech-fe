// Which files under public/ the service worker downloads when it installs
// (CIEL mumate-fe-db-resilience-001 slice 6).
//
// @serwist/next precaches EVERY file under public/ unless told otherwise. On 2026-11-17 that was 1,326 files and
// about 130 MB (public/images and its WebP twins) fetched by every new browser context, on top of the 83 requests
// the page itself needs. A visitor from an in-app browser paid it without ever opening most of those screens, and
// on a busy evening those downloads were most of the traffic the host served.
//
// The worker exists for install + push (sw.ts: no runtime caching, navigations always go to the network), so it
// needs only what an installed app shows before any page loads: the web manifest and the icons. Images are
// fetched when a screen uses them and kept by the browser's own HTTP cache (/images answers max-age=604800).
// The build's own hashed assets under /_next are added by Serwist separately and are not affected by this list.
//
// Keep each entry an exact file name or a "<folder>/**/*" pattern: scripts/sw-precache-scope.test.ts reads this
// list with that grammar and fails if an entry reaches public/images or another heavy folder.
export const PRECACHE_PUBLIC_PATTERNS = ["manifest.json", "favicon.ico", "icons/**/*"];
