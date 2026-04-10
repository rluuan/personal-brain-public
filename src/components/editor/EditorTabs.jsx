import React from 'react'
import { X } from 'lucide-react'

export function EditorTabs({ openTabs, activeNoteId, notes, setActiveNote, closeTab }) {
  if (openTabs.length === 0) return null

  return (
    <div
      className="flex items-end flex-shrink-0 overflow-x-auto scrollbar-none"
      style={{ background: 'rgba(14,14,26,0.9)', borderBottom: '1px solid #313244', minHeight: 34 }}
    >
      {openTabs.map((tabId) => {
        const tabNote = notes.find(n => n.id === tabId)
        if (!tabNote) return null
        const isActive = tabId === activeNoteId
        return (
          <div
            key={tabId}
            onClick={() => setActiveNote(tabId)}
            className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer flex-shrink-0 group transition-colors"
            style={{
              maxWidth: 180,
              background: isActive ? 'rgba(37,37,53,0.9)' : 'transparent',
              borderRight: '1px solid #313244',
              borderTop: isActive ? '1px solid var(--color-primary)' : '1px solid transparent',
              color: isActive ? 'var(--color-primary)' : '#6c7086',
            }}
          >
            <span className="text-[11px] truncate flex-1" style={{ maxWidth: 120 }}>{tabNote.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tabId) }}
              className="flex-shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
              style={{ color: 'inherit' }}
              title="Fechar aba"
            >
              <X size={10} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
