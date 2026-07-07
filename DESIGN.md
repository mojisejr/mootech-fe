---
design_md_version: 1
project: mootech-fe-fork
token_source: projects/mootech-fe-fork/tailwind.config.ts + projects/mootech-fe-fork/styles/globals.css
verify_tokens:
  - name: moumate_blue
    expect: "#1B9AAF"
    probe: "background-color on [data-testid=design-token-moumate-blue]"
  - name: moumate_blue_dark
    expect: "#4B96E5"
    probe: "background-color on [data-testid=design-token-moumate-blue-dark]"
  - name: moumate_blue_light
    expect: "#EEFDFD"
    probe: "background-color on [data-testid=design-token-moumate-blue-light]"
  - name: moumate_gray
    expect: "#888888"
    probe: "color on [data-testid=design-token-moumate-gray]"
  - name: moumate_black
    expect: "#101828"
    probe: "color on [data-testid=design-token-moumate-black]"
  - name: moumate_white
    expect: "#FFFFFF"
    probe: "background-color on [data-testid=design-token-moumate-white]"
  - name: moumate_red
    expect: "#CB2C2A"
    probe: "color on [data-testid=design-token-moumate-red]"
  - name: bg_gray
    expect: "#E9EAEB"
    probe: "background-color on [data-testid=design-token-bg-gray]"
  - name: border_gray
    expect: "#D5D7DA"
    probe: "border-color on [data-testid=design-token-border-gray]"
  - name: chat_surface
    expect: "#44588B"
    probe: "background-color on [data-testid=design-token-chat-surface]"
  - name: chat_header_to
    expect: "#3A78A9"
    probe: "background-color on [data-testid=design-token-chat-header-to]"
  - name: font_ibm
    expect: "IBM Plex Sans Thai"
    probe: "font-family on [data-testid=design-type-ibm]"
  - name: font_prompt
    expect: "Prompt"
    probe: "font-family on [data-testid=design-type-prompt]"
verify_eyes:
  - kind: web-eye
    gate: required
    sees:
      - rendered DOM and Tailwind-generated CSS for the dev-only design showcase
      - computed token values for verify_tokens
      - route URL, title, console warnings, and mobile/desktop viewport layout of the showcase
    does_not_see:
      - authenticated user journeys
      - Google, LINE, Facebook, Instagram, Omise, or production OAuth/payment behavior
      - production Vercel, backend, Supabase, Bazi, mobile native, or device truth
    artifact_sink: /Users/non/dev/opilot/.playwright-mcp/mootech-fe-fork/
    commands:
      - "Start Next dev server on an isolated free port from /Users/non/dev/opilot/projects/mootech-fe-fork"
      - "Open the dev-only showcase route created in Phase 3"
      - "Capture actual-design-tokens.json with keys matching verify_tokens"
      - "bun .github/skills/design-verify/scripts/classify-design-eyes.mjs projects/mootech-fe-fork/DESIGN.md"
      - "bun .github/skills/design-verify/scripts/audit-design-tokens.mjs projects/mootech-fe-fork/DESIGN.md /Users/non/dev/opilot/.playwright-mcp/mootech-fe-fork/RUN_ID/actual-design-tokens.json"
    claim_label: Browser/Web Truth Closed
primitives:
  - name: SkeletonRow
    file: components/ui/skeleton-row.tsx
    variants: [count]
patterns:
  - layered-token-architecture
  - material-surface-hierarchy
  - shape-vocabulary
  - skeleton-loading-system
---

# mootech-fe-fork — DESIGN.md

This is a brownfield extract of the current MuMate FE visual system. It records what the code already does today so future UI work checks existing tokens and primitives before inventing new styling.

## 1. Visual Theme & Atmosphere

MuMate is a Thai-first consumer fortune product with a friendly mystical tone. The current UI language is teal-led, rounded, soft, mobile-first, and image-supported: brand logo, mascot/card imagery, sparkles, package names, glassy maintenance/auth/error surfaces, and pill-like CTAs carry the identity more than dense data UI.

The design philosophy for this repo is: preserve the current MuMate look, name it honestly, and extract reusable truth before redesigning or refactoring.

## 2. Color Palette & Roles

