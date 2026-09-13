// Beam lane slice 4 — the ONE place a screen turns a gateway name into the word a person reads. Both
// success screens and checkout ask here, so "ออกโดย" can never name Omise on a Beam order (or the reverse)
// in one place and not another. Absent/unknown ⇒ Omise, which is what every row before 0027 means.
export function gatewayLabel(gateway: string | null | undefined): 'Omise' | 'Beam Checkout' {
  return gateway === 'beam' ? 'Beam Checkout' : 'Omise'
}
