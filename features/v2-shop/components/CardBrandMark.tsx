// features/v2-shop/components/CardBrandMark.tsx — the 20x20 glyph that sits in the card number field
// (mootech-fe#491, DESIGN.md:359 gives the checkout row a 20px brand icon).
//
// 🔴 THESE ARE SIMPLIFIED MARKS, NOT OFFICIAL BRAND ASSETS. lucide-react ships no brand logos and this
// repository holds no licensed artwork, so each mark below is drawn to be recognisable at 20px rather
// than to be the trademark. Swapping in real files is a separate ticket with real assets; nothing here
// should be read as having delivered brand-accurate logos.
//
// Every mark carries the full brand name as its accessible name, so a screen reader announces "Visa"
// rather than announcing nothing — the visual mark is the shortcut, not the only channel.
import type { CardBrand } from '../card-rules'

const LABEL: Record<Exclude<CardBrand, 'unknown'>, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  jcb: 'JCB',
  unionpay: 'UnionPay',
  discover: 'Discover',
  diners: 'Diners Club',
}

/** Short text marks for the brands whose identity IS a wordmark; 20px cannot carry more than a few glyphs. */
const TEXT: Record<Exclude<CardBrand, 'unknown' | 'mastercard'>, { text: string; fill: string }> = {
  visa: { text: 'VISA', fill: '#1A1F71' },
  amex: { text: 'AMEX', fill: '#006FCF' },
  jcb: { text: 'JCB', fill: '#0E4C96' },
  unionpay: { text: 'UP', fill: '#E21836' },
  discover: { text: 'DISC', fill: '#F76B1C' },
  diners: { text: 'DC', fill: '#0079BE' },
}

export function CardBrandMark({ brand }: { brand: CardBrand }) {
  if (brand === 'unknown') return null
  const label = LABEL[brand]

  // Mastercard is the one brand whose identity is geometry rather than letters, and two interlocking
  // circles stay legible at 20px where four letters do not.
  if (brand === 'mastercard') {
    return (
      <svg data-testid="card-brand" role="img" aria-label={label} viewBox="0 0 32 20" className="h-5 w-5">
        <title>{label}</title>
        <circle cx="13" cy="10" r="7" fill="#EB001B" />
        <circle cx="19" cy="10" r="7" fill="#F79E1B" fillOpacity="0.85" />
      </svg>
    )
  }

  const { text, fill } = TEXT[brand]
  return (
    <svg data-testid="card-brand" role="img" aria-label={label} viewBox="0 0 32 20" className="h-5 w-5">
      <title>{label}</title>
      {/* The slot is a fixed 20x20 square and a wordmark is wide, so the viewBox is letterboxed and the
          glyphs are sized to fill it. At 8px the mark read as a smudge in the captured route image. */}
      <text
        x="16"
        y="15"
        textAnchor="middle"
        fill={fill}
        fontSize={text.length > 3 ? 11 : 13}
        fontWeight="800"
        letterSpacing="-0.5"
        fontFamily="system-ui, sans-serif"
      >
        {text}
      </text>
    </svg>
  )
}

export default CardBrandMark
