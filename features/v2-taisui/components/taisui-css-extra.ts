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
`
