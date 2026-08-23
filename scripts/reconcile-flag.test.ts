// #409 — the kill switch's rule, on the tsx lane (node:assert, pure).
//
// ANCHOR: scripts/reconcile-flag.test.ts#reconcile-kill-switch-default-on
// Bug-class this owns: a switch whose DEFAULT silently stops a money-recovery job. Every other gate in
// this repo fails closed, so the reflex when editing this file will be to "fix" the default to off. That
// reflex is right for a door and wrong for a repair job: closed here means a customer who paid and lost
// their webhook is never granted what they bought, and the only symptom is that nothing happens.
//
// 🔴 MUTANT CONTRACT:
//   MF1  `if (raw === undefined) return true` → `return false`   → the unset case reddens
//   MF2  an unrecognised value reads as OFF                       → the typo cases redden
import assert from 'node:assert/strict'
import { isReconcileEnabled } from '../lib/payment/reconcile-flag'

let pass = 0
const ok = (name: string, cond: boolean) => {
  assert.ok(cond, `FAIL: ${name}`)
  pass += 1
}

// 🔴 the default. Unset must keep repairing.
ok('unset → ENABLED (an unconfigured deploy still recovers lost payments)', isReconcileEnabled(undefined))

// the deliberate off words
for (const v of ['off', 'false', '0', 'no', 'disabled', 'OFF', ' Off ', 'FALSE']) {
  ok(`"${v}" → disabled (case/whitespace insensitive)`, !isReconcileEnabled(v))
}

// 🔴 anything we do not recognise stays ON. A typo must not be able to switch off a money job — it may
// only fail to switch it off, which someone notices the moment they check.
for (const v of ['', 'on', 'true', '1', 'yes', 'maybe', 'OFF PLEASE', 'offf', 'nope']) {
  ok(`"${v}" → still enabled (unrecognised is not a disable)`, isReconcileEnabled(v))
}

console.log(`\n  reconcile-kill-switch-default-on: ${pass} passed`)
