/** @type {import('tailwindcss').Config} */

/*
 * Every colour resolves through a CSS custom property, so the same class name
 * renders correctly in the daylight theme used at the outpatient counter and
 * the low-light theme used on the night shift. The channel form
 * `rgb(var(--x) / <alpha-value>)` keeps Tailwind's opacity modifiers working.
 */
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

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
        canvas: token('--c-canvas'),
        surface: token('--c-surface'),
        subtle: token('--c-subtle'),
        line: {
          DEFAULT: token('--c-line'),
          soft: token('--c-line-soft'),
          strong: token('--c-line-strong')
        },
        ink: {
          DEFAULT: token('--c-ink'),
          2: token('--c-ink-2'),
          3: token('--c-ink-3'),
          inverse: token('--c-ink-inverse')
        },
        // Lloyds brand. Reserved for identity and the primary action only.
        brand: {
          DEFAULT: token('--c-brand'),
          deep: token('--c-brand-deep'),
          wash: token('--c-brand-wash')
        },
        // Clinical status scale. Never decorative.
        critical: {
          DEFAULT: token('--c-critical'),
          wash: token('--c-critical-wash'),
          line: token('--c-critical-line')
        },
        warn: {
          DEFAULT: token('--c-warn'),
          wash: token('--c-warn-wash'),
          line: token('--c-warn-line')
        },
        ok: {
          DEFAULT: token('--c-ok'),
          wash: token('--c-ok-wash'),
          line: token('--c-ok-line')
        },
        info: {
          DEFAULT: token('--c-info'),
          wash: token('--c-info-wash'),
          line: token('--c-info-line')
        }
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
        panel: 'var(--shadow-panel)',
        raised: 'var(--shadow-raised)',
        overlay: 'var(--shadow-overlay)'
      }
    },
  },
  plugins: [],
}
