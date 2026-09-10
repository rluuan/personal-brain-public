import { Edit3, Network, MessageSquare } from 'lucide-react'
import { getStatusInfo } from '../../utils/sidebarOptions'

const MODES = [
  { id: 'edit',       icon: Edit3,     label: 'Editar',   title: 'Editor' },
  { id: 'graph',      icon: Network,   label: 'Grafo',    title: 'Editor + Preview + Grafo' },
  { id: 'graph-full', icon: Network,   label: 'Grafo Full', title: 'Grafo em Tela Cheia' },
  { id: 'chat',       icon: MessageSquare, label: 'Chat', title: 'Editor + Preview + Chat' },
]

export function EditorHeader({ activeNote, mode, setMode, onStatusChange, statuses = [] }) {
  if (!activeNote) return null
  const statusInfo = getStatusInfo(activeNote.status, statuses)

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

        <select
          value={activeNote.status || ''}
          onChange={(e) => onStatusChange?.(e.target.value || null)}
          className="px-2 py-0.5 rounded-md text-[10px] outline-none cursor-pointer flex-shrink-0"
          style={{
            background: statusInfo ? `${statusInfo.color}22` : 'rgba(37,37,53,0.6)',
            color: statusInfo ? statusInfo.color : '#a6adc8',
            border: `1px solid ${statusInfo ? `${statusInfo.color}55` : '#45475a'}`,
          }}
          title="Status da nota"
        >
          <option value="">Sem status</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
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
