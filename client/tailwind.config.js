/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces and rules. Everything structural is neutral so that any
        // colour on screen means a clinical state and nothing else.
        canvas: '#F4F6F8',
        surface: '#FFFFFF',
        subtle: '#F7F9FA',
        line: {
          DEFAULT: '#DFE4E9',
          soft: '#EAEEF1',
          strong: '#C4CCD4'
        },
        ink: {
          DEFAULT: '#101720',
          2: '#48545F',
          3: '#6B7885',
          inverse: '#FFFFFF'
        },
        // Lloyds brand. Reserved for identity and the primary action only.
        brand: {
          DEFAULT: '#C8102E',
          deep: '#8E0B20',
          wash: '#FDF2F3'
        },
        // Clinical status scale. Never decorative.
        critical: { DEFAULT: '#B3121F', wash: '#FDF1F2', line: '#F3C9CD' },
        warn:     { DEFAULT: '#A15C07', wash: '#FDF6EA', line: '#EFD9AE' },
        ok:       { DEFAULT: '#0B6E4F', wash: '#EFF8F3', line: '#BCE0CE' },
        info:     { DEFAULT: '#1B4FA0', wash: '#EFF4FC', line: '#C4D6EF' }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace']
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }]
      },
      borderRadius: {
        DEFAULT: '6px',
        md: '8px',
        lg: '10px'
      },
      boxShadow: {
        panel: '0 1px 2px rgba(16, 23, 32, 0.04), 0 1px 1px rgba(16, 23, 32, 0.03)',
        raised: '0 4px 12px -2px rgba(16, 23, 32, 0.10), 0 2px 4px -2px rgba(16, 23, 32, 0.06)',
        overlay: '0 24px 48px -12px rgba(16, 23, 32, 0.24), 0 8px 16px -8px rgba(16, 23, 32, 0.12)'
      }
    },
  },
  plugins: [],
}
