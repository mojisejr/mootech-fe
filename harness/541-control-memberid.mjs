// POSITIVE CONTROL for #541 ③: the ONLY difference between the two arms is the MEMBER_ID cookie.
// Everything else (session, v2_access, DB rows, server) is identical.
import { chromium } from 'playwright'
const BASE='http://localhost:3210', SESSION=process.env.SESSION, UID=process.env.MEMBER_UID
const b = await chromium.launch()
for (const [tag, withMember] of [['B1-no-memberid', false], ['B2-with-memberid', true]]) {
  const ctx = await b.newContext({ viewport:{width:393,height:900}, deviceScaleFactor:2 })
  const cookies = [
    { name:'v2_access', value:'local-testenv', url:BASE },
    { name:'next-auth.session-token', value:SESSION, url:BASE },
  ]
  if (withMember) cookies.push({ name:'cookie-mumate-id', value:UID, url:BASE })
  await ctx.addCookies(cookies)
  const p = await ctx.newPage()
  let listCall = null
  p.on('response', async r => { if (/\/api\/v2\/matching($|\?)/.test(r.url())) {
    let t=''; try{ t=(await r.text()).slice(0,120) }catch(e){}
    listCall = { status:r.status(), sample:t }
  }})
  await p.goto(BASE+'/v2/service/compatibility/recent', { waitUntil:'networkidle', timeout:45000 })
  await p.waitForTimeout(2000)
  const text = (await p.evaluate(()=>document.body.innerText)).replace(/\s+/g,' ').trim()
  await p.screenshot({ path:`/tmp/eye-541/${tag}-recent.png`, fullPage:true })
  console.log(JSON.stringify({ arm:tag, memberIdCookie:withMember, apiCallMade: !!listCall, api:listCall, screenText:text.slice(0,260) }))
  await ctx.close()
}
await b.close()
