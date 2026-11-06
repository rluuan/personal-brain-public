/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ui: {
          bg: 'var(--color-bg, #1e1e2e)',
          sidebar: 'var(--color-sidebar, #161622)',
          panel: 'var(--color-panel, #252535)',
          border: 'var(--color-border, #313244)',
          'border-strong': 'var(--color-border-strong, #45475a)',
          text: 'var(--color-text, #cdd6f4)',
          muted: 'var(--color-muted, #6c7086)',
          'muted-2': 'var(--color-muted-2, #a6adc8)',
          accent: 'var(--color-primary, #cba6f7)',
          blue: 'var(--color-secondary, #89b4fa)',
          green: '#a6e3a1',
          red: '#f38ba8',
          yellow: '#f9e2af',
          hover: 'var(--color-hover, #2a2a3e)',
          active: 'var(--color-active, #313155)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
