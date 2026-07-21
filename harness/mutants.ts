// harness/mutants.ts — Frame-v2 mutant injections. The PROOF-OF-TEETH.
// Each injection reproduces a real shipped bug at runtime (CSS !important override). The harness
// MUST fail the mapped anchor — if it stays green, the gate is blind and the harness is just belief.
export const mutantCss: Record<string, string> = {
  // object-cover → fill : the exact bg-stretch ฟีม caught on device
  'mut-objectfit-fill': 'img[src*="BG"]{object-fit:fill!important}',
  // pt-10 → 0 : logo jammed to the top edge
  'mut-no-top-pad': 'div.mx-auto.max-w-md{padding-top:0!important}',
  // max-h ignored : mascot balloons past its cap
  'mut-hero-uncapped': 'img[src*="mascot"]{max-height:none!important;height:80vh!important;width:auto!important}',
}
