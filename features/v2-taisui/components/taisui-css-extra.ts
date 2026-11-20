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
/* plan revision 0.9: mobile first */
.ts2570 .wheel.has .z:not(.me){filter:grayscale(.75) brightness(.6);opacity:.7}
.ts2570 .z.me{box-shadow:inset 0 0 0 4px #EBBF30,0 0 0 3px rgba(225,255,0,.95),0 0 30px 10px rgba(225,255,0,.6);animation:ts-me 1.8s ease-in-out infinite}
@keyframes ts-me{50%{box-shadow:inset 0 0 0 4px #EBBF30,0 0 0 5px rgba(225,255,0,1),0 0 44px 16px rgba(225,255,0,.75)}}
.ts2570 .medal.me .ring{box-shadow:0 0 0 6px #E1FF00,0 0 0 14px rgba(225,255,0,.35),0 0 80px 22px rgba(225,255,0,.55)}
.ts2570 .actor.dim{opacity:.28;filter:grayscale(.7)}
.ts2570 .actor.lit .fig{transform:scale(1.14);transition:transform .35s var(--ease-out)}
.ts2570 .yam{margin:6px 0 0 30px;min-height:44px;width:calc(100% - 30px);border-radius:12px;border:1px solid rgba(7,26,54,.2);padding:0 10px;font:inherit;background:#fff;color:var(--ink)}
.ts2570 .role .dm{display:flex;align-items:center;gap:14px;margin:6px 0 12px}
.ts2570 .role .dm .gz{display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 50% 40%,#fff1c9,#ffcf6a 55%,#ef7a2f);color:var(--ink);font-family:var(--display);font-size:34px;box-shadow:0 0 0 3px rgba(235,191,48,.8)}
.ts2570 .role .dm small{display:block;color:var(--mist);font-size:12px}
.ts2570 .role .dm b{font-size:20px;color:var(--ivory)}
.ts2570 .role .rl{margin:0 0 14px;line-height:1.6}
.ts2570 .role .rl b{color:var(--gold)}
.ts2570 .marks{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:8px}
.ts2570 .marks li{display:flex;flex-direction:column;gap:2px;padding:10px 14px;border-radius:14px;background:rgba(255,255,255,.06);border-left:4px solid var(--mist)}
.ts2570 .marks li.care{border-left-color:#ff8a5c}
.ts2570 .marks li.good{border-left-color:var(--lime)}
.ts2570 .marks li b{font-size:15px}
.ts2570 .marks li span{font-size:13px;color:var(--mist)}
.ts2570 .role .how{font-size:12px;color:var(--mist);margin:0}
.ts2570 .rtabs{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 -16px 10px;padding:0 16px}
.ts2570 .rtabs::-webkit-scrollbar{display:none}
.ts2570 .rtab{flex:0 0 auto;min-height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(201,214,242,.3);background:none;color:var(--mist);font:inherit;font-size:14px}
.ts2570 .rtab.on{background:var(--lime);color:var(--ink);border-color:var(--lime);font-weight:700}
.ts2570 .reads{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;margin:0 -16px;padding:2px 16px 8px;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
.ts2570 .reads::-webkit-scrollbar{display:none}
.ts2570 .reads .read{flex:0 0 min(86vw,460px);scroll-snap-align:center}
.ts2570 .rx{display:grid;gap:8px;margin:10px 0 4px}
.ts2570 .rx .it{padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.07)}
.ts2570 .rx b{display:block;color:var(--gold)}
.ts2570 .rx small{display:block;color:var(--mist);font-size:12px;margin:2px 0 4px}
.ts2570 .rx p{margin:0;font-size:14px;line-height:1.55}
.ts2570 .read .line{display:block;width:100%;min-height:46px;margin-top:12px;border:0;border-radius:999px;background:#06C755;color:#fff;font:inherit;font-weight:700}
.ts2570 .dock{position:fixed;left:0;right:0;bottom:0;z-index:55;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:linear-gradient(180deg,rgba(7,26,54,0),rgba(7,26,54,.92) 40%);transform:translateY(110%);transition:transform .3s var(--ease-out);pointer-events:none}
.ts2570 .dock.on{transform:none;pointer-events:auto}
.ts2570 .dock .btn{display:block;width:min(100%,460px);margin:0 auto;min-height:52px;animation:none}
.ts2570 .foot{padding-bottom:calc(84px + env(safe-area-inset-bottom))}
@media (prefers-reduced-motion:reduce){.ts2570 .z.me{animation:none}.ts2570 .dock{transition:none}}
.ts2570 .oaToast{position:fixed;left:50%;top:calc(18px + env(safe-area-inset-top));transform:translateX(-50%);z-index:60;width:min(420px,calc(100vw - 32px));display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px 44px 14px 16px;border-radius:18px;background:rgba(7,26,54,.94);border:1px solid rgba(235,191,48,.45);box-shadow:0 10px 30px rgba(0,0,0,.35);color:var(--ivory)}
.ts2570 .oaToast p{margin:0;flex:1 1 200px;font-size:14px;line-height:1.5}
.ts2570 .oaToast .btn{animation:none;background:#06C755;color:#fff;padding:10px 16px;font-size:14px;text-decoration:none}
.ts2570 .oaToast .x{position:absolute;top:6px;right:8px;width:32px;height:32px;border:0;background:none;color:var(--mist);font-size:22px;cursor:pointer}
`
