import { chromium } from 'playwright'
const BASE='http://localhost:3210'
const ENTRIES=[{rank:1,slot:0,person:{slot:0,friendId:'f-0',name:'กัสสรนาดี',surname:'',pictureUrl:'',timeKnown:true},rankScore:95,grade:'A',ratingText:'เข้ากันได้ดีมาก',roles:[{perspective:'ตัวเรา → เจ้านาย',stageName:'เจ๊าะ',narrative:'ก '.repeat(40)},{perspective:'ลูกน้อง → ตัวเรา',stageName:'เจ๊าะ',narrative:'ข '.repeat(40)},{perspective:'หุ้นส่วน/เพื่อนร่วมงาน',stageName:'เจ๊าะ',narrative:'ค '.repeat(40)}],rolesComplete:true,rolesMissing:0,rankFromEngine:true}]
const b=await chromium.launch()
const ctx=await b.newContext({viewport:{width:393,height:850},deviceScaleFactor:2})
await ctx.addCookies([{name:'v2_access',value:'local-testenv',url:BASE},{name:'cookie-mumate-id',value:'b54b765a-c01b-471f-bf7c-0c2a1a448bdd',url:BASE}])
await ctx.route('**/api/v2/matching/work/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,matching_id:'m-1',create_at:'x',entries:ENTRIES})}))
const p=await ctx.newPage()
await p.goto(BASE+'/v2/service/compatibility/work/m-1',{waitUntil:'domcontentloaded',timeout:90000})
await p.waitForSelector('[data-testid="work-roles"]',{timeout:30000})
await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight))
await p.waitForTimeout(500)
const m=await p.evaluate(()=>{
  const bar=document.querySelector('nav[class*="fixed"], footer, [class*="fixed bottom"]')
  const bars=Array.from(document.querySelectorAll('*')).filter(e=>getComputedStyle(e).position==='fixed'&&e.getBoundingClientRect().height>40)
  const last=document.querySelector('[data-testid="work-roles"] section:last-child')
  const lr=last?.getBoundingClientRect()
  return {
    fixedCount:bars.length,
    fixedBoxes:bars.map(e=>({tag:e.tagName,cls:(e.className||'').toString().slice(0,40),top:Math.round(e.getBoundingClientRect().top),bottom:Math.round(e.getBoundingClientRect().bottom)})),
    viewportH:window.innerHeight,
    lastSectionBottom:lr?Math.round(lr.bottom):null,
    // is the last text hidden UNDER the bar at the real scroll bottom?
    coveredByBar: bars.some(e=>{const b=e.getBoundingClientRect();return lr&&lr.bottom>b.top&&lr.top<b.bottom})
  }})
console.log(JSON.stringify(m,null,1))
await p.screenshot({path:'/tmp/eye-585/viewport-bottom-393.png',fullPage:false})
await b.close()
