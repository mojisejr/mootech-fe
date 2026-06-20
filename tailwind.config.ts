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
