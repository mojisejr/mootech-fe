# Isolated image proof only; fixed loopback fixture ports, no customer endpoints.
import concurrent.futures,json,time,urllib.request,urllib.error
base='http://127.0.0.1:55340'
def probe():
 t=time.monotonic()
 try:
  with urllib.request.urlopen(base+'/api/health',timeout=8) as r: code=r.status; body=json.load(r)
 except urllib.error.HTTPError as e: code=e.code; body=json.load(e)
 return {'code':code,'db':body.get('db'),'db_ms':body.get('dbLatencyMs'),'sha':body.get('sha'),'uptime':body.get('uptimeSec'),'seconds':round(time.monotonic()-t,3)}
def batch():
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: return list(pool.map(lambda _:probe(),range(8)))
first=batch(); assert all(x['code']==200 for x in first),first
print(json.dumps({'warm':first}),flush=True)
for cycle in range(2):
 with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:55344/silence',method='POST'),timeout=3) as r: silenced=json.load(r)
 assert silenced['silenced']>0,silenced
 during=batch(); assert all(x['code'] in [200,503] and x['seconds']<7 for x in during),during
 after=[]
 for _ in range(4):
  item=probe();after.append(item);assert item['code']==200 and item['db']=='ok',item;time.sleep(1)
 print(json.dumps({'cycle':cycle+1,'silenced':silenced,'during':during,'after':after}),flush=True)
print('image_recovery_proof=passed',flush=True)
