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
          // 5 Sobremesa Lucida core hexes
          midnight:   '#1A1E2E',
          terracota:  '#C4633F',
          mostaza:    '#C9A24A',
          hueso:      '#FAF8F4',
          carbon:     '#2A2826',
          // Extended ramps
          'midnight-soft':   '#232839',
          'midnight-card':   '#2A2F42',
          'terracota-dark':  '#A14C2D',
          'terracota-light': '#DCA08A',
          'hueso-sunken':    '#F0F0E8',
          surface:           '#FFFFFF',
          // Semantic
          success: '#22A06B',
          warning: '#C9A24A',
          danger:  '#E1554B',
        },
        // Legacy aliases — kept so older screens keep compiling.
        // Map every old token to its Sobremesa Lucida equivalent.
        solaris: {
          black:  '#2A2826',
          orange: '#C4633F',
          dark:   '#1A1E2E',
          accent: '#C9A24A',
        },
        koso: {
          olive:   '#2A2826',
          cream:   '#FAF8F4',
          orange:  '#C4633F',
          purple:  '#C9A24A',
          dark:    '#1A1E2E',
          surface: '#232839',
        },
        primary: {
          DEFAULT: '#C4633F',
          dark:    '#A14C2D',
          light:   '#DCA08A',
        },
      },
      borderRadius: {
        'sr-sm':   '8px',
        'sr-md':   '12px',
        'sr-lg':   '16px',
        'sr-xl':   '24px',
        'sr-2xl':  '32px',
        'sr-pill': '9999px',
        'solaris': '2rem',  // legacy alias = 32px
        '3xl':     '2rem',
      },
      boxShadow: {
        'sr-card':       '0 2px 20px rgba(42, 40, 38, 0.08)',
        'sr-lift':       '0 4px 24px rgba(42, 40, 38, 0.10)',
        'sr-modal':      '0 30px 80px rgba(26, 30, 46, 0.35)',
        'sr-glow':       '0 0 20px rgba(196, 99, 63, 0.40)',
        'sr-glow-soft':  '0 0 40px rgba(196, 99, 63, 0.12)',
        'sr-glow-midnight': '0 0 20px rgba(42, 40, 38, 0.50)',
        // Legacy aliases
        'solaris':      '0 0 40px rgba(196, 99, 63, 0.12)',
        'solaris-glow': '0 0 20px rgba(196, 99, 63, 0.45)',
        'koso-glow':    '0 0 24px rgba(196, 99, 63, 0.45)',
        'olive-glow':   '0 0 20px rgba(42, 40, 38, 0.5)',
      },
      transitionTimingFunction: {
        'sr-solaris': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'sr-out':     'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'sr-fade':   { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'sr-fadeup': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'sr-pop': {
          '0%':   { transform: 'scale(0.6)' },
          '60%':  { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
        'sr-blink': {
          '0%, 100%': { opacity: '0.25' },
          '50%':      { opacity: '1' },
        },
      },
      animation: {
        'sr-fade':   'sr-fade 0.4s ease',
        'sr-fadeup': 'sr-fadeup 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
        'sr-pop':    'sr-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'sr-blink':  'sr-blink 1.2s infinite',
      },
    },
  },
  plugins: [],
};
