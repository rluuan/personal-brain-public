import React from 'react'
import { Search, X } from 'lucide-react'

export function FolderFilter({ folderFilter, setFolderFilter }) {
  return (
    <div className="px-2 pt-2 pb-1 flex-shrink-0">
      <div className="relative">
        <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-muted pointer-events-none" />
        <input
          value={folderFilter}
          onChange={(e) => setFolderFilter(e.target.value)}
          placeholder="Filtrar pastas..."
          className="w-full pl-7 pr-7 py-1.5 rounded-lg text-xs outline-none transition-all"
          style={{ background: '#252535', border: '1px solid #313244', color: '#cdd6f4', caretColor: 'var(--color-primary)' }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
          onBlur={(e) => (e.target.style.borderColor = '#313244')}
        />
        {folderFilter && (
          <button
            onClick={() => setFolderFilter('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ui-muted hover:text-ui-text transition-colors"
          >
            <X size={11} />
          </button>
        )}
      </div>
    </div>
  )
}
