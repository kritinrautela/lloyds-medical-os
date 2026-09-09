/** @type {import('tailwindcss').Config} */

/*
 * Every colour resolves through a CSS custom property, so the same class name
 * renders correctly in the day sheet used at the outpatient counter and the
 * carbon-copy night sheet used on the ward. The channel form
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
        // Paper, sheets and rules. Everything structural is a shade of the
        // register's blue so that red, amber and green on screen always mean
        // a clinical or operational state.
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
        // The book's own blue: cobalt ink, the deep cover, and its wash.
        brand: {
          DEFAULT: token('--c-brand'),
          deep: token('--c-brand-deep'),
          wash: token('--c-brand-wash')
        },
        // The spine that carries the navigation.
        spine: {
          DEFAULT: token('--c-spine'),
          hover: token('--c-spine-hover'),
          ink: token('--c-spine-ink'),
          'ink-2': token('--c-spine-ink-2')
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
        // Archivo is bundled with the build (see main.jsx), so the clinic's
        // laptops draw it with no internet. The platform stack is the fallback
        // only while the file loads.
        sans: ['Archivo Variable', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace']
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }]
      },
      borderRadius: {
        DEFAULT: '4px',
        md: '4px',
        lg: '6px'
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
