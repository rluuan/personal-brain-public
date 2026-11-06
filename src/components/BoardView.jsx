import React, { useState, useRef } from 'react'
import { X, Plus, FileText } from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'
import { FOLDER_COLORS } from '../utils/sidebarOptions'

const NO_STATUS = { id: null, label: 'Sem status', color: 'var(--color-muted)' }

function BoardCard({ note, onOpen, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, note.id)}
      onClick={() => onOpen(note.id)}
      className="rounded-lg p-2.5 mb-2 cursor-pointer transition-all hover:-translate-y-0.5"
      style={{ background: 'rgba(37,37,53,0.7)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center gap-1.5">
        <FileText size={11} className="flex-shrink-0 text-ui-muted" />
        <span className="text-xs text-ui-text truncate">{note.title}</span>
      </div>
    </div>
  )
}

function AddStatusColumn({ onAdd }) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState('')

  const submit = () => {
    if (label.trim()) onAdd(label.trim())
    setLabel('')
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex-shrink-0 w-56 h-10 flex items-center justify-center gap-1.5 rounded-lg text-xs text-ui-muted hover:text-ui-accent hover:bg-ui-hover/40 transition-colors"
        style={{ border: '1px dashed var(--color-border-strong)' }}
      >
        <Plus size={13} /> Novo status
      </button>
    )
  }

  return (
    <div className="flex-shrink-0 w-56 rounded-lg p-2" style={{ background: 'rgba(37,37,53,0.5)', border: '1px solid var(--color-border)' }}>
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setEditing(false) }}
        onBlur={submit}
        placeholder="Nome do status..."
        className="w-full bg-ui-panel border border-ui-accent rounded px-2 py-1 outline-none text-ui-text text-xs"
      />
    </div>
  )
}

export default function BoardView() {
  const store = useNotesStore()
  const { notes, getAllStatuses, updateNote, setActiveNote, setShowBoard, addCustomStatus } = store
  const [dragOverCol, setDragOverCol] = useState(null)
  const draggingNoteId = useRef(null)

  const columns = [NO_STATUS, ...getAllStatuses()]

  const openNote = (noteId) => {
    setActiveNote(noteId)
    setShowBoard(false)
  }

  const onCardDragStart = (e, noteId) => {
    e.dataTransfer.setData('noteId', noteId)
    e.dataTransfer.effectAllowed = 'move'
    draggingNoteId.current = noteId
  }

  const onColumnDrop = (e, statusId) => {
    e.preventDefault()
    setDragOverCol(null)
    const noteId = e.dataTransfer.getData('noteId')
    if (!noteId) return
    updateNote(noteId, { status: statusId })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(22,22,34,0.5)' }}>
        <span className="text-ui-text text-sm font-medium">Quadro</span>
        <button onClick={() => setShowBoard(false)} className="p-1 rounded hover:bg-ui-hover text-ui-muted" title="Fechar quadro">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex items-start gap-3 h-full">
          {columns.map((status) => {
            const columnNotes = notes.filter((n) => (n.status || null) === status.id)
            const isOver = dragOverCol === status.id
            return (
              <div
                key={status.id ?? 'none'}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverCol !== status.id) setDragOverCol(status.id) }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null) }}
                onDrop={(e) => onColumnDrop(e, status.id)}
                className="flex-shrink-0 w-56 h-full flex flex-col rounded-lg transition-all"
                style={{
                  background: isOver ? 'rgba(203,166,247,0.06)' : 'rgba(20,20,32,0.4)',
                  border: isOver ? '1px dashed var(--color-primary)' : '1px solid #232334',
                }}
              >
                <div className="flex items-center gap-1.5 px-2.5 py-2 flex-shrink-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: status.color }} />
                  <span className="text-xs font-semibold text-ui-text truncate flex-1">{status.label}</span>
                  <span className="text-ui-muted text-[10px]">{columnNotes.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
                  {columnNotes.map((note) => (
                    <BoardCard key={note.id} note={note} onOpen={openNote} onDragStart={onCardDragStart} />
                  ))}
                </div>
              </div>
            )
          })}
          <AddStatusColumn onAdd={(label) => addCustomStatus(label, FOLDER_COLORS[columns.length % FOLDER_COLORS.length])} />
        </div>
      </div>
    </div>
  )
}
