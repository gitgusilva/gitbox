/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts,js}'],
  theme: {
    extend: {
      colors: {
        // Legacy tokens (kept for back-compat during migration).
        panel: '#0f1720',
        panelSoft: '#131d2a',
        borderSoft: '#253142',

        // Semantic theme tokens — RGB-channel CSS vars set by themeService, so
        // Tailwind's `/opacity` modifier works (rgb(var(--x) / <alpha-value>)).
        app: 'rgb(var(--gb-bg) / <alpha-value>)',
        surface: 'rgb(var(--gb-bg-elevated) / <alpha-value>)',
        overlay: 'rgb(var(--gb-bg-overlay) / <alpha-value>)',
        'surface-hover': 'rgb(var(--gb-surface-hover) / <alpha-value>)',
        line: 'rgb(var(--gb-border) / <alpha-value>)',
        'line-strong': 'rgb(var(--gb-border-strong) / <alpha-value>)',
        content: 'rgb(var(--gb-text) / <alpha-value>)',
        'content-strong': 'rgb(var(--gb-text-strong) / <alpha-value>)',
        'content-muted': 'rgb(var(--gb-text-muted) / <alpha-value>)',
        accent: 'rgb(var(--gb-accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--gb-accent-hover) / <alpha-value>)',
        'accent-fg': 'rgb(var(--gb-accent-fg) / <alpha-value>)',
        added: 'rgb(var(--gb-added) / <alpha-value>)',
        removed: 'rgb(var(--gb-removed) / <alpha-value>)',
        modified: 'rgb(var(--gb-modified) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--gb-font-ui)', 'IBM Plex Sans', 'Segoe UI', 'sans-serif'],
        mono: ['var(--gb-font-mono)', 'IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        app: 'var(--gb-radius)',
      },
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
  ]
};
