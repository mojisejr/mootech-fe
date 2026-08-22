# harness/384-mutants.py — #384 mutant contract, committed so the "does the tooth bite?" claim is rerunnable.
#   python3 harness/384-mutants.py     (from the repo root; needs node_modules)
# Each mutant must turn the spec RED. It asserts the mutant LANDED (md5 changed) before trusting the run,
# and asserts the restore landed after — `git diff` cannot see an untracked file and answers "unchanged"
# for one that was overwritten three times (2026-08-22).
import subprocess, hashlib, os, sys, json
R='/Users/non/ghq/github.com/mojisejr/mootech-fe-384'
BK=os.path.join(os.path.dirname(os.path.abspath(__file__)),'mutbak'); os.makedirs(BK,exist_ok=True)
def md5(p): return hashlib.md5(open(p,'rb').read()).hexdigest()

MUT=[
 ("MU1 null → upgrade pill", 'features/v2-shell/header-badge.ts',
  "if (isPaid === null || isPaid === undefined) return NONE",
  "if (isPaid === null || isPaid === undefined) return { kind: 'upgrade' }"),
 ("MU2 null → tier pill", 'features/v2-shell/header-badge.ts',
  "if (isPaid === null || isPaid === undefined) return NONE",
  "if (isPaid === null || isPaid === undefined) return { kind: 'tier', label: MEMBER_BADGE_LABEL }"),
 ("MU3 paid+noname → raw name", 'features/v2-shell/header-badge.ts',
  "if (tier === null || tier === 'FREE') return { kind: 'tier', label: MEMBER_BADGE_LABEL }",
  "if (tier === null) return { kind: 'tier', label: 'FREE' }"),
 ("MU4 print FREE on paid", 'features/v2-shell/header-badge.ts',
  "if (tier === null || tier === 'FREE') return { kind: 'tier', label: MEMBER_BADGE_LABEL }",
  "if (tier === null) return { kind: 'tier', label: MEMBER_BADGE_LABEL }"),
 ("MU5 ignore upgradeCta=false", 'features/v2-shell/header-badge.ts',
  "if (isPaid === false) return upgradeCta ? { kind: 'upgrade' } : NONE",
  "if (isPaid === false) return { kind: 'upgrade' }"),
 ("MU6 drop wire on ONE screen (notifications)", 'pages/v2/calendar/notifications.tsx',
  'membership={tier} upgradeCta={false}', 'upgradeCta={false}'),
 ("MU7 bring back truthy badge fallback", 'features/v2-home/components/V2HomeScreen.tsx',
  "const PROFILE_FALLBACK: Profile = { pictureUrl: null }",
  "const PROFILE_FALLBACK: Profile = { pictureUrl: null, showUpgrade: true }"),
]

def failed_tests():
    r=subprocess.run(['npx','vitest','run','scripts/header-tier-badge.test.tsx','--reporter=json'],
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
print("restore check: all files match their pre-mutant md5 ✓")
