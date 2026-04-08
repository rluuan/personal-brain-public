/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ui: {
          bg: '#1e1e2e',
          sidebar: '#161622',
          panel: '#252535',
          border: '#313244',
          text: '#cdd6f4',
          muted: '#6c7086',
          accent: 'var(--color-primary, #cba6f7)',
          blue: 'var(--color-secondary, #89b4fa)',
          green: '#a6e3a1',
          red: '#f38ba8',
          yellow: '#f9e2af',
          hover: '#2a2a3e',
          active: '#313155',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
