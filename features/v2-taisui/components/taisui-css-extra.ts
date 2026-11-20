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
.ts2570 .wheel .z{border-radius:50%}
.ts2570 .wheel.has .z:not(.me) .c{filter:grayscale(.75) brightness(.6);opacity:.7}
.ts2570 .wheel.has .z:not(.me) .n{color:var(--mist);border-color:rgba(201,214,242,.35)}
.ts2570 .wheel .n{position:absolute;left:50%;top:100%;transform:translate(-50%,-38%);padding:1px 8px;border-radius:999px;background:rgba(7,26,54,.82);border:1px solid rgba(235,191,48,.55);color:var(--ivory);font-family:var(--body);font-weight:600;font-size:12px;line-height:1.5;white-space:nowrap;letter-spacing:.01em}
.ts2570 .wheel .z.me .n,.ts2570 .zc.me{background:var(--lime);border-color:var(--lime);color:#071a36}
.ts2570 .zc{position:absolute;z-index:5;transform:translate(-50%,0);padding:2px 10px;border-radius:999px;background:rgba(7,26,54,.82);border:1px solid rgba(235,191,48,.55);color:var(--ivory);font-family:var(--body);font-weight:600;font-size:13px;line-height:1.5;white-space:nowrap;opacity:0;pointer-events:none}
.ts2570 .z.me{box-shadow:inset 0 0 0 4px #EBBF30,0 0 0 3px rgba(225,255,0,.95),0 0 30px 10px rgba(225,255,0,.6);animation:ts-me 1.8s ease-in-out infinite}
@keyframes ts-me{50%{box-shadow:inset 0 0 0 4px #EBBF30,0 0 0 5px rgba(225,255,0,1),0 0 44px 16px rgba(225,255,0,.75)}}
.ts2570 .medal.me .ring{box-shadow:0 0 0 6px #E1FF00,0 0 0 14px rgba(225,255,0,.35),0 0 80px 22px rgba(225,255,0,.55)}
.ts2570 .actor.dim{opacity:.28;filter:grayscale(.7)}
.ts2570 .pillars h2{position:relative;margin:0 auto 14px;width:max-content;max-width:calc(100% - 32px);padding:2px 14px;border-radius:999px;background:radial-gradient(ellipse at center,rgba(7,26,54,.92) 55%,rgba(7,26,54,0) 100%)}
.ts2570 .actor .pl{position:relative;padding:1px 8px;border-radius:999px;background:rgba(7,26,54,.78);border:1px solid rgba(201,214,242,.22)}
.ts2570 .actor .pr{margin-top:2px}
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
.ts2570 .reads .read{flex:0 0 min(86vw,460px);scroll-snap-align:center;display:flex;flex-direction:column}
.ts2570 .read .hd{min-height:96px}
.ts2570 .read .hd .rel{display:inline-block;margin-top:4px;padding:2px 10px;border-radius:999px;font-size:13px;font-weight:600;background:rgba(255,255,255,.1);color:var(--ivory)}
.ts2570 .read .hd .rel.care{background:rgba(255,138,92,.2);color:#ffc2a6}
.ts2570 .read .hd .rel.good{background:rgba(225,255,0,.16);color:var(--lime)}
.ts2570 .read .cfoot{margin-top:auto;padding-top:18px;display:grid;gap:10px}
.ts2570 .read .cfoot .ask,.ts2570 .read .cfoot .line{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:48px;margin:0;padding:0 18px;border-radius:999px;font:inherit;font-size:15px;font-weight:700;line-height:1.2;text-decoration:none;box-sizing:border-box}
.ts2570 .read .cfoot .ask{background:rgba(255,255,255,.08);color:var(--ivory);border:1px solid rgba(255,247,230,.35)}
.ts2570 .read .cfoot .ask img{width:28px;height:28px;background:#fff}
.ts2570 .read .cfoot .line{background:#06C755;color:#fff;border:0;box-shadow:0 6px 18px rgba(6,199,85,.28)}
.ts2570 .read .cfoot .ask:active,.ts2570 .read .cfoot .line:active{transform:scale(.98)}
.ts2570 .read .cfoot .ask:focus-visible,.ts2570 .read .cfoot .line:focus-visible{outline:3px solid var(--lime);outline-offset:2px}
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
.ts2570 .chart{position:relative;margin:4px 0 16px;padding:14px 12px 12px;border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.03));border:1px solid rgba(235,191,48,.28)}
.ts2570 .chart .yr{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.ts2570 .chart .yc{display:grid;place-items:center;flex:0 0 40px;height:40px;border-radius:12px;background:radial-gradient(circle at 50% 40%,#ffcf6a,#ef7a2f 70%,#b8231d);color:#fff7e6;font-size:22px;font-weight:700;box-shadow:0 0 16px rgba(255,140,60,.5)}
.ts2570 .chart .yc.go{animation:ts-launch .5s ease-out}
.ts2570 .chart .yr small{flex:1;font-size:12px;color:var(--mist);line-height:1.35}
.ts2570 .chart .again{min-height:36px;padding:0 12px;border-radius:999px;border:1px solid rgba(201,214,242,.4);background:none;color:var(--ivory);font:inherit;font-size:13px}
.ts2570 .g8{display:grid;grid-template-columns:46px repeat(var(--cols),minmax(0,1fr));gap:6px;align-items:center}
.ts2570 .g8 .ph{text-align:center;font-size:12px;color:var(--mist)}
.ts2570 .g8 .rlab{font-size:12px;color:var(--mist);line-height:1.2}
.ts2570 .c8{position:relative;display:grid;place-items:center;min-height:66px;padding:6px 2px;border-radius:14px;border:1.5px solid rgba(201,214,242,.22);background:rgba(7,26,54,.55);color:var(--ivory);font:inherit;overflow:hidden;transition:border-color .3s,background-color .3s}
.ts2570 .c8 b{font-size:26px;line-height:1.15;font-weight:600}
.ts2570 .c8 small{font-size:12px;color:var(--mist);line-height:1.3;white-space:nowrap}
.ts2570 .c8.me8{border-color:rgba(235,191,48,.75)}
.ts2570 .c8.me8 small{color:var(--gold)}
.ts2570 .c8.hit.care{border-color:#ff8a5c;background-color:rgba(255,138,92,.16)}
.ts2570 .c8.hit.good{border-color:var(--lime);background-color:rgba(225,255,0,.1)}
.ts2570 .c8:focus-visible,.ts2570 .chart .again:focus-visible{outline:3px solid var(--lime);outline-offset:2px}
.ts2570 .chart .tok{position:absolute;left:0;top:0;z-index:3;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,#fff1c9,#ffcf6a 45%,#ef7a2f);color:#7a1410;font-size:22px;font-weight:700;opacity:0;pointer-events:none;box-shadow:0 0 22px 6px rgba(255,170,80,.6)}
.ts2570 .chart .tok.good{background:radial-gradient(circle,#fbffd1,#e1ff00 62%);box-shadow:0 0 22px 6px rgba(225,255,0,.55)}
.ts2570 .c8.fx-clash{animation:ts-shake .5s cubic-bezier(.3,0,.3,1)}
.ts2570 .c8.fx-clash::after{content:"";position:absolute;inset:-30%;background:radial-gradient(circle,rgba(255,225,160,.95),rgba(255,120,60,.5) 30%,transparent 60%);animation:ts-burst .6s ease-out forwards;pointer-events:none}
.ts2570 .c8.fx-press{animation:ts-press .7s cubic-bezier(.3,0,.2,1)}
.ts2570 .c8.fx-press::after{content:"";position:absolute;left:0;right:0;top:0;height:60%;background:linear-gradient(180deg,rgba(60,25,80,.8),transparent);animation:ts-weigh .9s ease-out forwards;pointer-events:none}
.ts2570 .c8.fx-shade::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(3,8,22,.9) 50%,transparent);animation:ts-sweep 1.1s ease-in-out forwards;pointer-events:none}
.ts2570 .c8.fx-crack::after{content:"";position:absolute;inset:6% 12%;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'%3E%3Cpolyline points='34,0 26,16 37,26 22,40 31,48 25,60' fill='none' stroke='%23ff8a5c' stroke-width='3.5' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;animation:ts-crack .7s ease-out forwards;pointer-events:none}
.ts2570 .c8.fx-chain{animation:ts-chain 1.2s ease-out}
.ts2570 .c8.fx-glow{animation:ts-glow 1.1s ease-out}
@keyframes ts-shake{0%,100%{transform:none}20%{transform:translateX(-6px) rotate(-3deg)}40%{transform:translateX(6px) rotate(3deg)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
@keyframes ts-burst{from{opacity:1;transform:scale(.3)}to{opacity:0;transform:scale(1.4)}}
@keyframes ts-press{0%{transform:none}30%{transform:translateY(5px) scaleY(.88)}100%{transform:none}}
@keyframes ts-weigh{0%{opacity:0;transform:translateY(-100%)}35%{opacity:1;transform:none}100%{opacity:.3;transform:none}}
@keyframes ts-sweep{from{transform:translateX(100%)}to{transform:translateX(-100%)}}
@keyframes ts-crack{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes ts-chain{0%,34%,67%{box-shadow:0 0 0 0 rgba(255,138,92,.85)}33%,66%,100%{box-shadow:0 0 0 7px rgba(255,138,92,0)}}
@keyframes ts-glow{0%{box-shadow:0 0 0 0 rgba(225,255,0,.9)}100%{box-shadow:0 0 0 14px rgba(225,255,0,0)}}
@keyframes ts-launch{0%,100%{transform:none}40%{transform:scale(1.2)}}
.ts2570 .chart .cap{min-height:70px;margin:12px 0 6px;display:grid;gap:2px;font-size:14px;line-height:1.5}
.ts2570 .chart .cap b{color:var(--gold);font-size:15px}
.ts2570 .chart .cap .why{font-size:15px;color:var(--ivory)}
.ts2570 .chart .cap .pl{color:var(--mist)}
.ts2570 .chart .legend{margin:0;padding-top:8px;border-top:1px solid rgba(201,214,242,.15);font-size:12px;color:var(--mist);line-height:1.6}
.ts2570 .ylead{margin:0 0 10px;font-size:14px;line-height:1.55;color:var(--mist)}
.ts2570 .ylead b{color:var(--gold)}
.ts2570 .read .story{margin:6px 0 0;font-size:15px;line-height:1.6}
.ts2570 .read .k2{margin:14px 0 6px;font-size:12px;color:var(--mist);letter-spacing:.04em}
.ts2570 .read .sx{margin-top:12px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(235,191,48,.3)}
.ts2570 .read .sx summary{display:flex;align-items:center;justify-content:space-between;min-height:44px;padding:0 14px;font-size:14px;font-weight:600;color:var(--gold);cursor:pointer;list-style:none}
.ts2570 .read .sx summary::-webkit-details-marker{display:none}
.ts2570 .read .sx summary::after{content:"";width:8px;height:8px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg) translateY(-2px);transition:transform .2s}
.ts2570 .read .sx[open] summary::after{transform:rotate(-135deg)}
.ts2570 .read .sx summary:focus-visible{outline:3px solid var(--lime);outline-offset:2px;border-radius:14px}
.ts2570 .read .sx .rx{padding:0 10px 10px}
@media (prefers-reduced-motion:reduce){.ts2570 .c8,.ts2570 .c8::after,.ts2570 .chart .yc{animation:none!important}}
.ts2570 .packet-zone{min-height:560px;padding-top:112px}
.ts2570 .env .body{box-shadow:inset 0 0 0 7px #b71c19,inset 0 0 0 8.5px rgba(235,191,48,.85),0 20px 40px rgba(0,0,0,.4)}
.ts2570 .env .pocket{inset:30% 0 0 0;clip-path:polygon(0 0,50% 20%,100% 0,100% 100%,0 100%);box-shadow:inset 0 0 0 7px #a51717,inset 0 0 0 8.5px rgba(235,191,48,.7)}
.ts2570 .env .flap{height:42%;transition:transform .72s cubic-bezier(.45,0,.2,1) .06s,z-index 0s .42s,opacity .5s ease 1.2s;filter:drop-shadow(0 2px 0 rgba(235,191,48,.9)) drop-shadow(0 8px 10px rgba(0,0,0,.22))}
.ts2570 .env .flap i{clip-path:polygon(0 0,100% 0,100% 40%,57% 95%,50% 100%,43% 95%,0 40%)}
.ts2570 .env .seal{top:42%}
.ts2570 .env.dragging .flap{transform:rotateX(var(--lift,0deg));transition:none}
.ts2570 .env.open .seal{transition:transform .5s cubic-bezier(.22,.8,.24,1),opacity .4s ease .05s;transform:translate(-50%,-50%) translateY(calc(var(--dy,0px) - 48px)) rotate(var(--rot,0deg)) scale(.8);opacity:0}
.ts2570 .env.open .flap{transform:rotateX(180deg);z-index:0;opacity:0}
.ts2570 .env.open .card{animation:ts-cardRise 1.8s cubic-bezier(.22,.8,.24,1) .45s forwards}
.ts2570 .env.open .body,.ts2570 .env.open .pocket{animation:ts-envAway .7s cubic-bezier(.4,0,.2,1) 1.15s forwards}
@keyframes ts-cardRise{0%{opacity:0;transform:translateY(0)}8%{opacity:1}42%{opacity:1;transform:translateY(-40%)}100%{opacity:1;transform:translateY(-4%) scale(1.06);box-shadow:0 26px 44px rgba(0,0,0,.45),0 0 0 3px rgba(235,191,48,.8)}}
@keyframes ts-envAway{to{opacity:0;transform:translateY(12%) scale(.97)}}
@media (prefers-reduced-motion:reduce){.ts2570 .env.open .card{animation:none;opacity:1;transform:translateY(-4%) scale(1.06)}.ts2570 .env.open .body,.ts2570 .env.open .pocket{animation:none;opacity:0}.ts2570 .env .flap,.ts2570 .env.open .seal{transition:none}}
@media (prefers-reduced-motion:reduce){.ts2570 .z.me{animation:none}.ts2570 .dock{transition:none}}
.ts2570 .oaToast{position:fixed;left:50%;top:calc(18px + env(safe-area-inset-top));transform:translateX(-50%);z-index:60;width:min(420px,calc(100vw - 32px));display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px 44px 14px 16px;border-radius:18px;background:rgba(7,26,54,.94);border:1px solid rgba(235,191,48,.45);box-shadow:0 10px 30px rgba(0,0,0,.35);color:var(--ivory)}
.ts2570 .oaToast p{margin:0;flex:1 1 200px;font-size:14px;line-height:1.5}
.ts2570 .oaToast .btn{animation:none;background:#06C755;color:#fff;padding:10px 16px;font-size:14px;text-decoration:none}
.ts2570 .oaToast .x{position:absolute;top:6px;right:8px;width:32px;height:32px;border:0;background:none;color:var(--mist);font-size:22px;cursor:pointer}
`
