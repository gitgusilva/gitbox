/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        // Mirrors the GitBox dark theme so the site and the app read as one product.
        ink: '#0B0D10',
        surface: '#141719',
        elevated: '#1B1F23',
        line: '#262B31',
        content: '#C9D1D9',
        muted: '#8B949E',
        strong: '#F0F6FC',
        accent: '#1E88E5',
        'accent-soft': '#4FA3E8',
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
