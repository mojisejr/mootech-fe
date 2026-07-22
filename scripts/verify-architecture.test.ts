import { scanFile } from './verify-architecture';

const BUGGY_MUTANT = `
export function FullBleedScreen({
  contentMaxWidth = 'max-w-[448px]',
}: {
  contentMaxWidth?: string
}) {
  return <div className={contentMaxWidth}>test</div>
}
`;

const FIXED_CODE = `
export function FullBleedScreen({
  contentMaxWidth = 'max-w-md',
}: {
  contentMaxWidth?: string
}) {
  return <div className={contentMaxWidth}>test</div>
}
`;

console.log('--- Proof of Teeth: AST Rule [no-arbitrary-tailwind-default-props] ---');

// 1. Negative Control (Buggy Mutant) -> MUST FAIL
console.log('\\n[TEST 1] Running on Buggy Mutant...');
const buggyResults = scanFile('mutant.tsx', BUGGY_MUTANT);
const buggyFailures = buggyResults.filter(r => !r.pass);
if (buggyFailures.length > 0) {
  console.log('✅ Mutant caught successfully (Rule works!).');
  console.log('   Error:', buggyFailures[0].message);
} else {
  console.error('❌ FAILED: Mutant slipped through! Rule is vacuous.');
  process.exit(1);
}

// 2. Positive Control (Fixed Code) -> MUST PASS
console.log('\\n[TEST 2] Running on Fixed Code...');
const fixedResults = scanFile('fixed.tsx', FIXED_CODE);
const fixedFailures = fixedResults.filter(r => !r.pass);
if (fixedFailures.length === 0) {
  console.log('✅ Fixed code passed successfully (No false positive!).');
} else {
  console.error('❌ FAILED: Fixed code threw an error! Rule is too strict.');
  process.exit(1);
}

console.log('\\n--- Proof of Teeth: AST Rule [no-suppress-hydration-warning] ---');

const BUGGY_MUTANT_2 = `
export function AuthGate() {
  return <div suppressHydrationWarning>Loading...</div>
}
`;

const FIXED_CODE_2 = `
export function AuthGate() {
  return <div>Loading...</div>
}
`;

console.log('\\n[TEST 3] Running on Buggy Mutant (suppressHydrationWarning)...');
const buggyResults2 = scanFile('mutant2.tsx', BUGGY_MUTANT_2);
const buggyFailures2 = buggyResults2.filter(r => !r.pass && r.ruleId === 'no-suppress-hydration-warning');
if (buggyFailures2.length > 0) {
  console.log('✅ Mutant caught successfully (Rule works!).');
  console.log('   Error:', buggyFailures2[0].message);
} else {
  console.error('❌ FAILED: Mutant slipped through! Rule is vacuous.');
  process.exit(1);
}

console.log('\\n[TEST 4] Running on Fixed Code...');
const fixedResults2 = scanFile('fixed2.tsx', FIXED_CODE_2);
const fixedFailures2 = fixedResults2.filter(r => !r.pass && r.ruleId === 'no-suppress-hydration-warning');
if (fixedFailures2.length === 0) {
  console.log('✅ Fixed code passed successfully (No false positive!).');
} else {
  console.error('❌ FAILED: Fixed code threw an error! Rule is too strict.');
  process.exit(1);
}

console.log('\\n--- Proof of Teeth: AST Rule [ban-inline-identity] ---');

const INLINE_IDENTITY_MUTANT_1 = `
import { useCurrentUser } from '@/lib/auth/use-current-user';
export function Page() {
  const user = useCurrentUser();
  return <div>{user.name}</div>
}
`;

const INLINE_IDENTITY_MUTANT_2 = `
import { useCookies } from 'react-cookie';
export function Page() {
  const [cookies] = useCookies(['cookie-mumate-id']);
  return <div>{cookies['cookie-mumate-id']}</div>
}
`;

const INLINE_IDENTITY_MUTANT_3 = `
export function Page() {
  const c = document.cookie;
  return <div>{c}</div>
}
`;

const INLINE_IDENTITY_FIXED = `
import { useV2AuthGate } from '@/features/auth/hooks/useV2AuthGate';
export function Page() {
  return <div>Clean</div>
}
`;

function assertMutantCaught(mutantCode: string, rulePrefix: string, testName: string) {
  console.log(`\n[${testName}] Running on Buggy Mutant...`);
  // Must pass 'pages/v2/' to trigger the rule
  const results = scanFile('pages/v2/page.tsx', mutantCode);
  const failures = results.filter(r => !r.pass && r.ruleId.startsWith(rulePrefix));
  if (failures.length > 0) {
    console.log('✅ Mutant caught successfully (Rule works!).');
    console.log('   Error:', failures[0].message);
  } else {
    console.error(`❌ FAILED: Mutant slipped through! Rule ${rulePrefix} is vacuous.`);
    process.exit(1);
  }
}

assertMutantCaught(INLINE_IDENTITY_MUTANT_1, 'ban-inline-identity-import', 'TEST 5 - useCurrentUser');
assertMutantCaught(INLINE_IDENTITY_MUTANT_2, 'ban-inline-identity-use-cookies', 'TEST 6 - useCookies');
assertMutantCaught(INLINE_IDENTITY_MUTANT_3, 'ban-inline-identity-document-cookie', 'TEST 7 - document.cookie');

console.log('\\n[TEST 8] Running on Fixed Code (AuthGate)...');
const inlineFixedResults = scanFile('pages/v2/page.tsx', INLINE_IDENTITY_FIXED);
const inlineFixedFailures = inlineFixedResults.filter(r => !r.pass && r.ruleId.startsWith('ban-inline-identity'));
if (inlineFixedFailures.length === 0) {
  console.log('✅ Fixed code passed successfully (No false positive!).');
} else {
  console.error('❌ FAILED: Fixed code threw an error! Rule is too strict.');
  process.exit(1);
}

console.log('\\n✅ All Proof of Teeth COMPLETE.');

