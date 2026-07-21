// harness/lint.ts — Frame-v2 Layer-1 (static/source conformance). Reads SOURCE, not the browser.
// Flags hand-rolled values the JIT may silently drop (the max-w-[NNN] / max-h-[NNN] failure family)
// and raw hex that should be a token. Advisory in the thin slice; tightens to block once tokens cover all.
import { readFileSync } from 'node:fs'

export interface LintFinding {
  file: string
  line: number
  kind: 'raw-hex' | 'arbitrary-class'
  text: string
  severity: 'block' | 'advisory'
}

const ARBITRARY =
  /\b(?:max-h|max-w|min-h|min-w|w|h|p[trblxy]?|m[trblxy]?|gap|top|bottom|left|right|inset|leading|text)-\[[^\]]+\]/g
const HEX = /#[0-9a-fA-F]{3,8}\b/g

export function lintSources(files: string[]): LintFinding[] {
  const findings: LintFinding[] = []
  for (const file of files) {
    let src: string
    try {
      src = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    src.split('\n').forEach((ln, i) => {
      for (const m of Array.from(ln.matchAll(HEX))) findings.push({ file, line: i + 1, kind: 'raw-hex', text: m[0], severity: 'advisory' })
      for (const m of Array.from(ln.matchAll(ARBITRARY))) findings.push({ file, line: i + 1, kind: 'arbitrary-class', text: m[0], severity: 'advisory' })
    })
  }
  return findings
}
