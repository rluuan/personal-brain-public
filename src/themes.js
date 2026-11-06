// Presets de tema — paletas conhecidas (cores oficiais de cada projeto), mapeadas
// pra variáveis estruturais (fundo, bordas, texto) + cores de destaque padrão.
export const THEMES = [
  {
    id: 'dracula',
    label: 'Dracula',
    preview: { bg: '#282a36', accent: '#bd93f9' },
    vars: {
      '--color-app-bg':      '#20212c',
      '--color-bg-rgb':      '32, 33, 44',
      '--color-bg':          '#282a36',
      '--color-sidebar':     '#21222c',
      '--color-panel':       '#2d2f3d',
      '--color-panel-rgb':   '45, 47, 61',
      '--color-border':      '#44475a',
      '--color-border-strong': '#6272a4',
      '--color-border-strong-rgb': '98, 114, 164',
      '--color-hover':       '#343746',
      '--color-active':      '#44475a',
      '--color-text':        '#f8f8f2',
      '--color-muted':       '#6272a4',
      '--color-muted-2':     '#9aa1c9',
      '--color-scrollbar':   '#6272a4',
      '--color-primary':     '#bd93f9',
      '--color-secondary':   '#8be9fd',
    },
  },
  {
    id: 'nord',
    label: 'Nord',
    preview: { bg: '#2e3440', accent: '#88c0d0' },
    vars: {
      '--color-app-bg':      '#242831',
      '--color-bg-rgb':      '36, 40, 49',
      '--color-bg':          '#2e3440',
      '--color-sidebar':     '#272c36',
      '--color-panel':       '#3b4252',
      '--color-panel-rgb':   '59, 66, 82',
      '--color-border':      '#434c5e',
      '--color-border-strong': '#4c566a',
      '--color-border-strong-rgb': '76, 86, 106',
      '--color-hover':       '#3b4252',
      '--color-active':      '#434c5e',
      '--color-text':        '#eceff4',
      '--color-muted':       '#4c566a',
      '--color-muted-2':     '#81a1c1',
      '--color-scrollbar':   '#4c566a',
      '--color-primary':     '#88c0d0',
      '--color-secondary':   '#81a1c1',
    },
  },
  {
    id: 'monokai',
    label: 'Monokai',
    preview: { bg: '#272822', accent: '#ae81ff' },
    vars: {
      '--color-app-bg':      '#1e1f1c',
      '--color-bg-rgb':      '30, 31, 28',
      '--color-bg':          '#272822',
      '--color-sidebar':     '#202019',
      '--color-panel':       '#2d2e27',
      '--color-panel-rgb':   '45, 46, 39',
      '--color-border':      '#3e3d32',
      '--color-border-strong': '#49483e',
      '--color-border-strong-rgb': '73, 72, 62',
      '--color-hover':       '#3e3d32',
      '--color-active':      '#49483e',
      '--color-text':        '#f8f8f2',
      '--color-muted':       '#75715e',
      '--color-muted-2':     '#a6a28c',
      '--color-scrollbar':   '#75715e',
      '--color-primary':     '#ae81ff',
      '--color-secondary':   '#66d9ef',
    },
  },
  {
    id: 'onedark',
    label: 'One Dark',
    preview: { bg: '#282c34', accent: '#c678dd' },
    vars: {
      '--color-app-bg':      '#21252b',
      '--color-bg-rgb':      '33, 37, 43',
      '--color-bg':          '#282c34',
      '--color-sidebar':     '#21252b',
      '--color-panel':       '#2c313a',
      '--color-panel-rgb':   '44, 49, 58',
      '--color-border':      '#3e4451',
      '--color-border-strong': '#4b5263',
      '--color-border-strong-rgb': '75, 82, 99',
      '--color-hover':       '#2c313c',
      '--color-active':      '#3e4451',
      '--color-text':        '#abb2bf',
      '--color-muted':       '#5c6370',
      '--color-muted-2':     '#828997',
      '--color-scrollbar':   '#5c6370',
      '--color-primary':     '#c678dd',
      '--color-secondary':   '#61afef',
    },
  },
  {
    id: 'solarized-light',
    label: 'Solarized Light',
    preview: { bg: '#fdf6e3', accent: '#268bd2' },
    vars: {
      '--color-app-bg':      '#eee8d5',
      '--color-bg-rgb':      '238, 232, 213',
      '--color-bg':          '#fdf6e3',
      '--color-sidebar':     '#eee8d5',
      '--color-panel':       '#fffaf0',
      '--color-panel-rgb':   '255, 250, 240',
      '--color-border':      '#e4dcc3',
      '--color-border-strong': '#d3c9a8',
      '--color-border-strong-rgb': '211, 201, 168',
      '--color-hover':       '#f5efdc',
      '--color-active':      '#eee8d5',
      '--color-text':        '#586e75',
      '--color-muted':       '#93a1a1',
      '--color-muted-2':     '#657b83',
      '--color-scrollbar':   '#93a1a1',
      '--color-primary':     '#268bd2',
      '--color-secondary':   '#2aa198',
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
