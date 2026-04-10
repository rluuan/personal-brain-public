import React, { useState } from 'react'
import { FileText, EyeOff, Edit2, Trash2 } from 'lucide-react'

export function NoteItem({ note, isActive, onSelect, onDelete, onRename }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle]     = useState(note.title)
  const isHidden = localStorage.getItem(`personal-brain-hidden-${note.id}`) === '1'
  
  const submit = () => {
    if (title.trim()) onRename(note.id, { title: title.trim() })
    setEditing(false)
  }

  return (
    <div
      onClick={() => onSelect(note.id)}
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-xs transition-all ${isActive ? 'text-ui-accent' : 'text-ui-text hover:bg-ui-hover/50'}`}
      style={isActive ? { background: 'rgba(49,49,85,0.7)' } : {}}
    >
      <FileText size={12} className="flex-shrink-0 text-ui-muted" />
      {editing ? (
        <input 
          autoFocus 
          value={title} 
          onChange={(e) => setTitle(e.target.value)}
          onBlur={submit} 
          onKeyDown={(e) => { 
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') setEditing(false) 
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-ui-panel border border-ui-accent rounded px-1 outline-none text-ui-text" 
          style={{ minWidth: 0 }} 
        />
      ) : (
        <span className="flex-1 truncate">{note.title}</span>
      )}
      {isHidden && <EyeOff size={10} className="flex-shrink-0 opacity-40" title="Nota oculta" />}
      <div className="hidden group-hover:flex items-center gap-0.5">
        <button 
          onClick={(e) => { e.stopPropagation(); setEditing(true) }} 
          className="p-0.5 rounded hover:text-ui-accent transition-colors" 
          title="Renomear"
        >
          <Edit2 size={10} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir "${note.title}"?`)) onDelete(note.id) }} 
          className="p-0.5 rounded hover:text-ui-red transition-colors" 
          title="Excluir"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}
