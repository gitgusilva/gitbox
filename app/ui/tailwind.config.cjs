/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{vue,ts,js}'],
  theme: {
    extend: {
      colors: {
        panel: '#0f1720',
        panelSoft: '#131d2a',
        borderSoft: '#253142'
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
  ]
};
