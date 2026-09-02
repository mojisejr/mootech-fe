import { chromium } from 'playwright'
const BASE='http://localhost:3210'
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:393,height:850}})
await ctx.addCookies([{name:'v2_access',value:'local-testenv',url:BASE},{name:'cookie-mumate-id',value:'b54b765a-c01b-471f-bf7c-0c2a1a448bdd',url:BASE}])
const calls=[]
await ctx.route('**/api/member-with-friend/detail**',route=>{calls.push('detail');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'f-1',name:'กัสสรนาดี',surname:'',picture_url:'',dob:'1990-06-15',time:'19:15',gender:'FEMALE'})})})
await ctx.route('**/api/member-with-friend**',route=>{calls.push('list');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'f-1',name:'กัสสรนาดี',surname:'',picture_url:'',dob:'1990-06-15',time:'19:15',gender:'FEMALE'}])})})
const p=await ctx.newPage()
p.on('request',r=>{const u=r.url();if(u.includes('/api/'))calls.push(r.method()+' '+u.replace('http://localhost:3210',''))})
await p.goto(BASE+'/v2/service/compatibility/colleague',{waitUntil:'domcontentloaded',timeout:90000})
await p.waitForSelector('[data-testid="compat-candidate-0"]',{timeout:30000})
await p.click('[data-testid="compat-candidate-0"]')
await p.waitForSelector('[data-testid^="compat-friend-f-"]',{timeout:15000})
await p.click('[data-testid^="compat-friend-f-"]')
await p.waitForTimeout(2500)
console.log('API:',calls.filter(c=>c.includes('/api/')))
console.log(await p.evaluate(()=>({
  disabled:document.querySelector('[data-testid="compat-view-result"]')?.disabled,
  label:document.querySelector('[data-testid="compat-view-result"]')?.textContent?.trim(),
  slot0:document.querySelector('[data-testid="compat-candidate-0"]')?.textContent?.replace(/\s+/g,' ').slice(0,60),
  person1:document.querySelector('[data-testid="compat-person1"]')?.textContent?.replace(/\s+/g,' ').slice(0,60),
})))
await b.close()
