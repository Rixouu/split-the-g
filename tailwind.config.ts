import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}",
    "./app/utils/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        guinness: {
          black: '#0B0B0B',
          cream: '#FDFBF3',
          gold: '#B38B2D',
          brown: '#1D180F',
          tan: '#D4B78F'
        }
      },
      fontFamily: {
        sans: [
          '"Google Sans"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
