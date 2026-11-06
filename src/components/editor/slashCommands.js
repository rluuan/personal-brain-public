import {
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Minus, Table, Code2, Image, Workflow, Link2, Hash,
} from 'lucide-react'

export const SLASH_COMMANDS = [
  { id: 'h1',        label: 'Título 1',        keywords: 'heading titulo h1',    icon: Heading1,     before: '# ',  after: '', block: true },
  { id: 'h2',        label: 'Título 2',        keywords: 'heading titulo h2',    icon: Heading2,     before: '## ', after: '', block: true },
  { id: 'h3',        label: 'Título 3',        keywords: 'heading titulo h3',    icon: Heading3,     before: '### ', after: '', block: true },
  { id: 'list',      label: 'Lista',           keywords: 'bullet lista item',    icon: List,         before: '- ',  after: '', block: true },
  { id: 'numbered',  label: 'Lista numerada',  keywords: 'ordered numero lista', icon: ListOrdered,  before: '1. ', after: '', block: true },
  { id: 'checklist', label: 'Checklist',       keywords: 'todo tarefa checkbox', icon: CheckSquare,  before: '- [ ] ', after: '', block: true },
  { id: 'quote',     label: 'Citação',         keywords: 'blockquote citacao',   icon: Quote,        before: '> ',  after: '', block: true },
  { id: 'codeblock', label: 'Bloco de código', keywords: 'code codigo bloco',    icon: Code2,        before: '```\n', after: '\n```', block: false },
  { id: 'divider',   label: 'Separador',       keywords: 'hr linha separador',   icon: Minus,        before: '\n---\n', after: '', block: true },
  { id: 'table',     label: 'Tabela',          keywords: 'table tabela',         icon: Table,        before: '| Col A | Col B |\n|-------|-------|\n| ', after: ' |  |', block: false },
  { id: 'wikilink',  label: 'Link pra nota',   keywords: 'wiki link nota',       icon: Link2,        before: '[[', after: ']]', block: false },
  { id: 'tag',       label: 'Tag',             keywords: 'tag hashtag',          icon: Hash,         before: '#',  after: '', block: false },
  { id: 'image',     label: 'Imagem',          keywords: 'image imagem foto',    icon: Image,        special: 'image' },
  { id: 'diagram',   label: 'Diagrama',        keywords: 'diagram diagrama excalidraw', icon: Workflow, special: 'diagram' },
]

export function filterSlashCommands(query) {
  const q = (query || '').toLowerCase()
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter((c) => c.label.toLowerCase().includes(q) || c.keywords.includes(q))
}
