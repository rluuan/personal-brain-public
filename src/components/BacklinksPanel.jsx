import React, { useState } from 'react'
import { Link2, ChevronDown, ChevronRight } from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'

export default function BacklinksPanel({ noteId }) {
  const { getBacklinks, setActiveNote } = useNotesStore()
  const [open, setOpen] = useState(true)
  const backlinks = getBacklinks(noteId)

  if (backlinks.length === 0) return null

  return (
    <div
      className="flex-shrink-0"
      style={{ borderTop: '1px solid #313244', background: '#1a1a2e' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-2 text-ui-muted text-xs hover:text-ui-text transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Link2 size={12} />
        <span className="uppercase tracking-wider">
          Backlinks ({backlinks.length})
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {backlinks.map((note) => (
            <button
              key={note.id}
              onClick={() => setActiveNote(note.id)}
              className="text-ui-blue text-xs px-2 py-1 rounded hover:bg-ui-hover transition-colors border"
              style={{ borderColor: '#313244' }}
            >
              ⬡ {note.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
