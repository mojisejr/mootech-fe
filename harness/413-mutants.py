# harness/384-mutants.py — #384 mutant contract, committed so the "does the tooth bite?" claim is rerunnable.
#   python3 harness/384-mutants.py     (from the repo root; needs node_modules)
# Each mutant must turn the spec RED. It asserts the mutant LANDED (md5 changed) before trusting the run,
# and asserts the restore landed after — `git diff` cannot see an untracked file and answers "unchanged"
# for one that was overwritten three times (2026-08-22).
import subprocess, hashlib, os, sys, json, tempfile, shutil
# 🔴 The repo under test is THIS script's repo — resolved from __file__, never burned in (ตู๋ T4, #386).
# It used to hold an absolute path to one oracle's worktree, so a reviewer who ran it from their own copy
# would have mutated SOMEBODY ELSE'S tree instead of their own, silently. Same family as the GIT_DIR leak
# in #337: a tool that audits a tree must audit the tree it was told to, not one baked into it.
R=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 🔴 backups go to a TEMP dir, never beside this script: once this file moved into harness/ the old
# `dirname(__file__)/mutbak` wrote restore-copies INTO the repo being mutated — a tool that leaves debris in
# the tree it is auditing can make its own next run read a dirty tree.
BK=tempfile.mkdtemp(prefix='mut384-')
def md5(p): return hashlib.md5(open(p,'rb').read()).hexdigest()

MUT=[
 ("MU1 the gender label says ของคุณ again", 'components/modal-add-freind.tsx',
  ">เพศดั้งเดิมของเพื่อน</span>", ">เพศดั้งเดิมของคุณ</span>"),
 ("MU2 blanket-purge ของคุณ/คุณ, breaking the CORRECT privacy line", 'components/modal-add-freind.tsx',
  "ข้อมูลที่คุณให้มา เราใช้แค่คำนวณดวงเท่านั้น", "ข้อมูลที่เพื่อนให้มา เราใช้แค่คำนวณดวงเท่านั้น"),
]

def failed_tests():
    r=subprocess.run(['npx','vitest','run','scripts/v1-add-friend-copy.test.tsx','--reporter=json'],
                     cwd=R,capture_output=True,text=True)
    out=r.stdout
    i=out.find('{')
    if i<0: return None
    try: j=json.loads(out[i:])
    except Exception: return None
    names=[]
    for f in j.get('testResults',[]):
        for a in f.get('assertionResults',[]):
            if a.get('status')=='failed': names.append(a.get('title'))
    return names

rows=[]
for name,rel,a,b in MUT:
    p=os.path.join(R,rel); bak=os.path.join(BK,rel.replace('/','__'))
    src=open(p).read(); open(bak,'w').write(src); h0=md5(p)
    if a not in src:
        rows.append((name,'❌ ANCHOR NOT FOUND — mutant never landed',[])); continue
    open(p,'w').write(src.replace(a,b,1))
    assert md5(p)!=h0, f"{name}: file unchanged after write — mutant did NOT land"
    f=failed_tests()
    open(p,'w').write(open(bak).read())
    assert md5(p)==h0, f"{name}: RESTORE FAILED"
    rows.append((name, ('RED  '+str(len(f))+' test(s)') if f else '🔴 GREEN — TOOTH DOES NOT BITE', f or []))

print()
for name,v,f in rows:
    print(f"{name:<44} {v}")
    for t in f: print(f"      ↳ {t}")
print()
# every mutant must be caught, and MU1..MU5,MU7 must not all hit the same single test
shutil.rmtree(BK, ignore_errors=True)
print("restore check: all files match their pre-mutant md5 \u2713 \u00b7 temp backups removed")

# 🔴 EXIT NON-ZERO WHEN A TOOTH DOES NOT BITE (ตู๋ T5, #386). The closing lines of this file used to state the
# contract as a COMMENT while the process exited 0 no matter what it printed — so anyone wiring it into a
# gate would have got a gate that is green by construction. A checker that cannot fail is not a checker.
# 🔴 TWO DIFFERENT FAILURES, AND CONFLATING THEM SENDS SOMEONE TO REWRITE A PERFECTLY GOOD TEST.
#   stale  = the anchor string no longer exists, so the mutant NEVER LANDED. This says nothing at all about
#            the tooth; it says this runner is out of date with the code it audits.
#   survived = the mutant landed and the suite stayed green. THAT is a tooth that does not bite.
# The first version of this summary printed "TOOTH DOES NOT BITE" for both (caught 2026-08-23, after a
# rename turned `now()` into `nowRef.current()` and MU19's anchor went stale).
stale=[n for n,v,_ in rows if 'ANCHOR NOT FOUND' in v]
survived=[n for n,v,_ in rows if 'RED' not in v and 'ANCHOR NOT FOUND' not in v]
hits=[tuple(sorted(f)) for _,v,f in rows if 'RED' in v]
piled = len(rows)>1 and len(set(hits))==1
if stale:
    print('\n\U0001f7e0 STALE ANCHORS (the mutant never landed \u2014 this runner is behind the code, the teeth are unjudged):')
    for n in stale: print('   \u00b7', n)
if survived:
    print('\n\U0001f534 MUTANTS THAT SURVIVED (landed, and nothing went red \u2014 the tooth does not bite):')
    for n in survived: print('   \u00b7', n)
if piled:
    print('\n\U0001f534 every mutant reddened the SAME test(s) — one assertion is carrying all of them')
sys.exit(1 if (survived or stale or piled) else 0)
