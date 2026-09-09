import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen, FilePlus, Upload, FolderPlus, Edit2, Trash2 } from 'lucide-react'
import { FolderColorIconPicker } from './FolderColorIconPicker'
import { FOLDER_ICONS } from '../../utils/sidebarOptions'

export function FolderItem({ folder, notes, subfolders, allFolders, activeFilter, depth = 0, store, onImport }) {
  const [open, setOpen]       = useState(true)
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(folder.name)
  const folderNoteCount = notes.filter((n) => n.folder_id === folder.id).length
  const isActive = activeFilter?.type === 'folder' && activeFilter.value === folder.id

  const submit = () => {
    if (name.trim()) store.renameFolder(folder.id, name.trim())
    setEditing(false)
  }

  const CustomIcon = FOLDER_ICONS[folder.icon]
  const iconColor = folder.color || undefined

  return (
    <div style={{ paddingLeft: depth * 10 }}>
      <div
        className="group flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer hover:bg-ui-hover/40 transition-all"
        style={isActive ? { background: 'rgba(49,49,85,0.7)' } : {}}
        onClick={() => store.setNoteFilter('folder', folder.id)}
      >
        <button onClick={(e) => { e.stopPropagation(); setOpen(!open) }} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          <span className="text-ui-muted flex-shrink-0">{open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>
          <span className="flex-shrink-0" style={{ color: iconColor || 'var(--color-primary)' }}>
            {CustomIcon ? <CustomIcon size={12} /> : (open ? <FolderOpen size={12} /> : <Folder size={12} />)}
          </span>
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
            <span className={`text-xs truncate flex-1 ${isActive ? 'text-ui-accent font-semibold' : 'text-ui-text'}`}>{folder.name}</span>
          )}
          <span className="text-ui-muted text-[10px]">{folderNoteCount}</span>
        </button>
        <div className="hidden group-hover:flex items-center gap-0.5">
          <FolderColorIconPicker folder={folder} onChange={(changes) => store.updateFolder(folder.id, changes)} />
          <button onClick={async (e) => { e.stopPropagation(); await store.createNote('Sem Título', folder.id); setOpen(true) }} className="p-0.5 rounded hover:text-ui-green transition-colors text-ui-muted" title="Nova nota"><FilePlus size={10} /></button>
          <button onClick={(e) => { e.stopPropagation(); onImport(folder.id) }} className="p-0.5 rounded hover:text-ui-blue transition-colors text-ui-muted" title="Importar"><Upload size={10} /></button>
          <button onClick={(e) => { e.stopPropagation(); store.createFolder('Nova Pasta', folder.id) }} className="p-0.5 rounded hover:text-ui-yellow transition-colors text-ui-muted" title="Nova subpasta"><FolderPlus size={10} /></button>
          <button onClick={(e) => { e.stopPropagation(); setEditing(true) }} className="p-0.5 rounded hover:text-ui-accent transition-colors text-ui-muted" title="Renomear"><Edit2 size={10} /></button>
          <button onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir "${folder.name}"?`)) store.deleteFolder(folder.id) }} className="p-0.5 rounded hover:text-ui-red transition-colors text-ui-muted" title="Excluir"><Trash2 size={10} /></button>
        </div>
      </div>
      {open && subfolders.length > 0 && (
        <div>
          {subfolders.map((sub) => (
            <FolderItem
              key={sub.id}
              folder={sub}
              notes={notes}
              subfolders={allFolders.filter((f) => f.parent_id === sub.id)}
              allFolders={allFolders}
              activeFilter={activeFilter}
              depth={depth + 1}
              store={store}
              onImport={onImport}
            />
          ))}
        </div>
      )}
    </div>
  )
}
