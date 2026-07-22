// Browser truth for the /v2 AUTH-GATE HYDRATION invariant (webgang v2 harness — goo's runtime anchor).
// STEP 2 (widen): step 1 anchored one page/one state and was penetrated in the adversary round for
// being EARLY. This version closes the holes the MUTANT proved real (not the hole-map's guesses):
//
//   • ALL gated pages, not one — the tested set is DERIVED from source (every page that imports
//     useV2AuthGate), so a new gated page cannot silently escape coverage. This is the real
//     anti-blind: the step-1 adversary hole was "a gated page the anchor never visits", and /v2 has
//     7 pages of which only 3 are gated — a hardcoded list would rot the moment a 4th is gated.
//   • CLS / mount-flash — a second, mechanism-independent lens (Lamun-visual). Under the mutant the
//     bad hydration re-render shifts layout (measured 0.027–0.031 vs baseline ≤0.004); a signal-less
//     mismatch (flash without a console error) is caught here even if the console channel is silent.
//
// DROPPED from the hole-map after the mutant DISPROVED it: "ban suppressHydrationWarning". Tested
// directly — a suppressHydrationWarning wrapper does NOT silence our mismatch (hydErr stayed 5, CLS
// stayed 0.027), because React only suppresses element-level text/attr diffs, never a structural
// tree mismatch (AuthLoadingGate vs the page body). It guards a non-threat, so it is not here. The
// mutant decides, not the hole-map.
//
// THE INVARIANT: for any useV2AuthGate-gated /v2 page, server HTML === client first paint. The
// MEMBER_ID cookie (`cookie-mumate-id`) is identity-truth but invisible to SSR (react-cookie reads
// document.cookie, empty on the server), so an AUTHED load resolves 'loading' on the server yet
// 'authed' on the first client paint → structural mismatch, unless the `!hasMounted` mount-gate in
// useV2AuthGate.showLoading holds both renders on <AuthLoadingGate/> until after mount. (ANON loads
// do NOT diverge: the client's first paint is still 'loading' — the session hasn't resolved — so it
// agrees with the server; those states are guarded to stay clean, not expected to fail.)
//
// Self-contained (imports only @playwright/test + node core) — the bundler-resolution trap forbids
// cross-file relative imports. Local-only: needs FE :3000 with V2_PREVIEW_KEY set.
// Run: npx playwright test e2e/v2-hydration-invariant.spec.ts
import { test, expect, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const V2_PREVIEW_KEY = process.env.V2_PREVIEW_KEY ?? "lamun-local-dev";
const V2_COOKIE = "v2_access";
const MEMBER_ID_COOKIE = "cookie-mumate-id";
// A valid uuid so resolveAuth's UUID_RE reports 'authed' on the client from the cookie alone (no
// session needed — the cookie is identity-truth, which is exactly the SSR-invisible → client-authed skew).
const AUTHED_MEMBER_ID = "11111111-1111-1111-1111-111111111111";

// React 18 / Next dev emit these on a hydration mismatch; #418/#423 are the prod-minified equivalents.
const HYDRATION_SIGNAL =
  /hydrat|did not match|does not match|initial UI does not match|Text content|#418|#423/i;
// mount-flash budget — BLOCKING (Lamun-visual co-signed 2026-07-22 via INDEPENDENT repro: her
// neg-control 0.0000, her geometry-flash 0.1776; goo's /v2 baseline 0.000, /v2 mutant 0.077). 0.015
// sits between /v2 baseline and mutant with margin, under web-vitals "good" (0.1). Scope + provenance:
//   • DEFAULT state only — NOT injected states (a font-size injection reflows to CLS ~0.116, a TEST
//     artifact, not app CLS). This anchor drives only default states.
//   • PER-SCREEN, not universal — CLS is layout-dependent (goo 0.077 vs Lamun 0.1776 for the same
//     mutant on different page bodies proves it's not portable). This 0.015 is ratified for /v2 from
//     /v2-measured baseline/mutant; re-ratify per screen as content grows (robust form: ≤4× baseline, floor 0.015).
//   • SCOPE of teeth — blocking covers the GEOMETRY-shift console-silent flash (mut-cls-silent-flash:
//     hydErr===0 AND CLS≥budget, proving CLS independent of the console lens). Opacity/transform/
//     same-box flashes read CLS 0 (Lamun verified) → those stay for pixel-L3 (Lamun's next). Don't
//     claim CLS closes all silent flashes — only geometry-shift.
const CLS_BUDGET = 0.015;

type Seed = { authed: boolean; mismatch: boolean };
// path → the states this anchor drives it through. `mismatch: true` = under the mutant this state
// MUST turn red (a proof-of-teeth site); `false` = a gated state that legitimately can't diverge but
// is still guarded to stay clean.
const STATE_MAP: Record<string, Seed[]> = {
  "/v2": [{ authed: true, mismatch: true }, { authed: false, mismatch: false }],
  // login [authed] IS a mismatch site: `redirecting` is gated on hasMounted, so under the mutant the
  // client first paint renders LoginView (redirecting=false pre-mount) while the server renders the
  // loading gate — proven by the mutant catching it. (Fixed code holds both on the loading gate.)
  "/v2/login": [{ authed: false, mismatch: false }, { authed: true, mismatch: true }],
  "/v2/register": [{ authed: true, mismatch: true }, { authed: false, mismatch: false }],
};

// COVERAGE authority = ตู๋'s AST rule (verify-architecture.ts). A first-cut derived-glob lived here
// and ตู๋ (static lens) adversarially penetrated it (shallow readdir; dynamic import). It then went
// through an adversary loop — goo penetrated a dependency-graph attempt with namespace/alias/transitive
// forms — and landed on COMPLETE-BY-CONSTRUCTION: ตู๋'s rule BANS every evading form (namespace, alias,
// transitive wrapper, barrel), so any gated page MUST use a direct named import his scanner catches.
// It emits the authoritative gated set to scripts/gated-v2-pages.generated.json, which THIS anchor
// consumes below as the source-of-truth: every discovered route must have a STATE_MAP seed, or the
// coverage test fails (a phantom page his scanner found that the runtime anchor can't drive).
const GATED_MANIFEST_PATH = "scripts/gated-v2-pages.generated.json";
export const ANCHORED_GATED_PAGES: string[] = Object.keys(STATE_MAP).sort();

/** EVERY /v2 route file → route path (recursive). Drives the full-route crawl below: the crawl is a
 * RUNTIME backstop that does not rely on import-discovery, so it catches a page that gates on client
 * identity WITHOUT useV2AuthGate (inline `useCurrentUser` / raw MEMBER_ID cookie) — the family the
 * static ban prevents at source; this detects any that slip, at ground-truth (does it actually
 * hydration-mismatch when authed?). Ungated pages render identically SSR/client → no mismatch → pass. */
function allV2Routes(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".tsx")) {
        const base = p.slice("pages".length).replace(/\\/g, "/").replace(/\.tsx$/, "");
        out.push(base.endsWith("/index") ? base.slice(0, -"/index".length) : base);
      }
    }
  };
  walk(join("pages", "v2"));
  return out.sort();
}