| Token | Value | Role |
|-------|-------|------|
| `moumate_blue` | `#1B9AAF` | Primary brand teal for headers, CTAs, accents, links, selected states, and spinner accent |
| `moumate_blue_dark` | `#4B96E5` | Secondary blue for emphasis, graph accents, and older CTA surfaces |
| `moumate_blue_light` | `#EEFDFD` | Soft selected background for gender/cards/chips |
| `moumate_gray` | `#888888` | Secondary body copy and helper text |
| `moumate_black` | `#101828` | Primary readable text where tokenized |
| `moumate_white` | `#FFFFFF` | Form fields, cards, high-contrast text on brand color |
| `moumate_red` | `#CB2C2A` | Required marks, error/bad-state accents |
| `bg_gray` | `#E9EAEB` | Skeleton fill, table/header backgrounds |
| `border_gray` | `#D5D7DA` | Skeleton/table borders and low-emphasis outlines |
| `chat_surface` | `#44588B` | Full-screen chat body background |
| `chat_panel` | `#3a4a78` | Chat drawer/panel background |
| `chat_bubble_user` | `#4B4F88` | User chat bubble color |
| `chat_header_from` | `#2599AE` | Chat header gradient start |
| `chat_header_to` | `#3A78A9` | Chat header gradient end and slate-blue surface |
| `launcher_magenta` | `#FF00EE` | Chat launcher gradient end |

Common un-tokenized values still in active UI include `#F2F7FD`, `#444444`, `#D4F8F9`, `#F3FCA2`, `#E3ECFB`, and several feature-specific calendar/element colors. Treat these as known drift until a token-normalization phase explicitly names them.

## 3. Typography

- Primary app/body fonts: `font-ibm` (`IBM Plex Sans Thai`) and `font-prompt` (`Prompt`).
- Secondary/legacy fonts: `font-sarabun` (`Sarabun`), `font-chonburi` (`Chonburi`), and `font-poppins` mapped to `Noto Sans Thai`.
- Current usage skews heavily toward `font-ibm` for form/detail surfaces and `font-prompt` for landing/login/product surfaces.
- Typical body sizes: `14px` to `16px`.
- Common headings: `20px`, `24px`, and `32px`.
- Product/fortune display moments may use larger decorative type, especially Chonburi in shared horoscope surfaces.

## 4. Component Stylings

Current MuMate UI is Tailwind-first with many page-local recipes.

- Brand headers use teal bars (`moumate_blue` or inline `#1B9AAF`), fixed top positioning, the MuMate logo, and menu/avatar/login actions.
- Primary CTAs are rounded teal buttons, typically `rounded-[12px]` to `rounded-[16px]`, full width on mobile, and white text.
- Pill CTAs and chips use `rounded-[40px]`, `rounded-full`, or `rounded-[100px]`.
- Soft cards use `bg-white/45`, `backdrop-blur-sm` or `backdrop-blur-md`, `shadow-custom`, and radius between `16px` and `32px`.
- Form controls commonly use white backgrounds, gray borders, `p-[8px]`, and `rounded-[10px]`.
- Modal surfaces share a fixed black translucent backdrop with blur, then a white rounded content box with centered Thai copy and image/icon support.
- Loading has two current forms: `ScreenLoading` full-screen spinner and `SkeletonRow` content-shaped row skeleton.
- Chat uses its own full-screen mobile-first token family (`chat_surface`, `chat_header_*`, `chat_bubble_user`) with safe-area and dynamic viewport helpers.

## 5. Layout Principles

- Mobile-first is the default reading of the codebase. Many routes are full-width mobile surfaces that widen to `400px`, `460px`, `690px`, `800px`, or `1050px` containers at larger breakpoints.
- Fixed top headers are common; account for `60px` or `72px` header height before placing first content.
- Use Tailwind utility composition already present in the repo. Do not introduce a new component framework for this foundation work.
- Prefer extracting small pure primitives from repeated recipes only after confirming they do not own product flow, routing, API calls, cookies, auth state, or payment state.
- Page components may still orchestrate flows. Do not refactor page logic while writing or using this design contract.

## 6. Depth & Elevation

- `shadow-custom`: `0px 12px 24px -8px rgba(194, 202, 255, 0.5)`; used for soft MuMate cards, error toast, and glass-like surfaces.
- `shadow-custom2`: `0px 36px 24px -24px rgba(195, 200, 233, 1)`; available for stronger elevation.
- Glass surfaces combine semi-transparent white, backdrop blur, rounded corners, and soft shadow.
- Modal depth comes from a black translucent blurred scrim plus an elevated white content container.
- Chat depth uses darker panels, drawer layering, full-screen mobile sheet behavior, and desktop rounded docked widget behavior.

## 7. Do's & Don'ts

