/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        reflex: {
          bg: '#0a0a0f',
          surface: '#12121a',
          border: '#1e1e2e',
          accent: '#f97316',
          accentDim: '#c2410c',
          critical: '#ef4444',
          high: '#f97316',
          medium: '#eab308',
          low: '#22c55e',
          text: '#e2e8f0',
          muted: '#64748b',
        }
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'slide-in-right': 'slide-in-right 0.35s ease-out',
        'slide-in-left': 'slide-in-left 0.35s ease-out',
        'count-up': 'count-up 0.6s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'bar-fill': 'bar-fill 0.8s ease-out forwards',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'count-up': {
          from: { opacity: '0', transform: 'scale(0.5) translateY(10px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(249, 115, 22, 0.1)' },
          '50%': { boxShadow: '0 0 30px rgba(249, 115, 22, 0.25)' },
        },
        'bar-fill': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    }
  },
  plugins: [],
};
