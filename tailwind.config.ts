import type { Config } from "tailwindcss";
import { PluginAPI } from "tailwindcss/types/config";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./dev-access/**/*.{js,ts,jsx,tsx,mdx}",
    // features/ holds the entire v2 codebase. Without this glob, any Tailwind class UNIQUE to a
    // features/ file is silently never generated (pt-12, max-h-[NNN], max-w-[NNN] all "vanished") —
    // the root cause of the whole v2 "silent class failure" family. Do not remove.
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    fontFamily: {
      sarabun: ['Sarabun'],
      prompt: ['Prompt'],
      chonburi: ['Chonburi'],
      poppins: ['Noto+Sans+Thai'],
      ibm: ['"IBM Plex Sans Thai"', 'sans-serif'],
      // V3 primitive library (DESIGN.md §3). `poppins` above is legacy and maps to
      // Noto Sans Thai (used by hologram-scale.tsx) — do NOT reuse it for real Poppins.
      // Use `font-poppins-v3` for Latin/numerals + disabled button labels.
      'poppins-v3': ['Poppins', 'sans-serif'],
    },
    extend: {
      colors: {
        // V3 redesign tokens (DESIGN.md §2). Namespaced under `v3` so they never clash with
        // the ~40 existing brownfield tokens above. Classes: bg-v3-sapphire, text-v3-navy, etc.
        v3: {
          // Brand
          'sapphire': '#1455A4',        // primary — buttons, checkbox fill, accent heading
          'sapphire-hover': '#10427F',  // primary hover/pressed
          'lime': '#E1FF00',            // accent — button label + focus ring ONLY (low contrast on white)
          'cyan': '#1B9AAF',            // secondary/legacy tie-in
          // Surface & text
          'ghost-white': '#ECF0FD',     // page bg + tile-icon chip
          'navy': '#0B305B',            // screen headings (Oxford Navy)
          'text-title': '#0B305B',      // alias of navy — matches DESIGN token name
          'text-body': '#464646',       // body / label
          'text-muted': '#71717A',      // secondary list-item
          'placeholder': '#9CA3AF',     // input placeholder
          'text-filled': '#212121',     // filled input value
          // Semantic & border
          'error': '#E73E3E',
          'focus-border': '#3475E2',
          'border-input': '#E5E7EB',
          'border-card': '#E9EAEB',
          'border-dropdown': '#B0B0B0', // Neutral 06
          'border-checkbox': '#C2C2C2', // Neutral 05
          'shade-02': '#222222',        // dropdown focus border/text
          'tab-track': '#EBEBEB',       // Neutral 02
          'tab-focus': '#F7F7F7',
          'disabled-bg': '#DDDDDD',     // Neutral 03
          'dropdown-label': '#717171',  // Neutral 07
          // --- v3 additions (full-Figma capture, DESIGN.md v3 §2) ---
          // Brand / accent
          'pumpkin': '#FF6800',         // home hub accent, "ควรเลี่ยง" heading
          // Surface & text (extra)
          'bg-cream': '#FAF7F4',        // payment/couple's/my-destiny surface (coexists w/ ghost-white)
          'text-body-alt': '#4B5563',   // input Field label (308-88)
          'text-detail': '#888888',     // body text on glass blocks
          'text-price': '#1F2937',      // bold price amounts (payment)
          // Semantic / border (extra)
          'error-legacy': '#C13515',    // legacy input (300-701) error
          'link-legal': '#004CC4',      // legal link (Links component)
          'border-checkout': '#D1D5DB',
          'border-warm': '#E0DEDB',
          'border-warm-2': '#E5E3E0',
          // Nav / Mate AI
          'nav-dark': '#1A1A1A',        // menubar bar bg
          'nav-label-off': '#FAF7F4',   // default tab labels
          'mate-magenta': '#E913C5',    // Mate-AI gradient-text end
          'mate-teal': '#187CAA',       // Mate-AI base gradient mid
          'mate-purple': '#6F1BAF',     // Mate-AI base gradient end
          // Home pastel tiles
          'pastel-mint': '#E0FFC4',
          'pastel-sky': '#C1E6F8',
          'pastel-blue': '#C9E4F4',
          'pastel-lilac': '#ECD9FB',
          'pastel-pink': '#FBD9E7',
          'grade-yellow': '#F1FF75',    // grade "อัพเกรด" pill (softer than lime)
          'pastel-teal': '#91D8D2',
          'lemon-chiffon': '#F9F4F0',   // sheet bg / calendar tab default seg
          'endeavour-100': '#E3ECFB',
          // my-destiny legacy palette (626-2004, captured as-is)
          'endeavour-400': '#4B96E5',
          'endeavour-500': '#2479D3',
          'chart-teal': '#1AB1C0',
          'pig-pink': '#FBD9E2',
          // Element ICON palette (bright, decorative — chips/glyphs)
          'el-wood': '#55B43F',
          'el-metal': '#EBBF30',
          'el-fire': '#DC2727',
          'el-earth': '#DC8B43',
          'el-water': '#14ADFF',
          // Element TEXT palette (elements.ts, WCAG >=4.5:1 on white)
          'el-wood-text': '#237753',
          'el-metal-text': '#8A5E12',
          'el-fire-text': '#C4341F',
          'el-earth-text': '#5F5326',
          'el-water-text': '#2C55A6',
          // Calendar day-cell 3-tier (accent / bg)
          'cal-good': '#0B7A8C',        'cal-good-bg': '#E2F4F6',
          'cal-medium': '#B47E35',      'cal-medium-bg': '#FEF1E0',
          'cal-bad': '#CD3D2E',         'cal-bad-bg': '#FEE7E4',
          'cal-marker': '#9D85DA',      // selected-day / วันพระ ring
          // Grade 10-step semantic scale (accent / card bg)
          'grade-a': '#2E7D32',   'grade-a-bg': '#E8F5E9',
          'grade-bplus': '#43A047', 'grade-bplus-bg': '#EDF7ED',
          'grade-b': '#66BB6A',   'grade-b-bg': '#F0F8F0',
          'grade-bminus': '#8BC34A', 'grade-bminus-bg': '#F1F8E8',
          'grade-cplus': '#CDDC39', 'grade-cplus-bg': '#F9FBE7', // badge text #374151 (contrast exception)
          'grade-c': '#FFA726',   'grade-c-bg': '#FFF3E0',
          'grade-cminus': '#F57C00', 'grade-cminus-bg': '#FFF0E1',
          'grade-dplus': '#E64A19', 'grade-dplus-bg': '#FBE9E7',
          'grade-d': '#D32F2F',   'grade-d-bg': '#FFEBEE',
          'grade-dminus': '#B71C1C', 'grade-dminus-bg': '#FCE4EC',
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        moumate_blue: '#1B9AAF',
        moumate_blue_dark: '#4B96E5',
        moumate_blue_light: '#EEFDFD',
        moumate_gray: '#888888',
        // Darker muted text for small labels (#public-bazi-calculator) — moumate_gray fails
        // 4.5:1 on both white and bg_gray (3.54/2.94, verified via relative-luminance formula)
        // at the small sizes used across the calculator's 100+ timeline labels. Scoped to this
        // feature rather than changing the shared brand token everywhere it's already used.
        calc_muted: '#666666', // 5.74:1 white / 4.77:1 bg_gray
        moumate_black: '#101828',
        moumate_white: '#FFFFFF',
        moumate_red: '#CB2C2A',
        bg_gray: '#E9EAEB',
        border_gray: '#D5D7DA',
        // Chat surface palette — promoted from hardcoded hex in the chat modal so the
        // full-screen rebuild themes via tokens, not inline JSX (#mootech-chat-mobile-ux).
        chat_surface: '#44588B',      // chat body background (navy)
        chat_panel: '#3a4a78',        // session drawer background
        chat_bubble_user: '#4B4F88',  // user bubble (use /80 etc. for the old CC alpha)
        chat_header_from: '#2599AE',  // header gradient start (teal)  rgba(37,153,174)
        chat_header_to: '#3A78A9',    // header gradient end (slate) + top-up CTA text
        launcher_magenta: '#FF00EE',  // launcher gradient end (teal -> magenta hero)
        // Ops dashboard — dark-only (#mumate-ops-dashboard-phase1). This project has no
        // theme infra at all (no `darkMode` config, no ThemeProvider), so these are just a
        // fixed palette used directly in /ops, not a `dark:` variant of anything.
        ops_bg: '#0B1220',        // page background
        ops_surface: '#141B2B',   // card background
        ops_border: '#232B3D',
        ops_text: '#E6E9F0',
        ops_text_muted: '#8A93A6',
        // status_* are dark-tuned per design review (มุน, #mumate-ops-dashboard-phase1): NOT the
        // light-mode moumate_red etc. lifted as-is — desaturated + lifted lightness so they read
        // clearly on ops_bg/ops_surface without vibrating. Calm-when-calm: status_ok is meant to
        // sit quietly as a small dot, not compete for attention — only warn/bad should draw the
        // eye. Verify contrast with real screenshots before shipping (see PR).
        status_ok: '#34D399',
        status_warn: '#FBBF24',
        status_bad: '#F87171',
        violet: {
          new_2: '#6167BF',
        },
        brown: {
          sugar: '#C77356',
          text: '#82655A'
        },
        indigo: {
          600: '#5193CE'
        }
      },
      // V3 radius tokens (DESIGN.md §4). Additive — Tailwind merges these with its default
      // rounded-* scale, so existing rounded-2xl/rounded-lg usages are untouched.
      // Classes: rounded-pill, rounded-card, rounded-chip.
      borderRadius: {
        'pill': '100px',
        'card': '16px',
        'chip': '6px',
        // v3 additions (DESIGN.md v3 §4) — 13-step radius scale
        'day': '11px',        // calendar day cell
        'method': '12px',     // payment method card
        'date': '14px',       // calendar date selector dropdown
        'feature': '20px',    // calendar/notif/result-section card
        'service': '24px',    // service / mascot / upload / big card
        'sheet': '28px',      // bottom-sheet top corners / daily card
        'screen': '40px',     // screen frame
      },
      boxShadow: {
        'custom': '0px 12px 24px -8px rgba(194, 202, 255, 0.5)',
        'custom2': '0px 36px 24px -24px rgba(195, 200, 233, 1)',
        // v3 elevation set (DESIGN.md v3 §4) — the ONLY sanctioned depth
        'grade-glow': '0px 4px 8px rgba(117,227,235,0.5)',       // grade pill cyan glow
        'sheet': '0px 8px 20px rgba(0,0,0,0.25)',                // bottom-sheet success banner
        'card-soft': '0px 4px 30px rgba(26,38,77,0.12)',         // calendar/payment/result cards
        'card-faint': '0px 4px 14px rgba(26,38,77,0.06)',        // calendar grid
        'cta-cyan': '0px 6px 14px rgba(27,154,175,0.24)',        // colored CTA (PDF)
        'cta-sapphire': '0px 6px 14px rgba(20,85,164,0.24)',     // colored CTA (Share)
        'promo': '0px 6px 16px rgba(51,46,115,0.28)',            // promo card
        'tab-selected': '0px 6px 8.5px rgba(0,0,0,0.08)',        // neutral pill-tab selected
        'glass-glow': '0px 32px 24px -24px rgba(27,154,175,0.15)', // my-destiny glass card teal glow
      },
      backdropBlur: { 
        // ชื่อ custom: ค่า blur
        'huge': '196px',
        '44': '44px',
      },
      animation: {
        'gradient-shift': 'gradientShift 6s ease infinite',
      },
      keyframes: {
        gradientShift: {
          '0%, 100%': {
            backgroundPosition: '0% 50%',
          },
          '50%': {
            backgroundPosition: '100% 50%',
          },
        },
      },
      backgroundSize: {
        '200': '200% 200%',
      },
    },
  },
};
export default config;