- Do reuse `moumate_blue`, `moumate_blue_light`, `moumate_gray`, `moumate_black`, `moumate_white`, `moumate_red`, `bg_gray`, and `border_gray` before adding new one-off colors.
- Do keep Thai copy legible and centered where the current product uses calm guidance or fortune-style onboarding.
- Do keep browser evidence scoped to `/Users/non/dev/opilot/.playwright-mcp/mootech-fe-fork/`.
- Do record drift when current code uses inline hex or page-local recipes.
- Do keep `components/ui/` for tiny pure primitives only.
- Don't redesign product pages while extracting the design contract.
- Don't move domain components into `components/ui/` just because their visuals repeat.
- Don't add shadcn, Radix, cva, tailwind-merge, or a new framework in this foundation phase.
- Don't claim authenticated flow truth from anonymous browser evidence.
- Don't edit env, OAuth, payment, domain, DNS, Vercel, or backend/Bazi integration as part of design foundation work.

## 8. Responsive Behavior

- The app is primarily mobile-first, with desktop widening and grid behavior on selected package/profile/product surfaces.
- Touch targets are commonly 40px or larger for icons/avatar/menu controls and full-width for primary mobile CTAs.
- Safe-area helpers exist: `.pt-safe`, `.pb-safe`, `.pl-safe`, `.pr-safe`.
- Dynamic viewport helpers exist: `.min-h-screen-dvh` and `.h-screen-dvh`, used by full-screen mobile chat.
- Z-index-heavy layers exist for headers, modals, chat sheets, and loading states; do not introduce new global overlays without checking existing `z-[60]`, `z-[9998]`, and `z-[9999]` usage.
- Browser verification for design work should use both mobile and desktop showcase viewports.

## 9. Agent Prompt Guide

> Before building MuMate FE UI, read this file, `tailwind.config.ts`, `styles/globals.css`, and the current component you intend to touch. Preserve the existing teal, Thai-first, rounded, soft-card MuMate language. Reuse real tokens and `components/ui/skeleton-row.tsx` where it fits. Keep domain-heavy components in their current ownership unless a later refactor proves a pure primitive. Record current drift instead of hiding it, and verify browser-visible design claims only through the declared web-eye artifact sink.

## Primitives (reuse-first)

| Primitive | File | Variants |
|-----------|------|----------|
| `SkeletonRow` | `components/ui/skeleton-row.tsx` | `count` controls number of row placeholders |

Candidate primitive recipes for Phase 3, not yet real exports:

| Candidate | Current Evidence | Boundary |
|-----------|------------------|----------|
| `TokenSwatch` | Needed for the dev-only design showcase | May be created as showcase/support primitive |
| `PrimaryCTA` | Repeated teal rounded buttons across login, modal, package, maintenance/error surfaces | Extract only if it stays presentational |
| `PillCTA` | `rounded-[40px]`, `rounded-full`, `rounded-[100px]` buttons/chips | Extract only if it has no routing/payment behavior |
| `SoftCard` | `bg-white/45`, `backdrop-blur-sm`, `shadow-custom`, rounded 16-32 | Extract only if used as a pure container |
| `InputField` / `SelectField` | `bg-moumate_white`, gray border, `rounded-[10px]`, `p-[8px]` | Extract only if it does not own validation or date logic |

Keep these as domain/flow components for now: `header-v2`, `header`, `product-catalog`, `birthday-input`, `bazi-chat-modal`, payment modals, auth/login modals, and page-local package/register/welcome surfaces.

## Design Brain Links

- `layered-token-architecture`: relevant because MuMate currently has tokenized Tailwind values plus many raw inline hex values.
- `material-surface-hierarchy`: relevant because MuMate uses translucent white cards, blur, and soft shadows for glass-like surfaces.
- `shape-vocabulary`: relevant because MuMate relies on repeated pill/card/full-round shape language.
- `skeleton-loading-system`: directly grounded in this repo through `components/ui/skeleton-row.tsx` and `components/screen-loading.tsx`.

## Known Drift

- `#1B9AAF` is both tokenized as `moumate_blue` and repeated inline across many pages/components.
- Many secondary colors remain magic hex values in feature files: `#F2F7FD`, `#444444`, `#D4F8F9`, `#F3FCA2`, `#E3ECFB`, calendar/element colors, and package/payment accents.
- `DESIGN.md` probes target the Phase 3 dev-only showcase route at `pages/design-system.tsx`; browser token evidence remains pending until Phase 4.
- `components/ui/` currently has only `SkeletonRow`; most UI is page-local or domain-owned.
- `BirthdayInput` currently renders controlled/uncontrolled select warnings because select elements specify both `value` and `defaultValue`.
- Prior public browser evidence reports Next Image width/height and LCP warnings on `/`, `/login`, `/package-price`, `/maintenance`, and `/welcome`.
- Anonymous browser evidence reaches public and redirect states only; it does not verify authenticated profile, destiny, matching, payment, OAuth, backend, Bazi, production, or native-mobile behavior.
