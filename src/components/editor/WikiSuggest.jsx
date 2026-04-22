import React from 'react'
import { FileText } from 'lucide-react'

export function WikiSuggest({ suggest, onApply, onClose }) {
  if (!suggest || suggest.items.length === 0) return null

  const hasCursor = suggest.x !== undefined && suggest.y !== undefined

  return (
    <div
      className="fixed inset-0 z-50"
      onMouseDown={onClose}
    >
      <div
        className="rounded-lg overflow-hidden shadow-2xl fade-in"
        style={hasCursor ? {
          position: 'absolute',
          left: Math.min(suggest.x, window.innerWidth - 380),
          top: Math.min(suggest.y, window.innerHeight - 260),
          background: 'rgba(25,25,40,0.98)',
          border: '1px solid #45475a',
          minWidth: 220,
          maxWidth: 360,
        } : {
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(25,25,40,0.98)',
          border: '1px solid #45475a',
          minWidth: 260,
          maxWidth: 380,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-1.5 text-[10px] text-ui-muted uppercase tracking-wider border-b border-ui-hover/30 flex justify-between items-center">
          <span>Notas sugeridas</span>
          <span className="normal-case opacity-50 text-[9px]">ESC para fechar</span>
        </div>
        {suggest.items.map((n, i) => (
          <button
            key={n.id}
            onMouseDown={(e) => { e.preventDefault(); onApply(n.title) }}
            className={`flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors ${
              i === suggest.selectedIdx ? 'bg-ui-accent/15 text-ui-accent' : 'text-ui-text hover:bg-ui-hover'
            }`}
          >
            <FileText size={12} className="opacity-50" />
            <span className="truncate">{n.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
