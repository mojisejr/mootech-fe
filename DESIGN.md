# MuMate — DESIGN.md (v3 · V3 redesign · full-Figma capture)

> **Supersedes v2** — preserved verbatim at [`docs/archive/DESIGN-v2.md`](docs/archive/DESIGN-v2.md); v1 at [`docs/archive/DESIGN-v1.md`](docs/archive/DESIGN-v1.md) (Rule 1 — nothing deleted).
>
> **Status:** ✅ ACTIVE (v3) — authored by Lamun 2026-07-20, **delegated authority from `o`**. Working contract for the V3 redesign.
>
> **Why v3:** v2 was written before the Figma file was duplicated into ฟีม's team, so **Pro Figma (deep `get_design_context`) wasn't available** → its tokens/atmosphere were partly wrong (cyan mislabeled "legacy", "3-font", "flat-only", element hex deferred). v3 is built from a **full deep extraction of every section** (onboarding, Service, Calendar, Payment, Couple's Horoscope, my-destiny) + all component sets, via the Pro/Dev seat on the working copy `hEOnE9S6wLkMhb0Iy2Fe6T`.
>
> **This is a COMPLETE CAPTURE, not a trimmed contract** (per ฟีม 2026-07-20): every token/variant/aesthetic observed in Figma is documented here — including my-destiny's legacy glass world — so we never re-read Figma. What to change/drop is decided **at build time**, per screen, not here. Deferred calls are listed in §14.
>
> Source: Figma **Mumate app - V3 (Copy)** `hEOnE9S6wLkMhb0Iy2Fe6T` · structure + code map: [`docs/figma-map.md`](docs/figma-map.md)
> Evidence: `✓` observed in Figma/code · `~` inferred · `?` not yet confirmed

---

## 1. Atmosphere — what MuMate V3 feels like

**Navy + electric-lime + cyan accent. Flat baseline with defined depth moments. Thai-first, mobile (375–393px).** Modern & confident, mystical but crisp — not the soft-glassy teal of v1. The signature beat: **sapphire button + lime label** (high energy, used sparingly); **cyan** carries actions/links; the rest stays calm.

**Depth is deliberate, not ambient** (§4): flat is the default; a defined set of components earns depth (bottom sheet, grade pill glow, Mate AI, glass "safety" block, my-destiny result cards). Base depth still comes from **bg contrast** (ghost-white ↔ white card).

**Per-context worlds** (§11): most screens are sapphire/lime/cyan flat-crisp. **my-destiny (`626-2004`)** currently renders in a distinct **legacy glass world** (teal-pink, glassmorphism, Noto Sans Thai). Captured as-is here; whether to reskin it to the main world is a build-time call (§14).

---

## 2. Color tokens `✓`

### Brand / accent
| Token | Hex | ใช้ที่ |
|---|---|---|
| `sapphire` (primary) | `#1455A4` | ปุ่มหลัก fill, active nav tab, checkbox fill, accent heading, avatar badge, link text |
| `sapphire-hover` | `#10427F` | hover/pressed ของ primary |
| `lime` (energy) | `#E1FF00` | ตัวอักษรบนปุ่ม sapphire, active-tab label, secondary-button fill, focus ring · ⚠️ ห้ามเป็น fill บนพื้นขาว |
| `cyan` (action/link) `✓ promoted` | `#1B9AAF` | **accent หลัก** — service link, notif btn, info icon, intent selected-card, grade text, PDF button, sheet header. v2 เรียก "legacy" ผิด — จริงเป็น action color |
| `pumpkin` | `#FF6800` | home hub accent, "ควรเลี่ยง" heading |

### Surface & text
| Token | Hex | ใช้ที่ |
|---|---|---|
| `bg` ghost-white | `#ECF0FD` | พื้น page (app screens), tile-icon chip, service-card fill (inverted) |
| `bg-cream` warm | `#FAF7F4` | พื้น payment/couple's sheet, self-row, my-destiny · coexists กับ ghost-white |
| `surface` white | `#FFFFFF` | card, input, sheet, calendar tab track |
| `text-title` | `#0B305B` | หัวข้อจอ (Oxford Navy) · *(Figma var `#1f2937` = home-indicator fill เท่านั้น คนละตัว)* |
| `text-body` | `#464646` | เนื้อความ / label |
| `text-body-alt` | `#4B5563` | input label (Field 308-88) |
| `text-muted` | `#71717A` | list-item รอง, characteristics rows |
| `text-detail` | `#888888` | body บน glass block (safety, my-destiny) |
| `placeholder` | `#9CA3AF` | placeholder pill input `✓` (ยืนยัน ไม่ใช่ #94A3B8) |
| `text-filled` | `#212121` | ค่าที่กรอกแล้ว |
| `text-price` | `#1F2937` | จำนวนเงิน bold (payment) |

### Semantic & border
| Token | Hex |
|---|---|
| `error` | `#E73E3E` · legacy input error `#C13515` |
| `focus-border` | `#3475E2` (input) · `#222` shade-02 (dropdown/link) |
| `link-legal` | `#004CC4` (legal link) |
| `border-input` | `#E5E7EB` · checkout `#D1D5DB` |
| `border-card` | `#E9EAEB` · warm `#E0DEDB` / `#E5E3E0` |
| `disabled-bg` | `#DDDDDD` |
| `border-dropdown` | `#B0B0B0` · `border-checkbox` `#C2C2C2` |
| `tab-track` | `#EBEBEB` · `tab-focus` `#F7F7F7` · `dropdown-label` `#717171` |

### Nav / Mate AI (dark surface + gradients) `✓`
| Token | Value |
|---|---|
| `nav-dark` | `#1A1A1A` (menubar bar bg) |
| `nav-border` | `rgba(216,143,169,0.4)` 5px pink |
| `nav-label-off` | `#FAF7F4` (default tab labels) |
| `mate-ai-base` | `linear-gradient(141deg, #1455A4 3%, #187CAA 50%, #6F1BAF 122%)` + lime `#E1FF00` overlay |
| `mate-ai-text` | gradient `#1455A4 → #e913c5` (magenta) |

### Home pastel tiles `✓`
`#E0FFC4` · `#C1E6F8` · `#C9E4F4` · `#ECD9FB` · `#FBD9E7` · `#F1FF75` (grade-yellow) · `#91D8D2` · `#F9F4F0` (lemon-chiffon) · `#E3ECFB` (endeavour-100)

### Semantic scale — GRADE (10-step, grade cards + couple's aspects) `✓`
| Grade | Card bg | Accent/badge | note |
|---|---|---|---|
| A Excellent | `#E8F5E9` | `#2E7D32` | |
| B+ | `#EDF7ED` | `#43A047` | |
| B | `#F0F8F0` | `#66BB6A` | |
| B- | `#F1F8E8` | `#8BC34A` | |
| C+ | `#F9FBE7` | `#CDDC39` | badge text `#374151` (dark, contrast exception) |
| C | `#FFF3E0` | `#FFA726` | |
| C- | `#FFF0E1` | `#F57C00` | |
| D+ | `#FBE9E7` | `#E64A19` | |
| D | `#FFEBEE` | `#D32F2F` | |
| D- | `#FCE4EC` | `#B71C1C` | |

### Semantic scale — CALENDAR day-cell (3-tier) `✓`
| Tier | Cell tint | %-text |
|---|---|---|
| Good ≥60% | `#E2F4F6` | `#0B7A8C` |
| Medium 40–59% | `#FEF1E0` | `#B47E35` |
| Bad <40% | `#FEE7E4` | `#CD3D2E` |

Calendar markers: selected-day / วันพระ ring `#9D85DA` (≠ Accent/Purple `#AF9CE0`).

### my-destiny legacy palette (`626-2004`, captured as-is) `✓`
Endeavour blues `#4B96E5 / #2479D3 / #E3ECFB` · chart gradient teal→pink `#1AB1C0 → #FBD9E2 → #4B96E5` · light teal `#AEF0F3 / #B8EBF4`. Glass fills `rgba(255,255,255,0.65)` + teal glow `#1B9AAF26`.

### Element colors — TWO palettes (serve different jobs) `✓`
| ธาตุ | ICON (bright, decorative — chips/glyphs) | TEXT (`elements.ts`, WCAG ≥4.5:1 on white) |
|---|---|---|
| ไม้ WOOD | `#55B43F` | `#237753` |
| ทอง METAL | `#EBBF30` | `#8A5E12` |
| ไฟ FIRE | `#DC2727` | `#C4341F` |
| ดิน EARTH | `#DC8B43` | `#5F5326` |
| น้ำ WATER | `#14ADFF` | `#2C55A6` |

⚠️ On result screens the **element NAME renders neutral `#464646`** — color lives only in the 24px icon glyph. Bars in `626-2004` share one gradient (no per-element hex). Canonical hex = `lib/calculator/elements.ts`.

---

## 3. Typography `✓` (v2's "3-font" was wrong — real stack below)

| Family | บทบาท | หมายเหตุ |
|---|---|---|
| **IBM Plex Sans Thai** | **primary** — Thai body/label/heading/button/input (onboarding, Service, Calendar, Payment) | canonical Thai `~` (majority + primitives ใช้อยู่) |
| **Poppins** | ปุ่ม disabled label, dropdown label, **Links primitive** | Latin-master |
| **Inter** | menubar tab labels (SemiBold 14/20), home hub ตัวเลข (Black/Bold) | Latin-master; ไม่ได้จดใน v2 |
| **Noto Sans Thai** | **DOMINANT บน my-destiny `626-2004` เท่านั้น** (~33×) | build-time: normalize → IBM Plex เมื่อ reskin (§14) |
| **DM Sans** | checkout card-form (payment) | Untitled-UI artifact → map → IBM Plex ตอน build |
| **Chonburi** | ใช้ **ครั้งเดียว** — mascot display name "A PORCELAIN SWAN" 32px | var `Font-Chonburi` จริง = "IBM Plex Sans Thai" → decorative only, ไม่ใช่ display หลัก |

### Ramp `✓` (expanded)
| Style | Font / weight | Size / lh | Case |
|---|---|---|---|
| Display | Chonburi/IBM Plex 700 | 32 / 32 | UPPER (mascot name, couple's headline) |
| H1 | IBM Plex Bold 700 | 24 / 32 | — |
| H2 | Bold 700 | 20 / 28 | — |
| H3 | Bold 700 | 18 / 24 | — |
| H4 | Bold 700 | 16 / 24 | — |
| Body Large | Regular 400 | 16 / 24 | — |
| Body Medium | **Medium 500** | 15 / 22 · 14 / 20 | — |
| Body Regular | Regular 400 | 14 / 22 | — |
| Label | SemiBold 600 | 14 / 20 | — |
| Label Bold | Bold 700 | 14 / 20 | — |
| Button | Bold 700 | 16 / 24 | UPPERCASE |
| Button Small | SemiBold 600 | 14 / 20 | UPPERCASE |
| Helper | Regular 400 | 12 / 18 | — |
| Caption / tiny | Regular 400 | 8–13 (calendar chart, ganzhi) | — |

Letter-spacing 0 (ยกเว้น display 0.64px).

---

## 4. Radius & elevation `✓`

### Radius (expanded — v2 too sparse)
| Token | ค่า | ใช้ที่ |
|---|---|---|
| pill | `100px` | button, input, badge |
| chip | `6px` | icon chip (characteristics) |
| checkbox | `4px` (focus 8) | |
| thumbnail / grade-pill | `8px` | service thumbnail, grade pill, legacy input |
| day-cell | `11px` | calendar |
| method / connect-chip | `12px / 10px` | payment method, connect row chip |
| date-dropdown | `14px` | calendar date selector (⚠️ ≠ dropdown 8) |
| card | `16px` | standard card, breakdown/characteristics card, menubar tab |
| feature card | `20px` | calendar/notif/result-section card |
| service / mascot / upload / big-card | `24px` | service card, mascot card, upload row, day-master glass card |
| sheet / daily-card | `28px` | bottom-sheet top corners |
| screen frame | `40px` | |
| profile-row / icon-btn | `44–56px` | round icon buttons, dual-profile rows |
| home tiles | `104 / 128px` | donut ring, home hub pills |

### Elevation — flat baseline + defined depth `✓ (decided)`
Default = **flat** (depth from bg contrast). These components **earn** depth (the only sanctioned set):
- **Bottom sheet**: `0 8 20 rgba(0,0,0,.25)` + top-corner 28
- **Grade pill**: cyan glow `0 4 8 rgba(117,227,235,.5)`
- **Card shadows** (calendar/payment/result): `0 4 30 rgba(26,38,77,.12)` / `0 4 14 rgba(26,38,77,.06)`
- **Colored CTA** (PDF/Share): soft colored `0 6 14 rgba(<btn>,.24)`
- **Mate AI + menubar**: backdrop-blur 6.8 + pink border
- **Glass blocks** (safety "ปลอดภัย 100%", my-destiny cards): `rgba(255,255,255,.65)` + backdrop-blur 22 + teal glow `#1B9AAF26`
- **Selected tab** (neutral pill-tabs): `0 6 8.5 rgba(0,0,0,.08)`
- **Promo card**: `0 6 16 rgba(51,46,115,.28)`

---

## 5. Spacing scale `✓`
`4 · 8 · 12 · 16 · 20 · 24 · 28 · 32`
- label↔field **8** · field-stack **20** · birth-row cell **4** · checkbox↔text **8** (pdpa uses 12) · section **32** · footer **24** · card inner **16–24**
- content padding: **`px-24`** (pdpa, app) / **`px-32`** (splash, register, profile, intent) — ไม่ uniform, จดทั้งสอง

---

## 6. Primitives — Button / Input / Dropdown / Checkbox / Pill Tabs `✓`

### Button (5 variants — code มีแค่ primary ตอนนี้ → ต้องเพิ่ม)
Radius `100px` · icon gap **4px** · focus **per-variant** (ไม่ใช่ rule เดียว) · disabled `#DDDDDD` (label: full=Poppins/SF-Pro SemiBold, small=Poppins 13).

| Variant | Default | Hover/Pressed | Focus | Label |
|---|---|---|---|---|
| **Primary** | fill `#1455A4` / text `#E1FF00` | `#10427F` | 2px lime ring บน `#222` (box→60px) | IBM Bold 16/24 UPPER |
| **Secondary** | fill `#E1FF00` / text `#1455A4` | **ไม่ darken** (lime เดิม) | 2px `#D3D3D3` บน lime, inner **r8** | IBM Bold 16/24 UPPER |
| **Tertiary** (outline/social) | transparent + 1px `#1455A4` border / text `#1455A4` | tint `rgba(34,34,34,.05)` | **2.5px `#1455A4`** border | IBM Bold 16/24 UPPER · +Google icon 24 absolute |
| **Colored CTA** (PDF/Share) | fill `#1B9AAF`/`#1455A4` / text **white** + soft shadow | — | — | IBM Bold 16, icon 20 gap8, h56 |
| **Link** | text `#1455A4` (subtle) / `#004CC4` (legal) | — | 2px `#222`/`#004CC4` r2–4 | **Poppins SemiBold**, non-upper; small=underline |

### Input / Field (pill) `✓ = input.tsx (near-match)`
h`52` · r`100` · pad 20H/14V · white · label 14/20 SemiBold · placeholder 16/24 · trailing icon 20 · helper 12/18.
| State | Border | อื่นๆ |
|---|---|---|
| Default/Hover | `1px #E5E7EB` | placeholder `#9CA3AF` · **label `#4B5563`** · **helper `#9CA3AF`** (v3 fix) |
| Focus | `2px #3475E2` | |
| Filled | `1px #E5E7EB` | value `#212121` |
| Error | `2px #E73E3E` | label+helper `#E73E3E` |

> Node `300-701` "Input" = **legacy family** (dropdown tokens, r8, `#717171` placeholder, `#C13515` error) — **superseded** by Field `308-88`. Don't build from it.

### Dropdown `✓ = dropdown.tsx (match)`
r`8` · w520 · pad 12H/16V · placeholder Poppins 16 `#222` · label SF Pro 12 `#717171` · chevron 16.
Default/Hover `1px #B0B0B0` · Focus `2px #222` · Loading `1px #B0B0B0` + ellipses.

### Checkbox `✓`
box `24×24` r`4` · check 16. Unselected `1px #C2C2C2` → hover/focus `1px #1455A4` · Checked `#1455A4` fill + white · Focus box `32×32` r8 + 2px ring. Supports label 16/24 + description.

### Pill Tabs — TWO variants `✓`
- **Neutral** (`375-10888` = `pill-tabs.tsx`): track `#EBEBEB`, seg pad 12H/8V r500 w151, label Poppins SemiBold 14 `#222`, **selected = white + shadow** `0 6 8.5 rgba(0,0,0,.08)`, focus `#F7F7F7` + 2px `#222`.
- **Calendar/semantic** (`375-17085`): track **`#FFFFFF`**, default seg **fill `#F9F4F0` + text `#1455A4`**, **selected = sapphire `#1455A4` fill + lime `#E1FF00` text, no shadow**, seg w127. → needs a `variant` prop (existing PillTabs won't render this).

---

## 7. Components `✓` (from full-Figma capture — spec ครบ)

**Nav / global**
- **Menubar** (`461-3097`): dark `#1A1A1A` floating pill 273×70 r16, pink 5px border `rgba(216,143,169,.4)`, blur 6.8, pad8. 4 tabs (หน้าหลัก/บริการ/ปฏิทิน/ร้านค้า) w58 icon16 + Inter SemiBold 14/20. States: default(dark) / hover `#0B305B` / **active `#1455A4` fill + `#E1FF00` label**.
- **Mate AI FAB** (`461-3020`): 74×70 r16, lime `#E1FF00` over 141° base gradient, pink border. Label chip gradient-text (`#1455A4→#e913c5`). Mascot 75×92 overflow-bottom.
- **Dots pager**: 40×32, active dot cyan.

**Onboarding**
- **Property Type / intent tile** (`284-1261`): flex-1 r16 pad16H/24V, icon32 gap8. default(white + sapphire icon/label) / **selected(cyan `#1B9AAF` bg + white)**. Label SemiBold 14/20 UPPER.
- **PDPA icon-row**: white card r16 pad16 gap16 + ghost-white 48px chip r16 (24px icon); title Bold16/24 + body Regular14/22.
- **Avatar upload circle**: 110px + 32px sapphire camera badge r16 (2px white border, 16px icon).
- **Glass Detail block** ("ปลอดภัย 100%"): r16 pad24 gap12, white@65% + blur22 + border `#E9EAEB`. title Chonburi/IBM Bold 16 + body `#888`.

**Service / Home**
- **Service card**: w361 r24, bg ghost-white `#ECF0FD` on white page, pad24 gap16; title Bold18/24 `#0B305B` + desc **Medium**14/20 `#464646` + cyan "ดูดวงเลย →" link + thumbnail 122×90 r8.
- **Grade pill** (header): 84×32 r8 bg `#F1FF75` + cyan glow, text Medium16/24 `#1B9AAF`.

**Calendar**
- **Grade Card** (`636-21251`): w329 r16 pad12H/10V gap5, bg = grade tint. Header: title Bold16/24 (flex-1) + `%` in grade color + badge pill (w48 pad10H/3V r100 fill=grade, label Bold16 white [C+ dark]). Desc Regular14/22 `#71717A`.
- **Bottom Sheet** (`636-10221`): bg `#F9F4F0` top-r28, pad pt32/px16/pb120, gap18, no scrim (sits on cyan). Header title H1 white + close btn (40 r44 `#1190A5`). Success banner `#0B305B` + shadow. Notif cards: white/`#E5E3E0` border r20 + shadow, app-chip `#1455A4`, Google chip `#EAF0FA`.
- **Calendar grid / day cell**: grid card white r20 pad16 gap14 + shadow. Cell flex-1 r11 py3, tint by 3-tier. day# Bold13 `#0B305B` + ganzhi Regular8 `#1455A4` + %Bold12. Selected: `#1455A4` fill + 1.6px `#9D85DA` ring, white text. Legend swatches r5.

**Payment**
- **Price summary card** (`402-21909`): white r20 pad16 gap16 + shadow. Rows label/amount justify-between, `#E0DEDB` dividers, total Bold16 amount `#1455A4`. Plan avatar 38px gradient (`#1455A4→#9D85DA`) 👑 + "เปลี่ยน" link.
- **Payment-method selector**: 3 cards r12 pad16 gap14, selected 2px `#1455A4` / unselected 1px `#E5E7EB`, icon chip `#F3F4F6` r6.
- **Checkout input row**: pill r100 1px `#D1D5DB`, label `#4B5563` DM Sans 14, brand icon 20. Checkbox 20px here.
- **Secured footer**: shield + `#BFBFBF` 12 + Omise logo.

**Couple's Horoscope** (new/in-scope)
- **Dual-profile picker** (`636-17832`): 2 rows h60 r56 — self `#FAF7F4`, add `#ECF0FD` + dashed 1px `#1455A4` placeholder. + primary button + `#1B9AAF` "ล่าสุด" link.
- **Birth-input sheet** (`636-18534`): cream sheet + grabber + form (same as profile-setup) + glass Detail block + upload row `#ECF0FD` r24 + connect-account rows.
- **Connect-account row**: white h64 r24 + brand chip 36 r10 (FB `#1A78F2` / Invite `#1B9AAF` / Contacts `#8C6BD9`).
- **Result section card** (`636-19595`): white r20 pad16H/24V + shadow, collapsible header + hairline + content (grade cards / list rows on `#F9F4F0`).

**my-destiny (result payoff)** — captured as-is (legacy glass world)
- **Mascot card**: 327×453 r24, object-cover card art, no bg/border. asset `cards/NN_นักษัตร-ธาตุ`.
- **Element-breakdown card**: white r16 pad16H/24V, 6 rows w/ hairline, each = label + element-chip + cyan info-icon 19px.
- **Element chip**: 24px bright-icon + gap8 + neutral `#464646` label.
- **Characteristics / Recommendation card**: white r16 pad16 gap16, title Bold16/24, rows ghost-white 20px chip r6 (12px icon) + `#71717A` 14/22.
- **Mascot hero banner** (`626-2009`): full-bleed 375×563 art + Chonburi 32px name overlay + 5 skill-strength bars (r50 pill, gradient fill).
- **Luck-curve chart** (`626-3060`): 672×296 r16, bg gradient `#E3ECFB→#FDE6EB`, line chart age 0-85, node chips r32 Noto 10px `#4B96E5`, 11 life-stage labels.
- **Glass day-master card** (`626-2014`): white@65% blur22 r16 pad24 + teal glow. title cyan Bold16/24 + `#888` body + element rows.
- **Referral banner** (`626-2011`): gradient card (blue→pink @65%) blur22 r16, gift icon 56 + copy.

---

## 8. Personalization layer `✓`

### DECISION C (locked 2026-07-19) — นักษัตรปีเกิด + ธาตุ day-master
mascot ผสม 2 แกน เพื่อให้ตรงกับ "ธาตุของคุณ" ที่จอ result โชว์:
- **นักษัตร** = year animal (`yearOfZodiac.below` glyph → Thai นักษัตร)
- **ธาตุ** = day-master element (`enrichment.dayMasterElement`, ตัด polarity ไม้หยิน→ไม้)
- ❌ ไม่ใช้ year element (mascot จะไม่ตรง headline)

### Resolver — สร้างแล้ว PR#71 (`lib/personalization/`, 20 tests) `✓`
`buildMascotPaths(animal, element)` → `NN_นักษัตร-ธาตุ` → `characters/*.png` (no bg) / `cards/*.jpg` (bg).
⚠️ resolver **ยังไม่มี production screen ใช้** — มีแค่ showcase + test. my-destiny ดึง mascot จาก **backend** (`resultSummary.mascot.url`) ไม่ผ่าน resolver → build-time: ตัดสินว่า resolver ไปเสียบจอไหน (public calculator ที่ใช้ `compute.ts`?) หรือพึ่ง BE (§14).
⚠️ `enrichment.dayMasterElement` = **best-effort** (timeout 5s → null) → ต้องมี static fallback.

### ⚠️ Assets architecture (verified codebase 2026-07-20) — สำคัญ
- **mascot/card art (dynamic personalization)** = **cloud S3/CDN → BE ส่ง url** (`next.config` domains: `s3-ps-cdn...amazonaws.com`, `cdn.phoenix-stark.com`; `resultSummary.mascot.url`). **ไม่ใช่ commit เข้า repo.** → V3 art 60+60 ต้องอัป S3 + BE swap url (งาน goo/BE, §14).
- **bg (BG0–BG4) + icons + UI chrome** = static local `/public/images/` (repo). bg เลือกต่อจอตอน build (ฟีม บอก BGn).
- `/public/images` local = 16M/181 = static chrome only.

---

## 9. Layout principles `✓`
- mobile-first **375–393px** · screen r40
- โครงจอ: **Status Bar** (44) → **Nav** (back + dots) → **Main Content** (`px-24` หรือ `px-32`) → **Footer** (ปุ่ม + Home Indicator)
- **bottom Menubar** (หน้าหลัก/บริการ/ปฏิทิน/ร้านค้า + Mate AI FAB) มี state
- bg = static `BG0–BG4` เลือกต่อจอ (ไม่ personalize); ฟีม ระบุ BGn ตอน build

### 9.1 Container contract `✓` (v2 — บังคับด้วย typed wrapper, กัน bg-บีบ/max-width)
ทุกจอ v2 = **หนึ่งใน 2 wrapper เท่านั้น** (`features/v2-shell/components/`) — ไม่ hand-roll, ไม่ผสม.
มาจาก slice-1 post-mortem: จอ full-bleed ถูก mount ใน `max-w-md` ของ AppShell → `Image fill` เต็มแค่กล่อง ไม่ใช่ viewport → **bg บีบ**. wrapper ทำ contract เป็น**โครง** ผิดไม่ได้.

| wrapper | ใช้เมื่อ | ให้อะไร | ห้าม |
|---|---|---|---|
| **`<FullBleedScreen>`** | จอ own viewport + photo bg, ไม่มี nav | `min-h-[100dvh]` เต็มจอ + bg (fill + fallback) + content column ไม่ clamp | max-w, AppShell, Menubar |
| **`<AppScreen>`** | จอในแอป (มี nav) | AppShell (max-w-md + bottom Menubar) | — |

**Mapping ต่อจอ:**
| จอ | wrapper | bg |
|---|---|---|
| onboarding / splash | `FullBleedScreen` | BG1 (photo) |
| login (`/v2/login`) | `FullBleedScreen` | BG3 (photo) |
| register (`/v2/register`) | `FullBleedScreen` | BG3 (photo) หรือ ghost-white |
| intent-check · pdpa | `FullBleedScreen` | ghost-white/photo (slice 2) |
| destiny result | `FullBleedScreen` หรือ `AppScreen` (เคาะตอน build) | photo/cream |
| home · service · calendar · shop | `AppScreen` | ghost-white/white + Menubar |

> Verify gate (§verify-before-PR): design-verify ต้องรันบน **route จริง @393** ไม่ใช่ component แยก — isolated ไม่นับว่า verified. ดู [[design-verify-must-be-integrated-screen]].

---

## 10. Screen inventory `✓` (Figma ↔ ดู figma-map สำหรับ code map)
| Section | node | โลก aesthetic | bg |
|---|---|---|---|
| Onboarding (splash→register→profile→intent→pdpa→destiny→home) | `298-475` | main (sapphire/lime/cyan flat) | photo (splash/register), ghost-white |
| Service + Home hub | `333-7244` | main | ghost-white / white |
| Calendar | `333-4409` | main + card shadows | white |
| Payment | `375-20340` | main + cream | cream `#FAF7F4` |
| Couple's Horoscope (new) | `480-4548` | main + cream sheets | cream |
| my-destiny (X17) | `626-2004` | **legacy glass** (teal-pink, Noto, blur) | white/cream |

---

## 11. Delta from v2
| มิติ | v2 | v3 |
|---|---|---|
| cyan | "legacy/demoted" | **action/link accent** (โปรโมท) |
| elevation | flat-only | **flat baseline + defined depth set** |
| fonts | "3 fonts" (IBM/Poppins/Chonburi) | **IBM Plex + Poppins + Inter** (+Noto บน my-destiny, Chonburi decorative) |
| element hex | deferred to elements.ts | **2 palettes** (bright icon + WCAG text) documented |
| bg | flat ghost-white only | **ghost-white + cream + photo BG0-4** |
| semantic scale | — | **grade 10-step + calendar 3-tier** |
| Button | primary only | **+ secondary/tertiary/colored-CTA/link** |
| radius | 6 steps | **13 steps** (8/11/12/14/20/24/28/44/56/104/128) |
| components | 6 primitives | **+ ~20 component specs** |
| assets | "track in repo" | **mascot→S3/BE · bg/chrome→repo** |
| coverage | onboarding+partial | **ทุก section (Pro-clone deep)** |

**คงจาก v2:** sapphire+lime signature, mobile-first, Thai-first, decision C, rounded organized cards.

---

## 12. Open decisions — deferred to build-time (§per ฟีม: capture now, decide later)
1. **my-destiny world** — reskin `626-2004` glass/Noto → main world, หรือคงไว้เป็น result-world? (ควรถาม o)
2. **Resolver placement** — เสียบ public calculator (`compute.ts`) หรือพึ่ง BE mascot url?
3. **V3 mascot art → S3** — coordinate goo อัป + BE swap url (assets 60+60)
4. **Chonburi** — เก็บ decorative single-use หรือตัด
5. **DM Sans / Noto** — normalize → IBM Plex ตอน build จอนั้น
6. **element-domain "ดิน" ซ้ำ 2 แถว** (destiny) — น่าจะ source bug ของ o copy — ยืนยันก่อนแก้
7. **bg ต่อจอ** — ฟีม ระบุ BGn ตอน build แต่ละจอ

---
🤖 authored by Lamun Oracle · delegated from `o` · v3 full-Figma capture · active contract for V3 redesign
