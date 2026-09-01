import { chromium } from 'playwright'
const BASE='http://localhost:3210'
const b=await chromium.launch()
for (const W of [320,360,393]){
  const ctx=await b.newContext({viewport:{width:W,height:820},deviceScaleFactor:2})
  await ctx.addCookies([{name:'v2_access',value:'local-testenv',url:BASE},{name:'cookie-mumate-id',value:'b54b765a-c01b-471f-bf7c-0c2a1a448bdd',url:BASE}])
  const p=await ctx.newPage()
  await p.goto(BASE+'/v2/service/compatibility/colleague',{waitUntil:'domcontentloaded',timeout:60000}).catch(()=>null)
  await p.waitForTimeout(2200)
  // truncation is measured, not eyeballed: scrollWidth > clientWidth means the label did not fit
  const chips=await p.$$eval('[data-testid^="compat-role-"][role="radio"]',els=>els.map(e=>({
    role:e.dataset.testid.replace('compat-role-',''), text:e.textContent,
    clipped: e.scrollWidth > e.clientWidth, w:e.clientWidth, need:e.scrollWidth })))
  await p.screenshot({path:`/tmp/eye-569/roles-${W}.png`,fullPage:false})
  console.log(W, JSON.stringify(chips))
  await ctx.close()
}
await b.close()
