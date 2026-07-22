import * as fs from 'fs';
import * as path from 'path';

export function verifyLedger(ledgerPath: string, rootDir: string): boolean {
  const data = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
  let allLive = true;

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

if (require.main === module) {
  const ledgerPath = process.argv[2];
  const rootDir = process.cwd();
  
  if (!ledgerPath) {
    console.error('Usage: bun scripts/verify-ledger-integrity.ts <path-to-ledger.json>');
    process.exit(1);
  }

  const success = verifyLedger(path.resolve(rootDir, ledgerPath), rootDir);
  if (!success) {
    console.error('\\n🚨 Ledger Integrity Check FAILED. Some anchors are dead (vacuous ledger).');
    process.exit(1);
  } else {
    console.log('\\n✅ Ledger Integrity Check PASSED.');
    process.exit(0);
  }
}
