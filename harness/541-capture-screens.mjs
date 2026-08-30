import { chromium } from 'playwright'
const BASE='http://localhost:3210', SESSION=process.env.SESSION, MID=process.env.MID, MEMBER=process.env.MEMBER_UID
const SCREENS=[['love','/v2/service/compatibility/love'],['recent','/v2/service/compatibility/recent'],['result','/v2/service/compatibility/result/'+MID]]
const b=await chromium.launch()
for (const [tag, gated] of [['C-healthy', true], ['D-no-v2access', false]]) {
  for (const [name,path] of SCREENS) {
    const ctx=await b.newContext({viewport:{width:393,height:900},deviceScaleFactor:2})
    const c=[{name:'next-auth.session-token',value:SESSION,url:BASE},{name:'cookie-mumate-id',value:MEMBER,url:BASE}]
    if (gated) c.push({name:'v2_access',value:'local-testenv',url:BASE})
    await ctx.addCookies(c)
    const p=await ctx.newPage()
    const r=await p.goto(BASE+path,{waitUntil:'networkidle',timeout:45000}).catch(e=>null)
    await p.waitForTimeout(1500)
    const text=(await p.evaluate(()=>document.body.innerText)).replace(/\s+/g,' ').trim()
    await p.screenshot({path:`/tmp/eye-541/${tag}-${name}.png`,fullPage:true})
    console.log(JSON.stringify({arm:tag,screen:name,status:r?r.status():'ERR',finalUrl:p.url().replace(BASE,''),text:text.slice(0,200)}))
    await ctx.close()
  }
}
await b.close()
