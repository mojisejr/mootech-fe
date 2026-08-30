// #541 ③ tail — drive the REAL button on /v2/service/compatibility/love and read the message the USER sees.
import { chromium } from 'playwright'
const BASE='http://localhost:3210', SESSION=process.env.SESSION, MEMBER=process.env.MEMBER_UID, TAG=process.env.TAG
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:393,height:900},deviceScaleFactor:2})
await ctx.addCookies([
  {name:'v2_access',value:'local-testenv',url:BASE},
  {name:'next-auth.session-token',value:SESSION,url:BASE},
  {name:'cookie-mumate-id',value:MEMBER,url:BASE},
])
const p=await ctx.newPage()
let calcRes=null
p.on('response', async r=>{ if(/matching\/calculate/.test(r.url())){ let t=''; try{t=(await r.text()).slice(0,160)}catch(e){}; calcRes={status:r.status(),body:t} }})
await p.goto(BASE+'/v2/service/compatibility/love',{waitUntil:'networkidle',timeout:45000})
await p.waitForTimeout(1200)
// pick person 2
await p.click('[data-testid="compat-person2-empty"]', {timeout:15000})
await p.waitForSelector('[data-testid="compat-select-modal"]',{timeout:15000})
await p.waitForTimeout(800)
// choose the first friend row inside the modal
const row = p.locator('[data-testid="compat-select-modal"] button, [data-testid="compat-select-modal"] li').filter({hasText:'Parity B'}).first()
await row.click({timeout:15000})
await p.waitForTimeout(1200)
await p.screenshot({path:`/tmp/eye-541/${TAG}-1-ready.png`,fullPage:true})
// press the real button
await p.click('[data-testid="compat-view-result"]',{timeout:15000})
await p.waitForTimeout(4500)
const err = await p.locator('[data-testid="compat-result-error"]').innerText().catch(()=>'(no compat-result-error node)')
const text=(await p.evaluate(()=>document.body.innerText)).replace(/\s+/g,' ').trim()
await p.screenshot({path:`/tmp/eye-541/${TAG}-2-after-press.png`,fullPage:true})
console.log(JSON.stringify({arm:TAG,api:calcRes,url:p.url().replace(BASE,''),errorNode:err.replace(/\s+/g,' '),screen:text.slice(0,300)}))
await b.close()
