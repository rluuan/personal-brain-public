// Presets de tema — cada um define a paleta estrutural completa (fundo, bordas, texto)
// mais as cores de destaque padrão (que o usuário ainda pode sobrescrever na aba Aparência).
export const THEMES = [
  {
    id: 'sinapse',
    label: 'Sinapse',
    preview: { bg: '#1e1e2e', accent: '#cba6f7' },
    vars: {
      '--color-app-bg':      '#0d0d1a',
      '--color-bg':          '#1e1e2e',
      '--color-bg-rgb':      '14, 14, 26',
      '--color-sidebar':     '#161622',
      '--color-panel':       '#252535',
      '--color-panel-rgb':   '37, 37, 53',
      '--color-border':      '#313244',
      '--color-border-strong': '#45475a',
      '--color-hover':       '#2a2a3e',
      '--color-active':      '#313155',
      '--color-text':        '#cdd6f4',
      '--color-muted':       '#6c7086',
      '--color-muted-2':     '#a6adc8',
      '--color-scrollbar':   '#585b70',
      '--color-primary':     '#cba6f7',
      '--color-secondary':   '#89b4fa',
    },
  },
  {
    id: 'hipocampo',
    label: 'Hipocampo',
    preview: { bg: '#0f1a1a', accent: '#4dd0c4' },
    vars: {
      '--color-app-bg':      '#070f0f',
      '--color-bg':          '#0f1a1a',
      '--color-bg-rgb':      '7, 15, 15',
      '--color-sidebar':     '#0a1414',
      '--color-panel':       '#162626',
      '--color-panel-rgb':   '22, 38, 38',
      '--color-border':      '#1f3838',
      '--color-border-strong': '#2d4f4f',
      '--color-hover':       '#1a2e2e',
      '--color-active':      '#1f3a3a',
      '--color-text':        '#d0e8e4',
      '--color-muted':       '#6b8f8a',
      '--color-muted-2':     '#94b5b0',
      '--color-scrollbar':   '#3d5c58',
      '--color-primary':     '#4dd0c4',
      '--color-secondary':   '#6ee7d8',
    },
  },
  {
    id: 'amigdala',
    label: 'Amígdala',
    preview: { bg: '#1f1414', accent: '#f38ba8' },
    vars: {
      '--color-app-bg':      '#120b0b',
      '--color-bg':          '#1f1414',
      '--color-bg-rgb':      '18, 11, 11',
      '--color-sidebar':     '#180f0f',
      '--color-panel':       '#2b1c1c',
      '--color-panel-rgb':   '43, 28, 28',
      '--color-border':      '#3d2626',
      '--color-border-strong': '#5c3838',
      '--color-hover':       '#2e1d1d',
      '--color-active':      '#3a2222',
      '--color-text':        '#f0ddd5',
      '--color-muted':       '#a87f70',
      '--color-muted-2':     '#c9a494',
      '--color-scrollbar':   '#6b4a3d',
      '--color-primary':     '#f38ba8',
      '--color-secondary':   '#fab387',
    },
  },
  {
    id: 'cortex',
    label: 'Córtex',
    preview: { bg: '#f4f4f8', accent: '#7c5cbf' },
    vars: {
      '--color-app-bg':      '#e4e4ee',
      '--color-bg':          '#f4f4f8',
      '--color-bg-rgb':      '228, 228, 238',
      '--color-sidebar':     '#ececf4',
      '--color-panel':       '#ffffff',
      '--color-panel-rgb':   '255, 255, 255',
      '--color-border':      '#dcdce6',
      '--color-border-strong': '#c4c4d4',
      '--color-hover':       '#eaeaf2',
      '--color-active':      '#e0e0ee',
      '--color-text':        '#2a2a3e',
      '--color-muted':       '#6c6c80',
      '--color-muted-2':     '#4a4a5e',
      '--color-scrollbar':   '#b0b0c4',
      '--color-primary':     '#7c5cbf',
      '--color-secondary':   '#3b7dd8',
    },
  },
  {
    id: 'mielina',
    label: 'Mielina',
    preview: { bg: '#eef3f8', accent: '#2b7fd6' },
    vars: {
      '--color-app-bg':      '#dde8f0',
      '--color-bg':          '#eef3f8',
      '--color-bg-rgb':      '221, 232, 240',
      '--color-sidebar':     '#e4ecf4',
      '--color-panel':       '#ffffff',
      '--color-panel-rgb':   '255, 255, 255',
      '--color-border':      '#d2e0ec',
      '--color-border-strong': '#b8cfe0',
      '--color-hover':       '#e0eaf4',
      '--color-active':      '#d4e4f2',
      '--color-text':        '#1e3a52',
      '--color-muted':       '#5e7892',
      '--color-muted-2':     '#3d5870',
      '--color-scrollbar':   '#9fb8cc',
      '--color-primary':     '#2b7fd6',
      '--color-secondary':   '#0ea5b8',
    },
  },
]

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0]
}

export function applyTheme(id, overrides = {}) {
  const theme = getTheme(id)
  const root = document.documentElement
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v))
  if (overrides.primary) root.style.setProperty('--color-primary', overrides.primary)
  if (overrides.secondary) root.style.setProperty('--color-secondary', overrides.secondary)
  root.dataset.theme = theme.id
}
