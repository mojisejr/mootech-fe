// ปีชง 2570 — rules the real page needs beyond preview D: hidden sections, the reading list, the lock
// for visitors and the draft label.
export const TAISUI_CSS_EXTRA = `
body:has(.ts2570){background:#071a36}
.ts2570 [hidden]{display:none!important}
.ts2570 .reads .gap{height:14px}
.ts2570 .read h3:first-of-type{color:var(--ivory);font-family:var(--display);font-weight:400;font-size:20px;margin-top:14px}
.ts2570 .lock{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:22px;border-radius:22px;background:linear-gradient(180deg,rgba(20,85,164,.35),rgba(11,48,91,.5));border:1px solid rgba(201,214,242,.18)}
.ts2570 .lock p{margin:0;max-width:30ch}
.ts2570 .lock small{color:var(--mist);font-size:12px}
.ts2570 .lock .btn{animation:none}
.ts2570 .draft{display:inline-block;margin:0 0 14px;font-size:12px;font-weight:600;color:var(--ink);background:var(--gold);border-radius:999px;padding:2px 10px}
.ts2570 .foot a{color:var(--mist)}
.ts2570 .cta .link+.link{margin-top:-4px}
.ts2570 .oaToast{position:fixed;left:50%;top:calc(18px + env(safe-area-inset-top));transform:translateX(-50%);z-index:60;width:min(420px,calc(100vw - 32px));display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px 44px 14px 16px;border-radius:18px;background:rgba(7,26,54,.94);border:1px solid rgba(235,191,48,.45);box-shadow:0 10px 30px rgba(0,0,0,.35);color:var(--ivory)}
.ts2570 .oaToast p{margin:0;flex:1 1 200px;font-size:14px;line-height:1.5}
.ts2570 .oaToast .btn{animation:none;background:#06C755;color:#fff;padding:10px 16px;font-size:14px;text-decoration:none}
.ts2570 .oaToast .x{position:absolute;top:6px;right:8px;width:32px;height:32px;border:0;background:none;color:var(--mist);font-size:22px;cursor:pointer}
`
