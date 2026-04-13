import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen, FilePlus, Upload, FolderPlus, Edit2, Trash2 } from 'lucide-react'
import { NoteItem } from './NoteItem'

export function FolderItem({ folder, notes, subfolders, allFolders, activeNoteId, depth = 0, store, onImport }) {
  const [open, setOpen]             = useState(true)
  const [editing, setEditing]       = useState(false)
  const [name, setName]             = useState(folder.name)
  const [pendingRenameId, setPendingRenameId] = useState(null)
  const folderNotes = [...notes.filter((n) => n.folder_id === folder.id)]
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }))
  
  const submit = () => { 
    if (name.trim()) store.renameFolder(folder.id, name.trim())
    setEditing(false) 
  }

  return (
    <div style={{ paddingLeft: depth * 10 }}>
      <div className="group flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer hover:bg-ui-hover/40 transition-all">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          <span className="text-ui-muted flex-shrink-0">{open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
          <span className="text-ui-accent flex-shrink-0">{open ? <FolderOpen size={12} /> : <Folder size={12} />}</span>
          {editing ? (
            <input 
              autoFocus 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              onBlur={submit} 
              onKeyDown={(e) => { 
                if (e.key === 'Enter') submit()
                if (e.key === 'Escape') setEditing(false) 
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-ui-panel border border-ui-accent rounded px-1 outline-none text-ui-text text-xs" 
            />
          ) : (
            <span className="text-ui-text text-xs truncate flex-1">{folder.name}</span>
          )}
          <span className="text-ui-muted text-[10px]">{folderNotes.length}</span>
        </button>
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button onClick={async (e) => { e.stopPropagation(); const id = await store.createNote('Sem Título', folder.id); setOpen(true); setPendingRenameId(id) }} className="p-0.5 rounded hover:text-ui-green transition-colors text-ui-muted" title="Nova nota"><FilePlus size={10} /></button>
          <button onClick={(e) => { e.stopPropagation(); onImport(folder.id) }} className="p-0.5 rounded hover:text-ui-blue transition-colors text-ui-muted" title="Importar"><Upload size={10} /></button>
          <button onClick={(e) => { e.stopPropagation(); store.createFolder('Nova Pasta', folder.id) }} className="p-0.5 rounded hover:text-ui-yellow transition-colors text-ui-muted" title="Nova subpasta"><FolderPlus size={10} /></button>
          <button onClick={(e) => { e.stopPropagation(); setEditing(true) }} className="p-0.5 rounded hover:text-ui-accent transition-colors text-ui-muted" title="Renomear"><Edit2 size={10} /></button>
          <button onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir "${folder.name}"?`)) store.deleteFolder(folder.id) }} className="p-0.5 rounded hover:text-ui-red transition-colors text-ui-muted" title="Excluir"><Trash2 size={10} /></button>
        </div>
      </div>
      {open && (
        <div>
          {subfolders.map((sub) => (
            <FolderItem 
              key={sub.id} 
              folder={sub} 
              notes={notes}
              subfolders={allFolders.filter((f) => f.parent_id === sub.id)}
              allFolders={allFolders} 
              activeNoteId={activeNoteId} 
              depth={depth + 1} 
              store={store} 
              onImport={onImport} 
            />
          ))}
          {folderNotes.map((note) => (
            <div key={note.id} style={{ paddingLeft: (depth + 1) * 10 + 4 }}>
              <NoteItem
                note={note}
                isActive={note.id === activeNoteId}
                onSelect={store.setActiveNote}
                onDelete={store.deleteNote}
                onRename={store.updateNote}
                autoEdit={note.id === pendingRenameId}
                onAutoEditDone={() => setPendingRenameId(null)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
