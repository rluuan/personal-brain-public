import React from 'react'
import { CalendarDays, Search, FolderPlus, Upload, FilePlus, RefreshCw } from 'lucide-react'

export function SidebarHeader({ 
  projectName, onSync, openDailyNote, onSearch, 
  createFolder, onImport, createNote 
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0 relative" style={{ borderBottom: '1px solid #313244' }}>
      <div className="flex items-center gap-1.5 z-10 relative">
        <span className="text-ui-accent text-sm">⬡</span>
        <span className="text-ui-accent font-semibold text-sm hidden sm:inline">{projectName || 'Personal Brain'}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <button onClick={onSync} title="Sync IA"
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold text-ui-muted hover:text-ui-accent hover:bg-ui-hover transition-colors pointer-events-auto"
          style={{ border: '1px solid #45475a' }}>
          <RefreshCw size={11} /><span>Sync IA</span>
        </button>
      </div>
      <div className="flex gap-0.5 z-10 relative">
        <button onClick={openDailyNote} className="p-1.5 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-accent transition-colors" title="Nota do dia de hoje"><CalendarDays size={13} /></button>
        <button onClick={onSearch} className="p-1.5 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-text transition-colors" title="Buscar (Ctrl+K)"><Search size={13} /></button>
        <button onClick={() => createFolder('Nova Pasta')} className="p-1.5 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-yellow transition-colors" title="Nova pasta"><FolderPlus size={13} /></button>
        <button onClick={() => onImport(null)} className="p-1.5 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-blue transition-colors" title="Importar (.md, .txt)"><Upload size={13} /></button>
        <button onClick={() => createNote()} className="p-1.5 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-accent transition-colors" title="Nova nota"><FilePlus size={13} /></button>
      </div>
    </div>
  )
}
