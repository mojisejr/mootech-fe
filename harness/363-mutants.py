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
 ("MU1 compute the saved amount instead of printing it", 'features/v2-shop/components/DiscountCodeField.tsx',
  "<span data-testid=\"discount-saved\" className=\"text-sm font-bold text-v3-success-text\">−{savedText}</span>",
  "<span data-testid=\"discount-saved\" className=\"text-sm font-bold text-v3-success-text\">{'-' + String(Number(String(savedText).replace(/[^0-9.]/g,'')))}</span>"),
 ("MU2 chip and helper stop agreeing", 'features/v2-shop/components/DiscountCodeField.tsx',
  "<span className=\"text-v3-success-text\">ใช้โค้ดสำเร็จ! ประหยัด {savedText}</span>",
  "<span className=\"text-v3-success-text\">ใช้โค้ดสำเร็จ!</span>"),
 ("MU3 ignore the server's reason, always show the fallback", 'features/v2-shop/components/DiscountCodeField.tsx',
  "{errorText || DISCOUNT_ERROR_FALLBACK}", "{DISCOUNT_ERROR_FALLBACK}"),
 ("MU4 let ใช้ fire on an empty code", 'features/v2-shop/components/DiscountCodeField.tsx',
  "disabled={busy || value.trim() === ''}", "disabled={busy}"),
 ("MU5 keep the input row in the success state", 'features/v2-shop/components/DiscountCodeField.tsx',
  "{!isSuccess && (", "{true && ("),
 ("MU6 drop role=alert from the error helper", 'features/v2-shop/components/DiscountCodeField.tsx',
  "role={isError ? 'alert' : 'status'}", "role={'status'}"),
]

def failed_tests():
    r=subprocess.run(['npx','vitest','run','scripts/discount-code-field.test.tsx','--reporter=json'],
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
survived=[n for n,v,_ in rows if 'RED' not in v]
hits=[tuple(sorted(f)) for _,v,f in rows if 'RED' in v]
piled = len(rows)>1 and len(set(hits))==1
if survived:
    print('\n\U0001f534 MUTANTS THAT SURVIVED (the tooth does not bite):', ', '.join(survived))
if piled:
    print('\n\U0001f534 every mutant reddened the SAME test(s) — one assertion is carrying all of them')
sys.exit(1 if (survived or piled) else 0)
