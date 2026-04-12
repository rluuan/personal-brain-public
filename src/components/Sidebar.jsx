import React, { useState, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import MetricsModal from './MetricsModal'
import { useNotesStore } from '../store/useNotesStore'

// Sub-components
import { SidebarHeader } from './sidebar/SidebarHeader'
import { FolderFilter } from './sidebar/FolderFilter'
import { FolderItem } from './sidebar/FolderItem'
import { NoteItem } from './sidebar/NoteItem'
import { ScraperPanel } from './sidebar/ScraperPanel'
import { RecentNotes } from './sidebar/RecentNotes'
import { TagsSection } from './sidebar/TagsSection'
import { SidebarFooter } from './sidebar/SidebarFooter'

const FOLDER_ORDER_KEY = 'personal-brain-folder-order'
const NOVIDADES_TITLE = '🚀 Últimas Novidades'

function loadFolderOrder() {
  try { return JSON.parse(localStorage.getItem(FOLDER_ORDER_KEY) || '[]') } catch { return [] }
}
function saveFolderOrder(ids) {
  localStorage.setItem(FOLDER_ORDER_KEY, JSON.stringify(ids))
}
function sortByOrder(folders, order) {
  if (!order.length) return folders
  return [...folders].sort((a, b) => {
    const ia = order.indexOf(a.id)
    const ib = order.indexOf(b.id)
    if (ia === -1 && ib === -1) return 0
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

export default function Sidebar({ onSearch, onSync, onSettings, onImport, onLiveMemoryHistory }) {
  const store = useNotesStore()
  const { notes, folders, activeNoteId, createNote, createFolder, getAllTags, user, logout, openDailyNote, updateNote, deleteNote } = store
  
  const [folderOrder, setFolderOrder] = useState(loadFolderOrder)
  const [showMetrics, setShowMetrics] = useState(false)
  const [dragOverId, setDragOverId]   = useState(null)
  const [folderFilter, setFolderFilter] = useState('')
  const draggingId = useRef(null)

  // ── Drag & Drop Logic ─────────────────────────────────────────────────────
  const handleFolderDragStart = (e, folderId) => {
    e.dataTransfer.setData('folderId', folderId)
    e.dataTransfer.effectAllowed = 'move'
    draggingId.current = folderId
  }
  const handleFolderDragOver = (e, folderId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverId !== folderId) setDragOverId(folderId)
  }
  const handleFolderDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverId(null)
  }
  const handleFolderDragEnd = () => {
    setDragOverId(null)
    draggingId.current = null
  }
  const handleFolderDrop = (e, targetId) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('folderId')
    setDragOverId(null)
    draggingId.current = null
    if (!draggedId || draggedId === targetId) return
    const rootFolderIds = sortByOrder(folders.filter(f => !f.parent_id), folderOrder).map(f => f.id)
    const from = rootFolderIds.indexOf(draggedId)
    const to   = rootFolderIds.indexOf(targetId)
    if (from === -1 || to === -1) return
    const newOrder = [...rootFolderIds]
    newOrder.splice(from, 1)
    newOrder.splice(to, 0, draggedId)
    saveFolderOrder(newOrder)
    setFolderOrder(newOrder)
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  const folderMatchesFilter = (folder, filter) => {
    if (!filter) return true
    const q = filter.toLowerCase()
    if (folder.name.toLowerCase().includes(q)) return true
    const children = folders.filter(f => f.parent_id === folder.id)
    return children.some(child => folderMatchesFilter(child, filter))
  }

  const allRootFolders = sortByOrder(folders.filter((f) => !f.parent_id), folderOrder)
  const rootFolders    = folderFilter
    ? allRootFolders.filter(f => folderMatchesFilter(f, folderFilter))
    : allRootFolders
  const uncategorized = notes.filter((n) => !n.folder_id)
  const allTags       = getAllTags()

  const openNovidades = () => {
    const existing = notes.find(n => n.title === NOVIDADES_TITLE)
    if (existing) store.setActiveNote(existing.id)
  }

  return (
    <div className="flex flex-col h-full sidebar-root" style={{ borderRight: '1px solid #313244' }}>
      <SidebarHeader 
        projectName={store.settings.extra?.projectName}
        onSync={onSync}
        openDailyNote={openDailyNote}
        onSearch={onSearch}
        createFolder={createFolder}
        onImport={onImport}
        createNote={createNote}
        onLiveMemoryHistory={onLiveMemoryHistory}
      />

      <FolderFilter 
        folderFilter={folderFilter} 
        setFolderFilter={setFolderFilter} 
      />

      {/* Tree Section */}
      <div className="flex-1 overflow-y-auto py-1.5 px-1 scrollbar-thin">
        {rootFolders.map((folder) => {
          const isOver    = dragOverId === folder.id
          const isDragging = draggingId.current === folder.id
          return (
            <div
              key={folder.id}
              draggable
              onDragStart={(e)  => handleFolderDragStart(e, folder.id)}
              onDragOver={(e)   => handleFolderDragOver(e, folder.id)}
              onDragLeave={handleFolderDragLeave}
              onDragEnd={handleFolderDragEnd}
              onDrop={(e)       => handleFolderDrop(e, folder.id)}
              className="rounded-lg transition-all duration-150"
              style={{
                opacity: isDragging ? 0.4 : 1,
                border: isOver ? '1px dashed var(--color-primary)' : '1px solid transparent',
                background: isOver ? 'rgba(203,166,247,0.07)' : 'transparent',
              }}
            >
              <FolderItem 
                folder={folder} 
                notes={notes}
                subfolders={folders.filter((f) => f.parent_id === folder.id)}
                allFolders={folders} 
                activeNoteId={activeNoteId} 
                depth={0} 
                store={store} 
                onImport={onImport} 
              />
            </div>
          )
        })}

        {uncategorized.length > 0 && (
          <div className={rootFolders.length > 0 ? 'mt-1 pt-1' : ''} style={rootFolders.length > 0 ? { borderTop: '1px solid #313244' } : {}}>
            {rootFolders.length > 0 && <div className="px-2 py-1 text-ui-muted text-[10px] uppercase tracking-wider">Sem pasta</div>}
            {uncategorized.map((note) => (
              <NoteItem 
                key={note.id} 
                note={note} 
                isActive={note.id === activeNoteId} 
                onSelect={store.setActiveNote} 
                onDelete={deleteNote} 
                onRename={updateNote} 
              />
            ))}
          </div>
        )}

        <TagsSection tags={allTags} />
        
        <RecentNotes 
          notes={notes} 
          activeNoteId={activeNoteId} 
          onSelect={store.setActiveNote} 
        />

        <ScraperPanel folders={folders} onCreate={createNote} />
      </div>

      {/* Announcements */}
      <div className="px-3 py-1.5 flex items-center justify-center" style={{ borderTop: '1px solid #313244' }}>
        <button
          onClick={openNovidades}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-colors hover:bg-ui-hover w-full justify-center"
          style={{ color: 'var(--color-primary)', border: '1px solid rgba(203,166,247,0.2)' }}
        >
          <Sparkles size={10} />
          Últimas Novidades
        </button>
      </div>

      <SidebarFooter 
        user={user}
        noteCount={notes.length}
        onShowMetrics={() => setShowMetrics(true)}
        onSettings={onSettings}
        onLogout={logout}
        projectName={store.settings.extra?.projectName}
      />

      {showMetrics && <MetricsModal onClose={() => setShowMetrics(false)} />}
    </div>
  )
}
