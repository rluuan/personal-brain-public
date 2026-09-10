import React from 'react'
import { FilePlus, Layers, Inbox, Folder, Hash, CircleDot } from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'
import { NoteItem } from './sidebar/NoteItem'
import { FOLDER_ICONS, getStatusInfo } from '../utils/sidebarOptions'

function useFilterLabel(noteFilter, folders, statuses) {
  if (noteFilter.type === 'folder') {
    if (noteFilter.value === null) return { label: 'Sem pasta', Icon: Inbox, color: undefined }
    const folder = folders.find((f) => f.id === noteFilter.value)
    return { label: folder?.name || 'Pasta', Icon: FOLDER_ICONS[folder?.icon] || Folder, color: folder?.color }
  }
  if (noteFilter.type === 'status') {
    const status = getStatusInfo(noteFilter.value, statuses)
    return { label: status?.label || 'Status', Icon: CircleDot, color: status?.color }
  }
  if (noteFilter.type === 'tag') {
    return { label: `#${noteFilter.value}`, Icon: Hash, color: undefined }
  }
  return { label: 'Todas as notas', Icon: Layers, color: undefined }
}

export default function NoteListColumn() {
  const store = useNotesStore()
  const { notes, folders, activeNoteId, noteFilter, getFilteredNotes, getAllStatuses, createNote, deleteNote, updateNote, setActiveNote } = store
  const filteredNotes = getFilteredNotes()
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }))

  const { label, Icon, color } = useFilterLabel(noteFilter, folders, getAllStatuses())
  const newNoteFolderId = noteFilter.type === 'folder' ? noteFilter.value : null

  return (
    <div className="flex flex-col h-full" style={{ borderRight: '1px solid #313244' }}>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid #313244' }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon size={13} className="flex-shrink-0" style={{ color: color || 'var(--color-primary)' }} />
          <span className="text-ui-text text-xs font-semibold truncate">{label}</span>
          <span className="text-ui-muted text-[10px] flex-shrink-0">{filteredNotes.length}</span>
        </div>
        <button
          onClick={() => createNote('Sem Título', newNoteFolderId)}
          className="p-1 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-accent transition-colors flex-shrink-0"
          title="Nova nota"
        >
          <FilePlus size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1.5 px-1 scrollbar-thin">
        {filteredNotes.length === 0 ? (
          <div className="text-center text-ui-muted text-xs py-8 opacity-60">Nenhuma nota aqui</div>
        ) : (
          filteredNotes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              isActive={note.id === activeNoteId}
              onSelect={setActiveNote}
              onDelete={deleteNote}
              onRename={updateNote}
            />
          ))
        )}
      </div>
    </div>
  )
}
