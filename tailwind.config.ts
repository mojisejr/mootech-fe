import type { Config } from "tailwindcss";
import { PluginAPI } from "tailwindcss/types/config";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./dev-access/**/*.{js,ts,jsx,tsx,mdx}",
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
       boxShadow: {
        // ชื่อ custom: ค่า box-shadow
        'custom': '0px 12px 24px -8px rgba(194, 202, 255, 0.5)',
        'custom2': '0px 36px 24px -24px rgba(195, 200, 233, 1)'

      },
      // V3 radius tokens (DESIGN.md §4). Additive — Tailwind merges these with its default
      // rounded-* scale, so existing rounded-2xl/rounded-lg usages are untouched.
      // Classes: rounded-pill, rounded-card, rounded-chip.
      borderRadius: {
        'pill': '100px',
        'card': '16px',
        'chip': '6px',
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
