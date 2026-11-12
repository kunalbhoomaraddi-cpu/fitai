/** FitAI design tokens */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0B0D0C', 900: '#111512', 850: '#141915', 800: '#171C18', 750: '#1C221D', 700: '#222923' },
        line: { DEFAULT: '#29312B', soft: '#1F2621', strong: '#364038' },
        lime: { DEFAULT: '#C6F36B', 400: '#D4F78F', 500: '#C6F36B', 600: '#A9D84F', 900: '#2A3A12' },
        moss: { DEFAULT: '#49B675', 400: '#64C98C', 600: '#3A9560' },
        fg: { DEFAULT: '#F5F7F2', muted: '#9CA69D', dim: '#6B756D' },
        amber: { DEFAULT: '#F2B85B' },
        coral: { DEFAULT: '#F07C6A' },
        sky: { DEFAULT: '#7CC4F2' },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Manrope Variable"', 'Manrope', '"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '24px' },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 32px -16px rgba(0,0,0,0.6)',
        glow: '0 0 0 1px rgba(198,243,107,0.25), 0 8px 30px -8px rgba(198,243,107,0.35)',
        pop: '0 24px 64px -20px rgba(0,0,0,0.75)',
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
