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
.ts2570 .role .verdict .k{font-size:13px;color:var(--mist);letter-spacing:.04em}
.ts2570 .role .verdict h2{font-family:var(--display);font-weight:400;font-size:clamp(28px,8.4vw,38px);line-height:1.28;margin:8px 0 10px;text-wrap:balance}
.ts2570 .role .verdict .sub{margin:0 0 18px;color:var(--mist);font-size:15px;line-height:1.6}
.ts2570 .role .verdict .sub b{color:var(--gold);font-weight:600}
.ts2570 .prow{list-style:none;margin:0 0 18px;padding:0;border-top:1px solid rgba(201,214,242,.14)}
.ts2570 .prow li{display:grid;grid-template-columns:52px 1fr;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid rgba(201,214,242,.14);opacity:0;transform:translateY(14px);transition:opacity .6s cubic-bezier(.2,.8,.2,1),transform .6s cubic-bezier(.2,.8,.2,1)}
.ts2570 .prow.in li{opacity:1;transform:none}
.ts2570 .prow li img{width:52px;height:52px;border-radius:50%;object-fit:cover;object-position:50% 18%;background:#eef2ff;box-shadow:inset 0 0 0 2px rgba(235,191,48,.8)}
.ts2570 .prow li small{display:block;font-size:12px;color:var(--mist)}
.ts2570 .prow li b{display:block;font-size:16px;font-weight:600;line-height:1.45}
.ts2570 .prow li .also{display:block;font-style:normal;font-size:14px;color:var(--lime);margin-top:2px}
.ts2570 .prow li i{font-style:normal;display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:2px;background:var(--mist)}
.ts2570 .prow li.care i{background:#ff8a5c}
.ts2570 .prow li.good i{background:var(--lime)}
.ts2570 .fold{border:1px solid rgba(235,191,48,.35);border-radius:18px;overflow:hidden}
.ts2570 .fold > summary{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:56px;padding:0 18px;list-style:none;cursor:pointer;font-weight:600;color:var(--gold)}
.ts2570 .fold > summary::-webkit-details-marker{display:none}
.ts2570 .fold > summary small{display:block;font-weight:400;font-size:12px;color:var(--mist)}
.ts2570 .fold > summary::after{content:"";flex:0 0 9px;height:9px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg) translateY(-3px);transition:transform .25s}
.ts2570 .fold[open] > summary::after{transform:rotate(-135deg)}
.ts2570 .fold > summary:focus-visible{outline:3px solid var(--lime);outline-offset:-3px;border-radius:18px}
.ts2570 .fold .chart{margin:0;border:0;border-radius:0;background:none}
.ts2570 .fold > .dm,.ts2570 .fold > .rl,.ts2570 .fold > .how{margin-left:14px;margin-right:14px}
.ts2570 .fold > .how{margin-bottom:14px}
@media (prefers-reduced-motion:reduce){.ts2570 .prow li{transition:none;opacity:1;transform:none}}
.ts2570 .wheel svg.he{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.ts2570 .wheel svg.he line{stroke:#EBBF30;stroke-width:3;stroke-linecap:round;filter:drop-shadow(0 0 6px rgba(235,191,48,.7))}
.ts2570 .wheel svg.he line.care{stroke:#ff8a5c;filter:drop-shadow(0 0 6px rgba(255,138,92,.6))}
.ts2570 .wheel .heb{position:absolute;z-index:2;transform:translate(-50%,-50%) scale(var(--s,0));padding:2px 9px;border-radius:999px;background:#071a36;border:1.5px solid #EBBF30;color:var(--ivory);font-size:13px;font-weight:700;line-height:1.5;white-space:nowrap;transition:transform .35s var(--ease-pop)}
.ts2570 .wheel .heb.care{border-color:#ff8a5c}
.ts2570 .prow li .also.care{color:#ffc2a6}
@media (prefers-reduced-motion:reduce){.ts2570 .z.me{animation:none}.ts2570 .dock{transition:none}}
.ts2570 .oaToast{position:fixed;left:50%;top:calc(18px + env(safe-area-inset-top));transform:translateX(-50%);z-index:60;width:min(420px,calc(100vw - 32px));display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px 44px 14px 16px;border-radius:18px;background:rgba(7,26,54,.94);border:1px solid rgba(235,191,48,.45);box-shadow:0 10px 30px rgba(0,0,0,.35);color:var(--ivory)}
.ts2570 .oaToast p{margin:0;flex:1 1 200px;font-size:14px;line-height:1.5}
.ts2570 .oaToast .btn{animation:none;background:#06C755;color:#fff;padding:10px 16px;font-size:14px;text-decoration:none}
.ts2570 .oaToast .x{position:absolute;top:6px;right:8px;width:32px;height:32px;border:0;background:none;color:var(--mist);font-size:22px;cursor:pointer}
/* plan revision 0.11: year then months, one share place, the shop (design/TEAM-REVIEW-2026-11-22.md) */
.ts2570 #bubT{white-space:pre-line}
.ts2570 .bubble.dense{font-size:13px;line-height:1.4;padding:8px 12px;gap:6px}
.ts2570 .pagehd{display:inline-block;width:max-content;align-self:flex-start;margin-bottom:6px;padding:2px 10px;border-radius:999px;font-size:12px;letter-spacing:.04em;color:#071a36;background:var(--gold)}
.ts2570 .nextcue{display:flex;flex-direction:column;align-items:center;gap:4px;margin:26px auto 0;padding:10px 18px;min-height:48px;border:0;background:none;color:var(--mist);font:inherit;font-size:14px;cursor:pointer}
.ts2570 .nextcue i{width:14px;height:14px;border-right:2px solid var(--lime);border-bottom:2px solid var(--lime);transform:rotate(45deg);animation:ts-cueDown 1.6s ease-in-out infinite}
@keyframes ts-cueDown{0%,100%{transform:translateY(-3px) rotate(45deg);opacity:.6}50%{transform:translateY(4px) rotate(45deg);opacity:1}}
.ts2570 #moSec{min-height:82svh;display:flex;flex-direction:column;justify-content:center}
.ts2570 .mnav{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:4px}
.ts2570 .mnav button{width:48px;height:48px;border-radius:50%;border:1px solid rgba(235,191,48,.5);background:rgba(7,26,54,.7);color:var(--gold);font-size:22px;line-height:1;cursor:pointer}
.ts2570 .mnav button:disabled{opacity:.3;cursor:default}
.ts2570 .mnav button:focus-visible,.ts2570 .ads .go:focus-visible,.ts2570 .nextcue:focus-visible{outline:3px solid var(--lime);outline-offset:2px}
.ts2570 .mnav span{font-size:13px;color:var(--mist)}
.ts2570 .ads{display:grid;gap:14px}
.ts2570 .ads h2{margin:0 0 4px}
.ts2570 .ads .ad{display:grid;grid-template-columns:72px 1fr;gap:14px;align-items:center;padding:16px;border-radius:20px;background:linear-gradient(160deg,rgba(255,255,255,.1),rgba(255,255,255,.04));border:1px solid rgba(235,191,48,.35)}
.ts2570 .ads .ad .ic{width:72px;height:72px;border-radius:18px;display:grid;place-items:center;background:#fff7e6;overflow:hidden}
.ts2570 .ads .ad .ic img{width:100%;height:100%;object-fit:cover;object-position:50% 20%}
.ts2570 .ads .ad .book{width:56px;height:70px;border-radius:4px 8px 8px 4px;background:linear-gradient(90deg,#e9dcc3 0 10%,#fffaf0 10%);box-shadow:2px 3px 0 #c9b48a,0 6px 14px rgba(0,0,0,.35);display:grid;place-items:center;font-family:var(--display);font-size:11px;line-height:1.2;color:#7a5a12;text-align:center;padding:4px}
.ts2570 .ads .ad b{display:block;font-size:17px;line-height:1.35}
.ts2570 .ads .ad p{margin:4px 0 0;font-size:14px;line-height:1.5;color:var(--mist)}
.ts2570 .ads .ad ul{margin:6px 0 0;padding-left:1.1em;font-size:13px;line-height:1.55;color:var(--mist)}
.ts2570 .ads .ad .price{display:inline-block;margin-top:6px;padding:2px 10px;border-radius:999px;font-size:13px;font-weight:600;background:rgba(225,255,0,.14);color:var(--lime)}
.ts2570 .ads .ad .go{grid-column:1 / -1;display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:999px;border:0;font:inherit;font-weight:700;font-size:16px;background:var(--lime);color:#071a36;text-decoration:none;cursor:pointer}
.ts2570 .ads .ad .go.alt{background:var(--gold)}
.ts2570 .foot{font-size:12px;opacity:.75}
/* the 100 QI celebration (revision 0.12): a bottom sheet with เสี่ยวมู่ above it */
.ts2570 .cel{position:fixed;inset:0;z-index:80;pointer-events:none}
.ts2570 .cel .celScrim{position:absolute;inset:0;background:rgba(4,14,32,.72);backdrop-filter:blur(3px);opacity:0;transition:opacity .3s;pointer-events:auto}
.ts2570 .cel.on .celScrim{opacity:1}
.ts2570 .cel .celFx{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.ts2570 .cel .celCf{position:absolute;top:-24px;width:9px;height:14px;border-radius:2px;animation:ts-celFall var(--d) cubic-bezier(.25,.6,.45,1) var(--dl) both}
@keyframes ts-celFall{0%{transform:translate(0,0) rotate(0);opacity:1}80%{opacity:1}100%{transform:translate(var(--dx),calc(100svh + 40px)) rotate(var(--r));opacity:.2}}
.ts2570 .cel .celCoin{position:absolute;left:var(--x);top:var(--y);width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;display:grid;place-items:center;font:700 12px/1 var(--text);color:#7a4d00;background:radial-gradient(circle at 35% 30%,#fff3b0,#f5c534 45%,#c98a10);box-shadow:0 0 0 2px #fbe08a inset,0 4px 10px rgba(0,0,0,.35);animation:ts-celCoin 1.25s cubic-bezier(.2,.7,.3,1) var(--dl) both}
@keyframes ts-celCoin{0%{transform:translate(0,0) scale(.3);opacity:0}12%{opacity:1}55%{transform:translate(var(--dx),var(--dy)) scale(1) rotate(var(--r))}100%{transform:translate(calc(var(--dx)*1.1),calc(var(--dy) + 260px)) scale(.8) rotate(calc(var(--r)*2));opacity:0}}
.ts2570 .cel .celCard{box-sizing:border-box;position:absolute;left:0;right:0;bottom:0;pointer-events:auto;padding:30px max(20px,env(safe-area-inset-left,0px)) calc(20px + env(safe-area-inset-bottom,0px));border-radius:28px 28px 0 0;background:linear-gradient(170deg,#123d73,#0b2a52 60%,#081f3f);color:#fff7e6;border:1px solid rgba(235,191,48,.55);box-shadow:0 -12px 50px rgba(0,0,0,.5);text-align:center;display:grid;justify-items:center;gap:6px;transform:translateY(105%);transition:transform .6s cubic-bezier(.2,1.15,.35,1)}
.ts2570 .cel.on .celCard{transform:none}
.ts2570 .cel .celCard:focus{outline:none}
.ts2570 .cel .celCard::before{content:"";position:absolute;top:10px;left:50%;width:44px;height:5px;margin-left:-22px;border-radius:3px;background:rgba(201,214,242,.4)}
.ts2570 .cel .celCard>*{max-width:440px;width:100%}
.ts2570 .cel .celMu{position:absolute;top:-52px;left:50%;margin-left:-46px;width:92px!important;height:92px;border-radius:50%;background:#fff7e6;overflow:hidden;box-shadow:0 0 0 4px #ebbf30,0 0 40px rgba(235,191,48,.6)}
.ts2570 .cel .celMu img{width:100%;height:100%;object-fit:cover;object-position:50% 18%}
.ts2570 .cel .celT{margin-top:40px;font-family:var(--display);font-size:22px;line-height:1.35;color:var(--lime)}
.ts2570 .cel .celK{margin-top:36px;font-size:14px;color:var(--mist)}
.ts2570 .cel .celBig{font-family:var(--display);font-size:64px;line-height:1.05;color:var(--lime);text-shadow:0 0 24px rgba(225,255,0,.45);font-variant-numeric:tabular-nums}
.ts2570 .cel .celBig small{font-size:28px;margin-left:6px;color:var(--gold)}
.ts2570 .cel .celPop{animation:ts-celPop .35s cubic-bezier(.2,1.6,.4,1)}
@keyframes ts-celPop{50%{transform:scale(1.18)}}
.ts2570 .cel .celUse{margin:2px 0 10px;font-size:14px;line-height:1.5;color:var(--mist);max-width:30ch}
.ts2570 .cel .celActs{display:grid;gap:10px}
.ts2570 .cel .celActs button{min-height:50px;border-radius:999px;border:0;font:inherit;font-weight:700;font-size:16px;cursor:pointer}
.ts2570 .cel .celActs .celP{background:#06C755;color:#fff;box-shadow:0 8px 20px rgba(6,199,85,.35)}
.ts2570 .cel .celActs .celS{background:rgba(255,255,255,.08);color:#fff7e6;border:1px solid rgba(255,247,230,.35)}
.ts2570 .cel .celDeep{display:inline-flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px;min-height:44px;margin-top:4px;color:var(--mist);font-size:14px;text-decoration:none}
.ts2570 .cel .celDeep b{color:var(--gold);text-decoration:underline;text-underline-offset:3px}
.ts2570 .cel .celX{position:absolute;top:8px;right:8px;width:44px!important;height:44px;border-radius:50%;border:0;background:none;color:var(--mist);font-size:24px;cursor:pointer}
.ts2570 .cel button:focus-visible,.ts2570 .cel a:focus-visible{outline:3px solid var(--lime);outline-offset:2px}
.ts2570 .cel .celLate{opacity:0;transform:translateY(8px);transition:opacity .35s .75s,transform .35s .75s}
.ts2570 .cel.on .celLate{opacity:1;transform:none}
/* "อยากรู้ลึกกว่านี้" at the end of the year page, and the packages link on the เสี่ยวมู่ card */
.ts2570 .deepStrip{display:grid;grid-template-columns:56px 1fr;gap:12px;align-items:center;box-sizing:border-box;width:100%;margin:22px 0 0;padding:14px;border-radius:18px;background:linear-gradient(160deg,rgba(235,191,48,.16),rgba(255,255,255,.04));border:1px solid rgba(235,191,48,.45);color:#fff7e6;text-decoration:none}
.ts2570 .deepStrip .ic{width:56px;height:56px;border-radius:50%;overflow:hidden;background:#fff7e6;box-shadow:0 0 0 3px #ebbf30}
.ts2570 .deepStrip .ic img{width:100%;height:100%;object-fit:cover;object-position:50% 18%}
.ts2570 .deepStrip b{display:block;font-size:16px}
.ts2570 .deepStrip span{display:block;margin-top:2px;font-size:13px;color:var(--mist)}
.ts2570 .deepStrip em{font-style:normal;white-space:nowrap;color:var(--lime);font-weight:700}
.ts2570 .ads .ad .pkLink{grid-column:1 / -1;justify-self:end;display:inline-flex;align-items:center;min-height:44px;color:var(--mist);font-size:13px;text-decoration:underline;text-underline-offset:3px}
.ts2570 .deepStrip:focus-visible,.ts2570 .ads .ad .pkLink:focus-visible{outline:3px solid var(--lime);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.ts2570 .nextcue i{animation:none}.ts2570 .cel .celCard,.ts2570 .cel .celScrim,.ts2570 .cel .celLate{transition:none}.ts2570 .cel .celFx{display:none}}
`
