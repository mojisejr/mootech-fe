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
    console.error('Usage: bun scripts/verify-ledger-integrity.ts <path-to-ledger.json> [path-to-evidence.md]');
    process.exit(1);
  }

  let success = verifyLedger(path.resolve(rootDir, ledgerPath), rootDir);
  
  if (evidencePath) {
    const evSuccess = verifyEvidence(path.resolve(rootDir, evidencePath), rootDir);
    success = success && evSuccess;
  }

  if (!success) {
    console.error('\n🚨 Integrity Check FAILED. Some anchors are dead or evidence is invalid.');
    process.exit(1);
  } else {
    console.log('\n✅ Integrity Check PASSED.');
    process.exit(0);
  }
}
