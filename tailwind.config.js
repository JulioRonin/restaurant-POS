/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        solaris: {
          black: '#030303',
          orange: '#f97316',
          dark: '#0a0a0b',
          accent: '#fb923c',
        },
        primary: {
          DEFAULT: '#f97316',
          dark: '#ea580c',
          light: '#fb923c',
        }
      },
      borderRadius: {
        'solaris': '2rem',
        '3xl': '2rem', // Mapping standard 3xl to 32px as well
      },
      boxShadow: {
        'solaris': '0 0 40px rgba(249, 115, 22, 0.1)',
        'solaris-glow': '0 0 20px rgba(249, 115, 22, 0.4)',
      }
    },
  },
  plugins: [],
}
