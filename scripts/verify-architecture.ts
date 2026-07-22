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
// Rule 3: Ban Evading Forms for AuthGate (Complete-by-construction)
// Ledger: Phantom Page Hole
// ---------------------------------------------------------
export function checkAuthGateUsage(sourceFile: ts.SourceFile, filepath: string): RuleResult[] {
  const results: RuleResult[] = [];
  const normalizedPath = filepath.replace(/\\/g, '/');
  const isInsidePagesV2 = normalizedPath.includes('/pages/v2/');
  
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const importPath = moduleSpecifier.text;
        let foundAuthGate = false;
        const importClause = node.importClause;
        
        if (importClause) {
          if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
            if (importPath.includes('useV2AuthGate')) {
              foundAuthGate = true;
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              results.push({
                ruleId: 'ban-auth-gate-namespace-import', pass: false, file: filepath, line: line + 1,
                message: 'Namespace import of useV2AuthGate is banned. Use direct named import.'
              });
            }
          } else if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
            for (const specifier of importClause.namedBindings.elements) {
              if (specifier.name.text === 'useV2AuthGate' || (specifier.propertyName && specifier.propertyName.text === 'useV2AuthGate')) {
                foundAuthGate = true;
                if (specifier.propertyName) {
                  const { line } = sourceFile.getLineAndCharacterOfPosition(specifier.getStart());
                  results.push({
                    ruleId: 'ban-auth-gate-alias', pass: false, file: filepath, line: line + 1,
                    message: 'Alias import of useV2AuthGate is banned. Use direct named import without alias.'
                  });
                }
              }
            }
          }
        }
        
        if (foundAuthGate) {
          if (!isInsidePagesV2) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            results.push({
              ruleId: 'ban-auth-gate-transitive', pass: false, file: filepath, line: line + 1,
              message: 'Transitive wrapper of useV2AuthGate is banned. It must be imported directly inside pages/v2/.'
            });
          }
          if (!importPath.endsWith('/features/auth/hooks/useV2AuthGate')) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            results.push({
              ruleId: 'ban-auth-gate-barrel', pass: false, file: filepath, line: line + 1,
              message: `Barrel import of useV2AuthGate is banned. Import from exactly '@/features/auth/hooks/useV2AuthGate'.`
            });
          }
        }
      }
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
        const importPath = node.arguments[0].text;
        if (importPath.includes('useV2AuthGate')) {
          if (!isInsidePagesV2) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            results.push({
              ruleId: 'ban-auth-gate-transitive', pass: false, file: filepath, line: line + 1,
              message: 'Transitive dynamic import of useV2AuthGate is banned. It must be imported directly inside pages/v2/.'
            });
          }
          if (!importPath.endsWith('/features/auth/hooks/useV2AuthGate')) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            results.push({
              ruleId: 'ban-auth-gate-barrel', pass: false, file: filepath, line: line + 1,
              message: `Barrel dynamic import of useV2AuthGate is banned. Import from exactly '@/features/auth/hooks/useV2AuthGate'.`
            });
          }
        }
      } else if (node.arguments.length > 0 && isInsidePagesV2) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        results.push({
          ruleId: 'no-unresolvable-dynamic-import', pass: false, file: filepath, line: line + 1,
          message: 'Dynamic import with non-literal argument found in pages/v2. Cannot statically resolve coverage drift. Please use static imports or literal dynamic imports.'
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return results;
}

// ---------------------------------------------------------
// Rule 4: Ban Inline Identity in pages/v2 (Complete-by-construction)
// Ledger: Inline Identity Gate Evasion
// ---------------------------------------------------------
export function checkInlineIdentityUsage(sourceFile: ts.SourceFile, filepath: string): RuleResult[] {
  const results: RuleResult[] = [];
  const normalizedPath = filepath.replace(/\\/g, '/');
  
  // This rule only applies to pages/v2
  if (!/(^|\/)pages\/v2\//.test(normalizedPath)) {
    return results;
  }

  function visit(node: ts.Node) {
    // 1. Ban importing useCurrentUser
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const importPath = moduleSpecifier.text;
        let found = false;

        if (importPath.includes('use-current-user') || importPath.includes('useCurrentUser')) {
          found = true;
        }

        if (node.importClause && node.importClause.namedBindings) {
          if (ts.isNamedImports(node.importClause.namedBindings)) {
            for (const specifier of node.importClause.namedBindings.elements) {
              if (specifier.name.text === 'useCurrentUser' || (specifier.propertyName && specifier.propertyName.text === 'useCurrentUser')) {
                found = true;
              }
            }
          }
        }

        if (found) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          results.push({
            ruleId: 'ban-inline-identity-import', pass: false, file: filepath, line: line + 1,
            message: 'Importing useCurrentUser is banned in pages/v2. You must use useV2AuthGate() for identity.'
          });
        }
      }
    }

    // 2. Ban useCookies raw calls (specifically trying to read member cookie)
    if (ts.isCallExpression(node)) {
      const exprText = node.expression.getText(sourceFile);
      if (exprText === 'useCookies') {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        results.push({
          ruleId: 'ban-inline-identity-use-cookies', pass: false, file: filepath, line: line + 1,
          message: 'Direct useCookies() is banned in pages/v2 to prevent identity hydration leaks. Use useV2AuthGate().'
        });
      }
    }

    // 3. Ban document.cookie
    if (ts.isPropertyAccessExpression(node)) {
      if (node.name.text === 'cookie' && node.expression.getText(sourceFile) === 'document') {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        results.push({
          ruleId: 'ban-inline-identity-document-cookie', pass: false, file: filepath, line: line + 1,
          message: 'Reading document.cookie directly is banned in pages/v2. Use useV2AuthGate().'
        });
      }
    }

    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
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
  allResults = allResults.concat(checkAuthGateUsage(sourceFile, filepath));
  allResults = allResults.concat(checkInlineIdentityUsage(sourceFile, filepath));
  
  return allResults;
}

