import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '480px',
        ...defaultTheme.screens,
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        serif: ['Fraunces', ...defaultTheme.fontFamily.serif],
        mono: ['JetBrains Mono', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        servirest: {
          midnight: '#1A1E2E',
          terracota: '#C4633F',
          mostaza: '#C9A24A',
          hueso: '#FAF8F4',
          carbon: '#2A2826',
        },
        solaris: {
          black: '#2A2826', // Gris Carbón
          orange: '#C4633F', // Terracota
          dark: '#1A1E2E', // Midnight Tinto
          accent: '#C9A24A', // Mostaza Mate
        },
        koso: {
          olive:   '#2A2826', // Gris Carbón
          cream:   '#FAF8F4', // Blanco Hueso
          orange:  '#C4633F', // Terracota
          purple:  '#C9A24A', // Mostaza Mate
          dark:    '#1A1E2E', // Midnight Tinto
          surface: '#232839',
        },
        primary: {
          DEFAULT: '#C4633F', // Terracota
          dark:    '#a14c2d',
          light:   '#dca08a',
        }
      },
      borderRadius: {
        'solaris': '2rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'solaris':      '0 0 40px rgba(196, 99, 63, 0.12)',
        'solaris-glow': '0 0 20px rgba(196, 99, 63, 0.45)',
        'koso-glow':    '0 0 24px rgba(196, 99, 63, 0.45)',
        'olive-glow':   '0 0 20px rgba(42, 40, 38, 0.5)',
      }
    },
  },
  plugins: [],
}
