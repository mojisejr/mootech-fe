import * as fs from 'fs';
import * as path from 'path';

/**
 * Load ledger entries from EITHER a directory of per-entry files
 * (harness/bug-ledger/<id>.json — the source of truth since B-2, split so two
 * PRs adding different entries never touch the same file) OR a single-file
 * array (kept for the unit fixture in verify-ledger-integrity.test.ts).
 *
 * Loud on every failure — never returns a silently-empty list:
 *  - missing path            → statSync throws (non-zero exit)
 *  - a malformed entry file  → JSON.parse throws, tagged with the filename
 * The empty-list case is caught by verifyLedger below (returns false), so a
 * mis-resolved directory can NEVER pass the gate with zero checks.
 */
export function loadLedgerEntries(ledgerPath: string): any[] {
  const stat = fs.statSync(ledgerPath); // throws loudly if the path is missing
  if (stat.isDirectory()) {
    const files = fs
      .readdirSync(ledgerPath)
      .filter((f) => f.endsWith('.json'))
      .sort();
    return files.map((f) => {
      const p = path.join(ledgerPath, f);
      try {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      } catch (e) {
        throw new Error(`Malformed ledger entry ${f}: ${(e as Error).message}`);
      }
    });
  }
  return JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
}

export function verifyLedger(ledgerPath: string, rootDir: string): boolean {
  const data = loadLedgerEntries(ledgerPath);
  let allLive = true;

  // No-silent-green guard: an empty ledger (e.g. a directory that resolved to
  // zero entry files) must FAIL, not vacuously pass with nothing checked.
  if (data.length === 0) {
    console.error(`❌ [Ledger] No entries found at ${ledgerPath} — refusing to pass a zero-check ledger.`);
    return false;
  }

  for (const entry of data) {
    if (entry.enforced_by) {
      const [filePath, anchorId] = entry.enforced_by.split('#');
      const fullPath = path.resolve(rootDir, filePath);
      
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ [${entry.id}] File missing: ${filePath}`);
        allLive = false;
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      if (!content.includes(anchorId)) {
        console.error(`❌ [${entry.id}] Anchor missing: '${anchorId}' not found in ${filePath}`);
        allLive = false;
      } else {
        console.log(`✅ [${entry.id}] Anchor LIVE: ${filePath}#${anchorId}`);
      }
    }
  }
  return allLive;
}

export function verifyEvidence(evidencePath: string, rootDir: string): boolean {
  if (!fs.existsSync(evidencePath)) {
    console.error(`❌ [Evidence] File missing: ${evidencePath}`);
    return false;
  }
  const content = fs.readFileSync(evidencePath, 'utf-8');
  
  // Find lines that match: `ANCHOR: filepath#anchor`
  const anchorRegex = /ANCHOR:\s*([^#\n]+)#([^\n\r]+)/g;
  let match;
  let hasValidAnchor = false;
  let allLive = true;

  while ((match = anchorRegex.exec(content)) !== null) {
    const filePath = match[1].trim();
    const anchorId = match[2].trim();
    const fullPath = path.resolve(rootDir, filePath);

    if (!fs.existsSync(fullPath)) {
      console.error(`❌ [Evidence] File missing: ${filePath}`);
      allLive = false;
      continue;
    }

    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    if (!fileContent.includes(anchorId)) {
      console.error(`❌ [Evidence] Anchor missing: '${anchorId}' not found in ${filePath}`);
      allLive = false;
    } else {
      console.log(`✅ [Evidence] Anchor LIVE: ${filePath}#${anchorId}`);
      hasValidAnchor = true;
    }
  }

  if (!hasValidAnchor) {
    console.error(`❌ [Evidence] No valid ANCHOR references found in ${evidencePath}. Expected format: 'ANCHOR: path/to/file#anchor_text'`);
    return false;
  }

  return allLive;
}

if (require.main === module) {
  const ledgerPath = process.argv[2];
  const evidencePath = process.argv[3];
  const rootDir = process.cwd();
  
  if (!ledgerPath) {
    console.error('Usage: bun scripts/verify-ledger-integrity.ts <path-to-ledger-dir-or-json> [path-to-evidence.md]');
    process.exit(1);
  }

  let success: boolean;
  try {
    success = verifyLedger(path.resolve(rootDir, ledgerPath), rootDir);

    if (evidencePath) {
      const evSuccess = verifyEvidence(path.resolve(rootDir, evidencePath), rootDir);
      success = success && evSuccess;
    }
  } catch (e) {
    // Missing path / malformed entry file — fail LOUD, never silent-green.
    console.error(`🚨 Integrity Check ERROR: ${(e as Error).message}`);
    process.exit(1);
  }

  if (!success) {
    console.error('\n🚨 Integrity Check FAILED. Some anchors are dead or evidence is invalid.');
    process.exit(1);
  } else {
    console.log('\n✅ Integrity Check PASSED.');
    process.exit(0);
  }
}
