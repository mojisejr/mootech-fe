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
 ("MU1 null → upgrade pill", 'features/v2-shell/header-badge.ts',
  "if (isPaid === null || isPaid === undefined) return NONE",
  "if (isPaid === null || isPaid === undefined) return { kind: 'upgrade' }"),
 ("MU2 null → tier pill", 'features/v2-shell/header-badge.ts',
  "if (isPaid === null || isPaid === undefined) return NONE",
  "if (isPaid === null || isPaid === undefined) return { kind: 'tier', label: MEMBER_BADGE_LABEL }"),
 # MU3 was COMPOUND (ตู๋ #386): it removed the 'FREE' branch AND changed the label in one edit, so it
 # reddened 3 tests without telling which change did which — and MU4 already isolates the branch. Replaced
 # with a single-change mutant for a DIFFERENT regression: the member who paid but has no level name gets no
 # badge at all, i.e. exactly the "my status disappeared" symptom this whole ticket exists to remove.
 ("MU3 paid+noname → no badge at all (the original symptom, restored)", 'features/v2-shell/header-badge.ts',
  "if (tier === null || tier === 'FREE') return { kind: 'tier', label: MEMBER_BADGE_LABEL }",
  "if (tier === null || tier === 'FREE') return NONE"),
 ("MU4 print FREE on paid", 'features/v2-shell/header-badge.ts',
  "if (tier === null || tier === 'FREE') return { kind: 'tier', label: MEMBER_BADGE_LABEL }",
  "if (tier === null) return { kind: 'tier', label: MEMBER_BADGE_LABEL }"),
 ("MU5 ignore upgradeCta=false", 'features/v2-shell/header-badge.ts',
  "if (isPaid === false) return upgradeCta ? { kind: 'upgrade' } : NONE",
  "if (isPaid === false) return { kind: 'upgrade' }"),
 ("MU6 drop wire on ONE screen (notifications)", 'pages/v2/calendar/notifications.tsx',
  'membership={tier} upgradeCta={false}', 'upgradeCta={false}'),
 ("MU8 home stops reading the seam (the line #384 rebased onto #383)", 'pages/v2/index.tsx',
  'membership={profile}', ''),
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
