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
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        moumate_blue: '#1B9AAF',
        moumate_blue_dark: '#4B96E5',
        moumate_blue_light: '#EEFDFD',
        moumate_gray: '#888888',
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
