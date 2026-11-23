// ปีชง 2570 (revision 0.12): "อยากรู้ลึกกว่านี้" sends a member to เสี่ยวมู่ first, not to the package page.
// The chat sells on its own once the QI runs out (ChatScreen: เติม Qi → /v2/qi/buy).
// The chat needs a saved birth (409 profile_incomplete), and a birth typed on this page is not saved,
// so a typed chart goes to registration instead.
export const DEEPER_CHAT = '/v2/chat'
export const DEEPER_REGISTER = '/v2/register'
export const DEEPER_PACKAGES = '/v2/shop'

export function deeperHref(source: 'saved' | 'typed'): string {
  return source === 'saved' ? DEEPER_CHAT : DEEPER_REGISTER
}
