import { verifyLedger, loadLedgerEntries } from './verify-ledger-integrity';
import * as fs from 'fs';
import * as path from 'path';

const LEDGER_PATH = 'test-ledger.json';
const MOCK_SCRIPT_PATH = 'mock-anchor-script.ts';

// Setup Mock Ledger and Script
fs.writeFileSync(LEDGER_PATH, JSON.stringify([
  {
    "id": "BUG-999",
    "enforced_by": `${MOCK_SCRIPT_PATH}#myAwesomeAnchor`
  }
]));

fs.writeFileSync(MOCK_SCRIPT_PATH, `
export function myAwesomeAnchor() {
  return true;
}
`);

console.log('\\n--- Proof of Teeth: Ledger Integrity Check ---');

// 1. Positive Control: Anchor exists
console.log('\\n[TEST 1] Running on LIVE Anchor (Positive Control)...');
const pass = verifyLedger(LEDGER_PATH, process.cwd());
if (pass) {
  console.log('✅ PASS: Caught the live anchor correctly.');
} else {
  console.error('❌ FAIL: False positive.');
  process.exit(1);
}

// 2. Negative Control: Delete the anchor (simulate rot/deletion)
console.log('\\n[TEST 2] Running on DEAD Anchor (Negative Control)...');
fs.writeFileSync(MOCK_SCRIPT_PATH, `
// Anchor was accidentally deleted during a refactor!
export function someOtherFunction() {
  return true;
}
`);
const pass2 = verifyLedger(LEDGER_PATH, process.cwd());
if (!pass2) {
  console.log('✅ PASS: Successfully detected DEAD anchor (Rule is NOT vacuous).');
} else {
  console.error('❌ FAIL: Vacuous check! Dead anchor slipped through.');
  process.exit(1);
}

// Cleanup
fs.unlinkSync(LEDGER_PATH);
fs.unlinkSync(MOCK_SCRIPT_PATH);

console.log('\\n✅ Ledger Integrity Proof of Teeth COMPLETE.');

// -------------------------------------------------------------
// ANCHOR: b2-dir-teeth
// B-2 split the ledger from one array file into a directory of per-entry files
// (harness/bug-ledger/<id>.json). These tests prove the DIRECTORY read path has
// the same teeth as the old file read path — a dead anchor in ANY entry file is
// caught, and an EMPTY directory FAILS instead of passing with zero checks.
// -------------------------------------------------------------
console.log('\\n--- Proof of Teeth: Directory-mode Ledger (B-2 split) ---');
const DIR = 'test-ledger-dir';
const DIR_SCRIPT = 'mock-dir-anchor.ts';
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(DIR_SCRIPT, `export function dirAnchorOne() { return true; }\nexport function dirAnchorTwo() { return true; }\n`);
fs.writeFileSync(path.join(DIR, 'entry-a.json'), JSON.stringify({ id: 'entry-a', enforced_by: `${DIR_SCRIPT}#dirAnchorOne` }, null, 2));
fs.writeFileSync(path.join(DIR, 'entry-b.json'), JSON.stringify({ id: 'entry-b', enforced_by: `${DIR_SCRIPT}#dirAnchorTwo` }, null, 2));

// TEST 5: aggregation reads every per-entry file
console.log('\\n[TEST 5] Directory aggregation loads all entry files...');
const loaded = loadLedgerEntries(DIR);
if (loaded.length === 2 && loaded.map((e: any) => e.id).sort().join(',') === 'entry-a,entry-b') {
  console.log('✅ PASS: aggregated 2 per-entry files from the directory.');
} else {
  console.error(`❌ FAIL: expected 2 entries, got ${JSON.stringify(loaded.map((e: any) => e.id))}`);
  process.exit(1);
}

// TEST 6: Positive control — both anchors live
console.log('\\n[TEST 6] Directory mode on LIVE anchors (Positive Control)...');
if (verifyLedger(DIR, process.cwd())) {
  console.log('✅ PASS: directory of live anchors passes.');
} else {
  console.error('❌ FAIL: false positive on live directory.');
  process.exit(1);
}

// TEST 7: Negative control — kill ONE entry's anchor (in a separate file)
console.log('\\n[TEST 7] Directory mode with ONE dead anchor (Negative Control)...');
fs.writeFileSync(DIR_SCRIPT, `export function dirAnchorOne() { return true; }\n// the second anchor was deleted in a refactor!\n`);
if (!verifyLedger(DIR, process.cwd())) {
  console.log('✅ PASS: detected a dead anchor in one entry file (dir read is NOT vacuous).');
} else {
  console.error('❌ FAIL: vacuous! dead anchor in a per-entry file slipped through.');
  process.exit(1);
}

// TEST 8: No-silent-green — an EMPTY directory must FAIL, not pass with 0 checks
console.log('\\n[TEST 8] Empty directory must FAIL (no silent green)...');
const EMPTY_DIR = 'test-ledger-empty';
fs.rmSync(EMPTY_DIR, { recursive: true, force: true });
fs.mkdirSync(EMPTY_DIR, { recursive: true });
if (!verifyLedger(EMPTY_DIR, process.cwd())) {
  console.log('✅ PASS: empty ledger directory FAILS (zero-check gate refused).');
} else {
  console.error('❌ FAIL: SILENT GREEN! empty directory passed with nothing checked.');
  process.exit(1);
}

// Cleanup dir-mode fixtures
fs.rmSync(DIR, { recursive: true, force: true });
fs.rmSync(EMPTY_DIR, { recursive: true, force: true });
fs.unlinkSync(DIR_SCRIPT);

console.log('\\n✅ Directory-mode Proof of Teeth COMPLETE.');

// -------------------------------------------------------------
// Metric Death-Detector (Alert Logic)
// -------------------------------------------------------------
console.log('\\n--- Proof of Teeth: Metric Death-Detector ---');
function checkHarnessHealth(bugsCaughtByHarness: number, totalBugs: number, threshold = 0.8): boolean {
  if (totalBugs === 0) return true; // Healthy by default if no bugs
  const metric = bugsCaughtByHarness / totalBugs;
  return metric >= threshold; // returns false (ALERT) if below threshold
}

// 1. Synthetic Negative Control: Ratio < Threshold (MUST ALERT)
console.log('\\n[TEST 3] Synthetic Negative Control (Harness caught 0 bugs)...');
const healthBad = checkHarnessHealth(0, 10);
if (!healthBad) {
  console.log('✅ PASS: Caught the unhealthy harness successfully (ALERT triggered).');
} else {
  console.error('❌ FAIL: False negative! Alert was not triggered for an unhealthy harness.');
  process.exit(1);
}

// 2. Synthetic Positive Control: Ratio >= Threshold (MUST NOT ALERT)
console.log('\\n[TEST 4] Synthetic Positive Control (Harness caught 9/10 bugs)...');
const healthGood = checkHarnessHealth(9, 10);
if (healthGood) {
  console.log('✅ PASS: Harness reported healthy successfully (NO false alert).');
} else {
  console.error('❌ FAIL: False positive! Alert was triggered for a healthy harness.');
  process.exit(1);
}

console.log('\\n✅ Metric Death-Detector Proof of Teeth COMPLETE.');
