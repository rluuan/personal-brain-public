import { Edit3, Columns, Eye, Network, MessageSquare } from 'lucide-react'

const MODES = [
  { id: 'edit',       icon: Edit3,     label: 'Editar',   title: 'Somente editor' },
  { id: 'split',      icon: Columns,   label: 'Split',    title: 'Editor + Preview' },
  { id: 'preview',    icon: Eye,       label: 'Preview',  title: 'Somente preview' },
  { id: 'graph',      icon: Network,   label: 'Grafo',    title: 'Editor + Preview + Grafo' },
  { id: 'graph-full', icon: Network,   label: 'Grafo Full', title: 'Grafo em Tela Cheia' },
  { id: 'chat',       icon: MessageSquare, label: 'Chat', title: 'Editor + Preview + Chat' },
]

export function EditorHeader({ activeNote, mode, setMode }) {
  if (!activeNote) return null

  return (
    <div
      className="flex items-center justify-between px-4 py-2 flex-shrink-0"
      style={{ borderBottom: '1px solid #313244', background: 'rgba(22,22,34,0.5)' }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-ui-accent text-sm">⬡</span>
          <span className="text-ui-text text-sm font-medium truncate">{activeNote.title}</span>
        </div>

        <span className="text-ui-muted text-[10px] hidden sm:block opacity-50">
          {new Date(activeNote.updated_at || activeNote.updatedAt).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          })}
        </span>
      </div>

      <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'rgba(37,37,53,0.5)' }}>
        {MODES.map(({ id, icon: Icon, label, title }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            title={title}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all ${
              mode === id ? 'text-ui-accent font-semibold' : 'text-ui-muted hover:text-ui-text'
            }`}
            style={mode === id ? { background: 'rgba(49,49,85,0.6)' } : {}}
          >
            <Icon size={13} />
            <span className="hidden lg:inline">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
