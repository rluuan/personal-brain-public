import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Hash } from 'lucide-react'

export function TagsSection({ tags }) {
  const [open, setOpen] = useState(false)
  if (!tags || tags.length === 0) return null

  return (
    <div className="mt-2 pt-2" style={{ borderTop: '1px solid #313244' }}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-2 py-1 text-ui-muted text-xs uppercase tracking-wider hover:text-ui-text transition-colors rounded">
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <Hash size={11} /><span>Tags ({tags.length})</span>
      </button>
      {open && (
        <div className="flex flex-wrap gap-1 px-2 pb-2 pt-1 font-mono">
          {tags.map((tag) => <span key={tag} className="tag-pill text-[10px] px-1.5 py-0.5 rounded-md bg-ui-hover/40 text-ui-accent border border-ui-accent/20">#{tag}</span>)}
        </div>
      )}
    </div>
  )
}
