import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// Rule Result
export type RuleResult = {
  ruleId: string;
  pass: boolean;
  message: string;
  file: string;
  line?: number;
};

// ---------------------------------------------------------
// Rule 1: Tailwind JIT Arbitrary Default Props
// Ledger: BUG-001
// ---------------------------------------------------------
export function checkTailwindJitArbitrary(sourceFile: ts.SourceFile, filepath: string): RuleResult[] {
  const results: RuleResult[] = [];
  
  function visit(node: ts.Node) {
    // Look for BindingElement: e.g. `contentMaxWidth = 'max-w-[448px]'`
    if (ts.isBindingElement(node) && node.initializer) {
      if (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer)) {
        const value = node.initializer.text;
        // Regex to catch arbitrary tailwind values like max-w-[448px]
        if (/-\[.*\]/.test(value)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          results.push({
            ruleId: 'no-arbitrary-tailwind-default-props',
            pass: false,
            file: filepath,
            line: line + 1,
            message: `Arbitrary Tailwind class '${value}' found in default props. JIT compiler may not generate this class. Use core classes instead.`
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
  return results;
}

// ---------------------------------------------------------
// Rule 2: Ban suppressHydrationWarning
// Ledger: BUG-002 (Muted Flash Bypass)
// ---------------------------------------------------------
export function checkSuppressHydrationWarning(sourceFile: ts.SourceFile, filepath: string): RuleResult[] {
  const results: RuleResult[] = [];
  
  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'suppressHydrationWarning') {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      results.push({
        ruleId: 'no-suppress-hydration-warning',
        pass: false,
        file: filepath,
        line: line + 1,
        message: 'The suppressHydrationWarning attribute is banned. It creates a blind spot for the runtime hydration tracker.'
      });
    }
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
  return results;
}

// ---------------------------------------------------------
// Rule 3: Coverage Drift Discovery (SEAM with Goo)
// Ledger: Phantom Page Hole
// ---------------------------------------------------------
function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walkDir(filePath, fileList);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function filePathToRoute(filePath: string): string {
  let normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('pages/')) {
    normalized = normalized.split('pages/')[1];
  }
  normalized = normalized.replace(/\.tsx?$/, '');
  if (normalized.endsWith('/index')) {
    normalized = normalized.replace(/\/index$/, '');
  }
  if (normalized === 'index') {
    return '/';
  }
  return '/' + normalized;
}

function getAnchoredGatedPages(rootDir: string): string[] {
  const e2ePath = path.join(rootDir, 'e2e', 'v2-hydration-invariant.spec.ts');
  if (!fs.existsSync(e2ePath)) return [];
  
  const content = fs.readFileSync(e2ePath, 'utf-8');
  const sourceFile = ts.createSourceFile(e2ePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const keys: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'STATE_MAP') {
      if (node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
        for (const prop of node.initializer.properties) {
          if (ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.name)) {
            keys.push(prop.name.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return keys.sort();
}

export function generateGatedPagesManifest(rootDir: string): RuleResult[] {
  const pagesDir = path.join(rootDir, 'pages', 'v2');
  const allFiles = walkDir(pagesDir);
  const gatedRoutes: Set<string> = new Set();
  const results: RuleResult[] = [];

  for (const file of allFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let isGated = false;

    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node)) {
        const importClause = node.importClause;
        if (importClause && importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
          for (const specifier of importClause.namedBindings.elements) {
            if (specifier.name.text === 'useV2AuthGate') {
              isGated = true;
            }
          }
        }
      }

      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
          const moduleName = node.arguments[0].text;
          if (moduleName.includes('useV2AuthGate')) {
            isGated = true;
          }
        } else if (node.arguments.length > 0) {
          // Rule: Ban unresolvable dynamic imports
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          results.push({
            ruleId: 'no-unresolvable-dynamic-import',
            pass: false,
            file: file,
            line: line + 1,
            message: 'Dynamic import with non-literal argument found. Cannot statically resolve coverage drift. Please use static imports or literal dynamic imports.'
          });
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    if (isGated) {
      gatedRoutes.add(filePathToRoute(file));
    }
  }

  // Cross-check against Goo's STATE_MAP
  const anchoredRoutes = getAnchoredGatedPages(rootDir);
  for (const route of Array.from(gatedRoutes)) {
    if (!anchoredRoutes.includes(route)) {
      results.push({
        ruleId: 'gated-page-not-anchored',
        pass: false,
        file: 'e2e/v2-hydration-invariant.spec.ts',
        message: `Coverage Drift Detected (Phantom Page): Page '${route}' imports useV2AuthGate but is missing from STATE_MAP in the runtime anchor. Please add it.`
      });
    }
  }

  if (results.length === 0) {
    const manifestDir = path.join(rootDir, 'scripts');
    if (!fs.existsSync(manifestDir)) fs.mkdirSync(manifestDir, { recursive: true });
    const manifestPath = path.join(manifestDir, 'gated-v2-pages.generated.json');
    fs.writeFileSync(manifestPath, JSON.stringify(Array.from(gatedRoutes).sort(), null, 2));
    console.log(`✅ [SEAM-Drift-Guard] Coverage cross-check passed. Generated manifest at scripts/gated-v2-pages.generated.json (${gatedRoutes.size} gated routes)`);
  }
  
  return results;
}

// ---------------------------------------------------------
// Scanner Engine
// ---------------------------------------------------------
export function scanFile(filepath: string, content?: string): RuleResult[] {
  const code = content !== undefined ? content : fs.readFileSync(filepath, 'utf-8');
  const sourceFile = ts.createSourceFile(filepath, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  
  let allResults: RuleResult[] = [];
  allResults = allResults.concat(checkTailwindJitArbitrary(sourceFile, filepath));
  allResults = allResults.concat(checkSuppressHydrationWarning(sourceFile, filepath));
  
  return allResults;
}

if (require.main === module) {
  const rootDir = process.cwd();
  const filesToScan = process.argv.slice(2);
  let hasErrors = false;

  // 1. Run Coverage Drift Guard (Project-wide SEAM)
  const driftResults = generateGatedPagesManifest(rootDir);
  const driftFailures = driftResults.filter(r => !r.pass);
  if (driftFailures.length > 0) {
    hasErrors = true;
    driftFailures.forEach(f => {
      console.error(`❌ [${f.ruleId}] ${f.file}:${f.line} - ${f.message}`);
    });
  }

  // 2. Scan individual files (if provided)
  if (filesToScan.length > 0) {
    for (const file of filesToScan) {
      const fullPath = path.resolve(file);
      if (fs.existsSync(fullPath)) {
        const results = scanFile(fullPath);
        const failures = results.filter(r => !r.pass);
        
        if (failures.length > 0) {
          hasErrors = true;
          failures.forEach(f => {
            console.error(`❌ [${f.ruleId}] ${f.file}:${f.line} - ${f.message}`);
          });
        }
      }
    }
  }

  if (hasErrors) {
    console.error('\\n🚨 Architecture Verification Failed. Please fix the violations.');
    process.exit(1);
  } else {
    console.log('✅ Architecture Verification Passed.');
    process.exit(0);
  }
}
