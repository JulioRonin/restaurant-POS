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
      colors: {
        solaris: {
          black: '#1a1c14',
          orange: '#F98359',
          dark: '#12140d',
          accent: '#e8724a',
        },
        koso: {
          olive:   '#505530',
          cream:   '#FAFAF3',
          orange:  '#F98359',
          purple:  '#C694DB',
          dark:    '#12140d',
          surface: '#1e2118',
        },
        primary: {
          DEFAULT: '#F98359',
          dark:    '#e8724a',
          light:   '#fab08a',
        }
      },
      borderRadius: {
        'solaris': '2rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'solaris':      '0 0 40px rgba(249, 131, 89, 0.12)',
        'solaris-glow': '0 0 20px rgba(249, 131, 89, 0.45)',
        'koso-glow':    '0 0 24px rgba(249, 131, 89, 0.45)',
        'olive-glow':   '0 0 20px rgba(80, 85, 48, 0.5)',
      }
    },
  },
  plugins: [],
}