// ---------------------------------------------------------
// Project-wide Coverage Discovery
// ---------------------------------------------------------
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
    
    // We already run checkAuthGateUsage in scanFile for all files in the project.
    // For discovery, we just look for a valid direct named import.
    let isGated = false;

    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          const importClause = node.importClause;
          if (importClause && importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
            for (const specifier of importClause.namedBindings.elements) {
              if (specifier.name.text === 'useV2AuthGate' && !specifier.propertyName) {
                isGated = true;
              }
            }
          }
        }
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        if (node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
          if (node.arguments[0].text.includes('useV2AuthGate')) {
            isGated = true;
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);

    if (isGated) {
      gatedRoutes.add(filePathToRoute(file));
    }
  }

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

if (require.main === module) {
  const rootDir = process.cwd();
  let hasErrors = false;

  // 1. Scan ALL source files in the project for rule violations (including checkAuthGateUsage)
  const allProjectFiles = walkDir(path.join(rootDir, 'pages')).concat(
    walkDir(path.join(rootDir, 'components')),
    walkDir(path.join(rootDir, 'features'))
  );
  
  for (const file of allProjectFiles) {
    const results = scanFile(file);
    const failures = results.filter(r => !r.pass);
    if (failures.length > 0) {
      hasErrors = true;
      failures.forEach(f => {
        console.error(`❌ [${f.ruleId}] ${f.file}:${f.line || '?'} - ${f.message}`);
      });
    }
  }

  // 2. Run Coverage Drift Guard (Manifest generation & Cross-check)
  const driftResults = generateGatedPagesManifest(rootDir);
  const driftFailures = driftResults.filter(r => !r.pass);
  if (driftFailures.length > 0) {
    hasErrors = true;
    driftFailures.forEach(f => {
      console.error(`❌ [${f.ruleId}] ${f.file}:${f.line || '?'} - ${f.message}`);
    });
  }

  if (hasErrors) {
    console.error('\n🚨 Architecture Verification Failed. Please fix the violations.');
    process.exit(1);
  } else {
    console.log('✅ Architecture Verification Passed.');
    process.exit(0);
  }
}
