// Display-layer label overrides for bazi-sft-dataset's enrichment terms — public /calculator
// ONLY, per ฟีม's decision (#calculator-enrich-ggg-dispatch, 2026-07-15). Does not touch
// dataset/compute/layout: bazi-sft-dataset's response and mootech-fe's data flow are unchanged,
// this only maps two specific strings at render time.
//
// Root cause (found by มุน's pixel-verify): these are correct, deliberate practitioner terms in
// bazi-sft-dataset (TWELVE_QI_LABELS_TH / RELATION_ROLE_REACTION, meant for sinsae context) that
// happen to collide with real Thai words carrying a fortune-telling connotation when read cold by
// a general public audience — not a bug, a context mismatch. The original term is always kept in
// parentheses so the authentic vocabulary isn't lost, only softened for this one audience.
const QI_DISPLAY_OVERRIDE_TH: Record<string, string> = {
  ซวย: 'ระยะถดถอย', // 衰 (decline stage) — collides with Thai "ซวย" = bad luck
}

const REACTION_DISPLAY_OVERRIDE_TH: Record<string, string> = {
  โชคลาภ: 'บทบาททรัพย์', // 財 (wealth-element role) — collides with Thai "โชคลาภ" = windfall
}

export function displayQi(raw: string): string {
  const override = QI_DISPLAY_OVERRIDE_TH[raw]
  return override ? `${override} (${raw})` : raw
}

export function displayReaction(raw: string): string {
  const override = REACTION_DISPLAY_OVERRIDE_TH[raw]
  return override ? `${override} (${raw})` : raw
}
