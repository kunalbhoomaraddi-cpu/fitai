/** FitAI design tokens */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Every theme colour is a CSS variable (see index.css): dark is the default, light is optional.
      colors: {
        ink: { 950: 'rgb(var(--ink-950) / <alpha-value>)', 900: 'rgb(var(--ink-900) / <alpha-value>)', 850: 'rgb(var(--ink-850) / <alpha-value>)', 800: 'rgb(var(--ink-800) / <alpha-value>)', 750: 'rgb(var(--ink-750) / <alpha-value>)', 700: 'rgb(var(--ink-700) / <alpha-value>)' },
        line: { DEFAULT: 'rgb(var(--line) / <alpha-value>)', soft: 'rgb(var(--line-soft) / <alpha-value>)', strong: 'rgb(var(--line-strong) / <alpha-value>)' },
        lime: { DEFAULT: 'rgb(var(--lime) / <alpha-value>)', 400: 'rgb(var(--lime-400) / <alpha-value>)', 500: 'rgb(var(--lime) / <alpha-value>)', 600: 'rgb(var(--lime-600) / <alpha-value>)', 900: 'rgb(var(--lime-900) / <alpha-value>)' },
        moss: { DEFAULT: 'rgb(var(--moss) / <alpha-value>)', 400: 'rgb(var(--moss-400) / <alpha-value>)', 600: 'rgb(var(--moss-600) / <alpha-value>)' },
        fg: { DEFAULT: 'rgb(var(--fg) / <alpha-value>)', muted: 'rgb(var(--fg-muted) / <alpha-value>)', dim: 'rgb(var(--fg-dim) / <alpha-value>)' },
        amber: { DEFAULT: 'rgb(var(--amber) / <alpha-value>)' },
        coral: { DEFAULT: 'rgb(var(--coral) / <alpha-value>)' },
        sky: { DEFAULT: 'rgb(var(--sky) / <alpha-value>)' },
        // Faint overlays (bg-white/[0.04]) tint toward the text colour: light on dark, dark on light
        white: 'rgb(var(--tint) / <alpha-value>)',
        // Real white, for labels over photos
        snow: '#FFFFFF',
      },
      fontFamily: {
        // Body: IBM Plex Sans (calm, clear figures). Display: Big Shoulders, a condensed scoreboard face for headings and numbers.
        sans: ['"IBM Plex Sans Variable"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"Big Shoulders Display Variable"', '"Big Shoulders Display"', '"IBM Plex Sans Variable"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '24px' },
      boxShadow: {
        card: 'var(--shadow-card)',
        glow: '0 0 0 1px rgb(var(--lime) / 0.25), 0 8px 30px -8px rgb(var(--lime) / 0.35)',
        pop: 'var(--shadow-pop)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        'fade-in': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        pop: { '0%': { transform: 'scale(.96)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
        'bounce-dot': { '0%, 80%, 100%': { transform: 'translateY(0)', opacity: .4 }, '40%': { transform: 'translateY(-4px)', opacity: 1 } },
        confetti: { '0%': { transform: 'translateY(0) rotate(0)', opacity: 1 }, '100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: 0 } },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.2,.7,.2,1) both',
        'fade-in': 'fade-in .3s ease both',
        shimmer: 'shimmer 1.4s linear infinite',
        pop: 'pop .22s cubic-bezier(.2,.7,.2,1) both',
        'bounce-dot': 'bounce-dot 1.2s infinite ease-in-out',
        confetti: 'confetti 2.6s cubic-bezier(.25,.6,.4,1) forwards',
      },
    },
  },
  plugins: [],
}
