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
 ("MU7 pickCharge takes rows[0] (right almost every time)", 'features/v2-shop/useChargeStatus.ts',
  "return rows.find((r) => r.chargeId === chargeId) ?? null", "return rows[0] ?? null"),
 ("MU8 PENDING reads as success", 'features/v2-shop/useChargeStatus.ts',
  "return row.status === 'APPROVED' ? 'APPROVED' : 'PENDING'", "return 'APPROVED'"),
 ("MU9 a row we cannot see reads as success", 'features/v2-shop/useChargeStatus.ts',
  "if (!row) return 'UNKNOWN'", "if (!row) return 'APPROVED'"),
 ("MU10 someone adds .limit(20) to listUserPayments", 'lib/payment/repo.ts',
  ".orderBy(desc(v2Payment.createdAt))", ".orderBy(desc(v2Payment.createdAt))\n    .limit(20)"),
 ("MU11 total is computed instead of printed", 'features/v2-shop/components/OrderSummaryCard.tsx',
  "{formatSatang(quote.amountSatang)}", "{formatSatang(quote.listSatang - quote.discountSatang)}"),
 ("MU12 show VAT 0% row instead of hiding it", 'features/v2-shop/components/OrderSummaryCard.tsx',
  "const showVat = quote.vatPercent > 0", "const showVat = true"),
 ("MU13 chip only — drop the summary line for the code", 'features/v2-shop/components/OrderSummaryCard.tsx',
  "{hasCode && (\n          <Row\n            testId=\"summary-code-discount\"", "{false && (\n          <Row\n            testId=\"summary-code-discount\""),
 ("MU14 put วันนี้ back on the total label", 'features/v2-shop/components/OrderSummaryCard.tsx',
  ">ยอดชำระ</p>", ">ยอดชำระวันนี้</p>"),
 ("MU15 put ต่ออายุอัตโนมัติ back on the plan line", 'features/v2-shop/components/OrderSummaryCard.tsx',
  ">ใช้ได้ถึง {validUntilText}</p>", ">ต่ออายุอัตโนมัติ {validUntilText}</p>"),
 ("MU16 invent the annual-saving row", 'features/v2-shop/components/OrderSummaryCard.tsx',
  "{quote.annualSavingSatang !== undefined && quote.annualSavingSatang > 0 && (", "{true && ("),
 ("MU17 past the deadline, claim APPROVED", 'features/v2-shop/useChargeStatus.ts',
  "        setStale(true)\n        return", "        setStatus('APPROVED')\n        return"),
 ("MU18 a fetch error ends the wait", 'features/v2-shop/useChargeStatus.ts',
  "        if (stopped.current) return\n        setError(true)", "        if (stopped.current) return\n        setError(true)\n        return"),
 ("MU19 keep polling forever past the deadline", 'features/v2-shop/useChargeStatus.ts',
  "      if (!stopped.current && nowRef.current() - startedAt >= staleAfterMs) {", "      if (false) {"),
 ("MU20 render every method including the ones we cannot charge", 'features/v2-shop/components/PaymentMethodPicker.tsx',
  "const shown = METHODS.filter((m) => m.enabled)", "const shown = METHODS"),
 ("MU21 hide the two with CSS instead of not rendering", 'features/v2-shop/components/PaymentMethodPicker.tsx',
  "const shown = METHODS.filter((m) => m.enabled)", "const shown = METHODS.map((m) => m)"),
 ("MU22 stop announcing which method is selected", 'features/v2-shop/components/PaymentMethodPicker.tsx',
  "aria-checked={selected}", "aria-checked={false}"),
 ("MU23 claim success while still pending", 'features/v2-shop/components/QrScreen.tsx',
  "{error ? QR_COPY.offline : QR_COPY.waiting}", "{'ชำระเงินสำเร็จ'}"),
 ("MU24 a status error reads as the payment failing", 'features/v2-shop/components/QrScreen.tsx',
  "  offline: 'ตอนนี้เช็คสถานะไม่ได้ กำลังลองใหม่ให้อัตโนมัติ',", "  offline: 'ชำระเงินล้มเหลว',"),
 ("MU25 claim the QR is certainly expired", 'features/v2-shop/components/QrScreen.tsx',
  "  maybeExpired: 'QR นี้อาจหมดอายุแล้ว ถ้าคุณจ่ายไปแล้วให้กดตรวจสอบอีกครั้ง',", "  maybeExpired: 'QR หมดอายุแล้ว',"),
 ("MU26 settle on ANY approved row, not mine", 'features/v2-shop/useChargeStatus.ts',
  "  return rows.find((r) => r.chargeId === chargeId) ?? null", "  return rows.find((r) => r.status === 'APPROVED') ?? null"),
 ("MU27 a non-paid state claims the money moved", 'features/v2-shop/result-state.ts',
  "    title: 'ธนาคารปฏิเสธการชำระเงิน',\n    body: 'ยังไม่มีการตัดเงินจากบัตรใบนี้ ลองใช้บัตรใบอื่นหรือชำระด้วยพร้อมเพย์',\n    retry: 'different',\n    paid: false,",
  "    title: 'ธนาคารปฏิเสธการชำระเงิน',\n    body: 'ยังไม่มีการตัดเงินจากบัตรใบนี้ ลองใช้บัตรใบอื่นหรือชำระด้วยพร้อมเพย์',\n    retry: 'different',\n    paid: true,"),
 ("MU28 our network worded as their payment failing", 'features/v2-shop/result-state.ts',
  "    title: 'เช็คสถานะไม่ได้ตอนนี้',", "    title: 'ชำระเงินล้มเหลว',"),
 ("MU29 tell a declined card to try the same thing", 'features/v2-shop/result-state.ts',
  "    retry: 'different',\n    paid: false,\n  },\n  OFFLINE", "    retry: 'same',\n    paid: false,\n  },\n  OFFLINE"),
 ("MU30 fall back to a generic error sentence", 'features/v2-shop/result-state.ts',
  "    body: 'การเชื่อมต่อมีปัญหา ถ้าคุณจ่ายไปแล้วเงินไม่หาย กดตรวจสอบอีกครั้งได้เลย',", "    body: 'เกิดข้อผิดพลาด ลองใหม่อีกครั้งภายหลัง',"),
 ("MU31 the double-press state reads as a second success", 'features/v2-shop/result-state.ts',
  "    title: 'รายการนี้ชำระเงินแล้ว',", "    title: 'ชำระเงินสำเร็จ',"),
 ("MU32 the tick follows the state NAME, not `paid`", 'features/v2-shop/components/ResultScreen.tsx',
  "inFlight ? '\u2026' : copy.paid ? '\u2713' : '!'", "inFlight ? '\u2026' : state === 'APPROVED' ? '\u2713' : '!'"),
 ("MU33 offer the same road to a declined card", 'features/v2-shop/components/ResultScreen.tsx',
  "{copy.retry === 'different' && onTryAnother && (", "{copy.retry === 'different' && onTryAnother && false && ("),
 ("MU34 show a retry button while still in flight", 'features/v2-shop/components/ResultScreen.tsx',
  "{copy.retry === 'same' && onRetrySame && (", "{(copy.retry === 'same' || inFlight) && onRetrySame && ("),
 ("MU35 stop announcing the outcome", 'features/v2-shop/components/ResultScreen.tsx',
  'role="status" aria-live="polite" className="text-center text-2xl', 'className="text-center text-2xl'),
 ("MU36 clearCode subtracts locally instead of re-pricing", 'features/v2-shop/useCheckout.ts',
  "    clearCode: () => { setCode(''); void price(null) },",
  "    clearCode: () => { setCode(''); setCodeState('default'); setQuote((q) => q && { ...q, discountSatang: 0, amountSatang: q.amountSatang + q.discountSatang, codeApplied: null }) },"),
 ("MU37 a refused code blanks the quote", 'features/v2-shop/useCheckout.ts',
  "          setCodeState('error')\n          setCodeError(CODE_REASON[String(data.codeError)] ?? undefined)\n          return",
  "          setCodeState('error')\n          setQuote(null)\n          return"),
 ("MU38 a refused code is treated as fatal", 'features/v2-shop/useCheckout.ts',
  "        if (withCode) {\n          // A code we cannot honour. The PRICE the user was looking at is still valid — keep it.",
  "        if (false) {\n          // A code we cannot honour. The PRICE the user was looking at is still valid — keep it."),
 ("MU39 leak the server enum to the reader", 'features/v2-shop/useCheckout.ts',
  "setCodeError(CODE_REASON[String(data.codeError)] ?? undefined)", "setCodeError(String(data.codeError))"),
 ("MU6 drop role=alert from the error helper", 'features/v2-shop/components/DiscountCodeField.tsx',
  "role={isError ? 'alert' : 'status'}", "role={'status'}"),
]

def failed_tests():
    r=subprocess.run(['npx','vitest','run','scripts/discount-code-field.test.tsx','scripts/charge-status.test.ts','scripts/order-summary.test.tsx','scripts/payment-method-picker.test.tsx','scripts/qr-screen.test.tsx','scripts/result-state.test.ts','scripts/result-screen.test.tsx','scripts/use-checkout.test.tsx','--reporter=json'],
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
