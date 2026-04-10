import React from 'react'
import { FileText } from 'lucide-react'

export function WikiSuggest({ suggest, onApply }) {
  if (!suggest || suggest.items.length === 0) return null

  return (
    <div
      className="absolute left-4 bottom-4 z-50 rounded-lg overflow-hidden shadow-2xl fade-in"
      style={{
        background: 'rgba(25,25,40,0.98)',
        border: '1px solid #45475a',
        minWidth: 220,
      }}
    >
      <div className="px-2.5 py-1.5 text-[10px] text-ui-muted uppercase tracking-wider border-b border-ui-hover/30">
        Notas sugeridas
      </div>
      {suggest.items.map((n, i) => (
        <button
          key={n.id}
          onClick={() => onApply(n.title)}
          className={`flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors ${
            i === suggest.selectedIdx ? 'bg-ui-accent/15 text-ui-accent' : 'text-ui-text hover:bg-ui-hover'
          }`}
        >
          <FileText size={12} className="opacity-50" />
          <span className="truncate">{n.title}</span>
        </button>
      ))}
    </div>
  )
}