async function loadAndObserve(
  page: Page,
  path: string,
  authed: boolean,
): Promise<{ hydrationErrors: string[]; cls: number }> {
  const cookies = [
    { name: V2_COOKIE, value: V2_PREVIEW_KEY, domain: "localhost", path: "/" },
    ...(authed
      ? [{ name: MEMBER_ID_COOKIE, value: AUTHED_MEMBER_ID, domain: "localhost", path: "/" }]
      : []),
  ];
  await page.context().addCookies(cookies);

  const hydrationErrors: string[] = [];
  const record = (t: string) => {
    if (HYDRATION_SIGNAL.test(t)) hydrationErrors.push(t.slice(0, 200));
  };
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") record(m.text());
  });
  page.on("pageerror", (e) => record(e.message));

  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const s = e as unknown as { hadRecentInput: boolean; value: number };
        if (!s.hadRecentInput) (window as unknown as { __cls: number }).__cls += s.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500); // let the post-mount render settle; a mismatch fires DURING hydration
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls || 0);
  return { hydrationErrors, cls };
}

test.describe("v2 auth-gate hydration invariant (webgang v2 step 2 — goo runtime, seam w/ too+มุน)", () => {
  // ── Coverage lens (SEAM: ตู๋ discovers, goo consumes). Read ตู๋'s authoritative manifest (produced
  // by his complete-by-construction scanner) and assert every discovered gated page has a STATE_MAP
  // seed. A phantom page his scanner finds but this anchor can't drive → RED. This is the runtime
  // half of the anti-drift guard; the static half (banning evading import forms) is his.
  test("coverage: every AST-discovered gated page is anchored (no phantom page)", () => {
    const discovered: string[] = JSON.parse(readFileSync(GATED_MANIFEST_PATH, "utf8"));
    const anchored = Object.keys(STATE_MAP);
    const phantom = discovered.filter((route) => !anchored.includes(route));
    expect(
      phantom,
      `AST-discovered gated page(s) with no STATE_MAP seed (add them + a seed state):\n` +
        `  discovered (${GATED_MANIFEST_PATH}): ${discovered.join(", ")}\n  anchored: ${anchored.sort().join(", ")}`,
    ).toEqual([]);
  });

  // ── Full-route crawl (goo runtime, BLOCKING) — the ground-truth backstop for the inline-identity
  // family. Coverage above trusts a PROXY (imports useV2AuthGate); a page that gates on client identity
  // via inline `useCurrentUser` / raw MEMBER_ID cookie has the SAME hydration risk but no such import,
  // so it evades discovery entirely. This crawls EVERY /v2 route authed and asserts none mismatches —
  // detection by behaviour, not by import form. Complements ตู๋'s static ban (which prevents the pattern
  // at source): static prevents, runtime detects any that slip. Ungated pages render identically
  // SSR/client → clean; only a real inline-gate-without-mount-guard turns this red.
  // ANCHOR: inline-identity-crawl  (bug-ledger enforced_by target — keep this marker stable)
  // Checks BOTH channels the anchor blocks on (console + CLS) across BOTH states (authed + anon) —
  // Lamun's adversary caught v1 discarding the `cls` loadAndObserve already returns (a console-silent
  // geometry flash would have sneaked on every route, a regression of the CLS lens) AND driving only
  // authed (an anon-only mismatch would sneak). Budget 0.015 is safe here: every real route measured
  // ≤0.0042 authed / ≤0.0006 anon (neg-control). Still blind to opacity/same-box flashes (CLS reads 0
  // on those — Lamun's pixel-L3 closes that) and to routes outside pages/v2/** (→ too-static).
  // HYGIENE (Lamun forward-note): 0.015 is a shared floor, valid only while every route's baseline is
  // well under it. When adding a route, re-run the baseline sweep; if one legitimately approaches 0.015
  // (heavy async content), give it its OWN budget — do NOT switch to a dynamic per-run baseline (that
  // is circular: the flash you're hunting would be baked into the baseline).
  test("full-route crawl: no /v2 route hydration-mismatches (console+CLS × authed+anon — inline-identity backstop)", async ({
    browser,
  }) => {
    test.setTimeout(180_000); // crawls every /v2 route × {authed, anon} — many sequential loads, past the 30s default
    const bad: string[] = [];
    for (const route of allV2Routes()) {
      for (const authed of [true, false]) {
        const state = authed ? "authed" : "anon";
        const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
        const p = await ctx.newPage();
        const { hydrationErrors, cls } = await loadAndObserve(p, route, authed);
        if (hydrationErrors.length) bad.push(`${route} [${state}] console: ${hydrationErrors[0]}`);
        if (cls >= CLS_BUDGET) bad.push(`${route} [${state}] mount-flash: CLS ${cls.toFixed(4)} ≥ ${CLS_BUDGET}`);
        await ctx.close();
      }
    }
    expect(
      bad,
      `/v2 route(s) hydration-mismatch — likely inline useCurrentUser/MEMBER_ID-cookie gating without a ` +
        `mount-gate (route reaches auth-behaviour outside useV2AuthGate):\n  ${bad.join("\n  ")}`,
    ).toEqual([]);
  });

  // ── Runtime lens (goo, BLOCKING): zero hydration signal on the console/pageerror channel.
  // ── Visual lens (มุน, BLOCKING for geometry-shift): mount-flash CLS within budget — an INDEPENDENT
  // signal (mut-cls-silent-flash proved CLS catches a console-silent geometry flash). One test per
  // (path, state) for precise failure locality.
  for (const [path, seeds] of Object.entries(STATE_MAP)) {
    for (const seed of seeds) {
      const label = `${path} [${seed.authed ? "authed" : "anon"}]${seed.mismatch ? " (mismatch site)" : ""}`;
      test(`hydrates clean: ${label}`, async ({ page }, testInfo) => {
        const { hydrationErrors, cls } = await loadAndObserve(page, path, seed.authed);
        testInfo.annotations.push({ type: "cls", description: `${label}: CLS ${cls.toFixed(4)} (budget ${CLS_BUDGET})` });
        // Console lens — catches the structural mismatch (blind to a console-silent flash).
        expect(
          hydrationErrors,
          `hydration mismatch at ${label} (mount-gate missing?):\n${hydrationErrors.join("\n---\n")}`,
        ).toHaveLength(0);
        // Visual lens — catches a geometry-shift flash the console lens misses (see CLS_BUDGET scope).
        expect(
          cls,
          `mount-flash at ${label}: CLS ${cls.toFixed(4)} ≥ budget ${CLS_BUDGET} (geometry-shift silent flash)`,
        ).toBeLessThan(CLS_BUDGET);
      });
    }
  }
});
