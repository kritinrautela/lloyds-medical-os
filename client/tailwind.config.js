/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#040812',
          surface: '#081120',
          card: 'rgba(11, 22, 42, 0.75)',
          border: 'rgba(56, 189, 248, 0.12)',
          borderHover: 'rgba(56, 189, 248, 0.35)',
        },
        brand: {
          cyan: '#00F2FE',
          blue: '#4FACFE',
          teal: '#0D9488',
          emerald: '#10B981',
          gold: '#F59E0B',
          rose: '#F43F5E',
          purple: '#8B5CF6'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace']
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -5px rgba(0, 242, 254, 0.25)',
        'glow-emerald': '0 0 25px -5px rgba(16, 185, 129, 0.25)',
        'glow-amber': '0 0 25px -5px rgba(245, 158, 11, 0.25)',
        'glow-rose': '0 0 25px -5px rgba(244, 63, 94, 0.25)',
        'glow-purple': '0 0 25px -5px rgba(139, 92, 246, 0.25)',
        'card': '0 10px 30px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      }
    },
  },
  plugins: [],
}
