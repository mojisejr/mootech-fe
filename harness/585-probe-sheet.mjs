import { chromium } from 'playwright'
const BASE='http://localhost:3210'
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:393,height:850}})
await ctx.addCookies([{name:'v2_access',value:'local-testenv',url:BASE},{name:'cookie-mumate-id',value:'b54b765a-c01b-471f-bf7c-0c2a1a448bdd',url:BASE}])
const p=await ctx.newPage()
await p.goto(BASE+'/v2/service/compatibility/colleague',{waitUntil:'domcontentloaded',timeout:90000})
await p.waitForSelector('[data-testid="compat-candidate-0"]',{timeout:30000})
const calls=[]
p.on('request',r=>{ if(r.url().includes('/api/')) calls.push(r.method()+' '+r.url().replace('http://localhost:3210','')) })
await ctx.route('**/api/member-with-friend**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'f-1',name:'กัสสรนาดี',surname:'',picture_url:'',dob:'1990-06-15',time:'19:15',gender:'FEMALE'}])}))
await p.click('[data-testid="compat-candidate-0"]')
await p.waitForTimeout(1500)
console.log('API ที่จอยิง:',calls)
console.log('ปุ่ม disabled =', await p.locator('[data-testid="compat-view-result"]').isDisabled())
console.log('แถวคนที่ 1 บนจอ =', await p.locator('[data-testid="compat-person1"]').count())
console.log(await p.evaluate(()=>{
  const sheet=document.querySelector('.fixed.inset-0.z-50')
  if(!sheet) return {sheet:false}
  return {
    sheet:true,
    testids:[...new Set(Array.from(sheet.querySelectorAll('[data-testid]')).map(e=>e.dataset.testid))].slice(0,25),
    buttons:Array.from(sheet.querySelectorAll('button')).slice(0,12).map(e=>({t:(e.textContent||'').trim().slice(0,24),id:e.dataset.testid||''})),
    text:(sheet.textContent||'').replace(/\s+/g,' ').slice(0,220),
  }}))
await b.close()
