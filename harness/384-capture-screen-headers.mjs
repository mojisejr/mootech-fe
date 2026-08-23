import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join as pjoin } from 'node:path'
import { evidenceDir } from './evidence-dir.mjs'
// ตู๋ T4 (#386): every path below is derived from THIS FILE's location, so the script audits the repo it
// ships in — not the one whose absolute path happened to be in the author's shell when it was written.
const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
// #417 — the output root is a value now, not a string spelled out here. See harness/evidence-dir.mjs.
const OUT = evidenceDir()
const KEY=execSync(`grep '^V2_PREVIEW_KEY=' " + pjoin(REPO, '.env.local') + " | cut -d= -f2- | tr -d '"'`).toString().trim()

const SCREENS=[
 {k:'service',       path:'/v2/service',                    tid:'service-header'},
 {k:'calendar',      path:'/v2/calendar',                   tid:'app-header'},
 {k:'day',           path:'/v2/calendar/2026-08-22',        tid:'day-header'},
 {k:'shop',          path:'/v2/shop',                       tid:'shop-header'},
 {k:'notifications', path:'/v2/calendar/notifications',     tid:'notifications-header'},
]
const VPS=[320,393,1280]
const b=await chromium.launch()
async function shot(port,path,tid,file,w,q=''){
  const ctx=await b.newContext({viewport:{width:w,height:900},deviceScaleFactor:2})
  await ctx.addCookies([{name:'v2_access',value:KEY,domain:'localhost',path:'/'}])
  const p=await ctx.newPage()
  await p.goto(`http://localhost:${port}${path}${q}`,{waitUntil:'networkidle'})
  const el=await p.waitForSelector(`[data-testid="${tid}"]`,{timeout:15000}).catch(()=>null)
  if(!el){await ctx.close();return null}
  await p.evaluate(()=>document.fonts.ready)
  await el.screenshot({path:file})
  const badge=await p.evaluate(()=>({
    upgrade:document.querySelector('[data-testid="header-upgrade"]')?.textContent??null,
    tier:document.querySelector('[data-testid="header-tier"]')?.textContent??null}))
  await ctx.close(); return badge
}
const diff=(A,B,o)=>{const a=PNG.sync.read(readFileSync(A)),c=PNG.sync.read(readFileSync(B))
  if(a.width!==c.width||a.height!==c.height)return `SIZE ${a.width}x${a.height} vs ${c.width}x${c.height}`
  const out=new PNG({width:a.width,height:a.height})
  const n=pixelmatch(a.data,c.data,out.data,a.width,a.height,{threshold:0.1})
  writeFileSync(o,PNG.sync.write(out)); return n}

const res=[]
for(const s of SCREENS){
  for(const w of VPS){
    const A=`${OUT}/384-before-${s.k}-free-${w}.png`, B=`${OUT}/384-${s.k}-free-${w}.png`
    const ba=await shot(3385,s.path,s.tid,A,w)
    const bb=await shot(3384,s.path,s.tid,B,w)
    if(!ba||!bb){res.push({screen:s.k,w,diff:'SCREEN DID NOT RENDER'});continue}
    res.push({screen:s.k,w,before:ba.upgrade??ba.tier??'—',after:bb.upgrade??bb.tier??'—',
              diff:diff(A,B,`${OUT}/384-diff-${s.k}-free-${w}.png`)})
  }
  // member state on the AFTER build only (the badge is what this PR adds)
  const m=await shot(3384,s.path,s.tid,`${OUT}/384-${s.k}-member-393.png`,393,'?tier=paid')
  res.push({screen:s.k,w:393,member:m?(m.tier??m.upgrade??'—'):'n/a'})
}
console.log(JSON.stringify(res,null,0).replace(/\},\{/g,'}\n{'))
await b.close()
