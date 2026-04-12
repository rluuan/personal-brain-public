import React, { useState, useEffect } from 'react'
import {
  X, Palette, Lock, RefreshCw, Settings, Terminal, Database, Brain, Keyboard
} from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'
import { localStorageKey, encryptText } from '../crypto'
import { dbUpdateNote } from '../db/database'

// Tab components
import { GeneralTab } from './settings/tabs/GeneralTab'
import { AppearanceTab } from './settings/tabs/AppearanceTab'
import { VimTab } from './settings/tabs/VimTab'
import { SecurityTab } from './settings/tabs/SecurityTab'
import { AITab } from './settings/tabs/AITab'
import { DatabaseTab } from './settings/tabs/DatabaseTab'
import { MemoryTab } from './settings/tabs/MemoryTab'
import { ShortcutsTab } from './settings/tabs/ShortcutsTab'

export default function SettingsModal({ onClose, showNotification, revealInExplorer }) {
  const { 
    settings, saveSettings, encryptionKey, user, 
    notes, folders, getServerConfig, saveServerConfig, 
    exportNotesAsMd, exportDb 
  } = useNotesStore()
  
  const [tab, setTab] = useState('general')
  
  // Form State
  const [primary, setPrimary]         = useState(settings.primaryColor)
  const [secondary, setSecondary]     = useState(settings.secondaryColor)
  const [projectName, setProjectName] = useState(settings.extra?.projectName || 'Personal Brain')
  const [aiModel, setAiModel]         = useState(settings.extra?.aiModel || 'gemma3:12b')
  const [embedModel, setEmbedModel]   = useState(settings.extra?.embedModel || 'nomic-embed-text')
  const [fontFamily, setFontFamily]   = useState(settings.extra?.fontFamily || 'Inter')
  const [vimMode, setVimMode]         = useState(settings.extra?.vimMode || false)
  const [vimrc, setVimrc]             = useState(settings.extra?.vimrc || '')
  const [ignoreNovidades, setIgnoreNovidades] = useState(settings.extra?.ignoreNovidades || false)
  const [screenKey, setScreenKey]     = useState(settings.extra?.screenKey || false)
  const [liveMemoryEnabled, setLiveMemoryEnabled] = useState(settings.extra?.liveMemoryEnabled !== false)
  const [backupFormat, setBackupFormat] = useState('json')

  const [saving, setSaving] = useState(false)
  
  // AI Tab State
  const [ollamaStatus, setOllamaStatus] = useState(null)
  const [testingOllama, setTestingOllama] = useState(false)

  const testOllama = async () => {
    setTestingOllama(true)
    setOllamaStatus(null)
    try {
      const res = await fetch(`http://${window.location.hostname}:3001/api/ollama/status`)
      const data = await res.json()
      setOllamaStatus(data)
    } catch (e) {
      setOllamaStatus({ ok: false, error: 'Servidor não respondeu' })
    }
    setTestingOllama(false)
  }

  // Security Tab State
  const [showKey, setShowKey]         = useState(false)
  const [newKey, setNewKey]           = useState('')
  const [confirmKey, setConfirmKey]   = useState('')
  const [keyError, setKeyError]       = useState('')
  const [keySuccess, setKeySuccess]   = useState(false)
  const [updatingKey, setUpdatingKey] = useState(false)

  // Database Tab State
  const [dbConfig, setDbConfig]       = useState(null)
  const [dbSaving, setDbSaving]       = useState(false)
  const [dbMsg, setDbMsg]             = useState('')
  const [exportMsg, setExportMsg]     = useState('')
  const [exporting, setExporting]     = useState(false)

  useEffect(() => {
    if (tab === 'database') {
      getServerConfig().then(cfg => setDbConfig(cfg)).catch(() => {})
    }
  }, [tab, getServerConfig])

  const handleSave = async () => {
    setSaving(true)
    await saveSettings({
      ...settings,
      primaryColor: primary,
      secondaryColor: secondary,
      extra: { 
        ...settings.extra, 
        projectName, aiModel, embedModel, 
        fontFamily, vimMode, vimrc, 
        ignoreNovidades, screenKey, liveMemoryEnabled
      }
    })
    document.body.style.fontFamily = `'${fontFamily}', sans-serif`
    setSaving(false)
    onClose()
  }

  const handleUpdateKey = async () => {
    setKeyError('')
    setKeySuccess(false)
    if (!newKey.trim()) { setKeyError('A chave não pode ser vazia.'); return }
    if (newKey.length < 6) { setKeyError('Use pelo menos 6 caracteres.'); return }
    if (newKey !== confirmKey) { setKeyError('As chaves não coincidem.'); return }
    
    setUpdatingKey(true)
    try {
      await Promise.all(
        notes.map(async (n) => {
          const encTitle   = await encryptText(n.title,   newKey, user.id)
          const encContent = await encryptText(n.content, newKey, user.id)
          return dbUpdateNote(n.id, { title: encTitle, content: encContent })
        })
      )
      localStorage.setItem(localStorageKey(user.id), newKey)
      useNotesStore.setState({ encryptionKey: newKey })
      setNewKey('')
      setConfirmKey('')
      setKeySuccess(true)
    } catch (e) {
      setKeyError('Erro ao atualizar a chave: ' + e.message)
    }
    setUpdatingKey(false)
  }

  const handleSaveDbConfig = async () => {
    if (!dbConfig) return
    setDbSaving(true)
    setDbMsg('')
    try {
      const r = await saveServerConfig(dbConfig)
      setDbMsg(r.message || 'Configuração salva!')
    } catch (e) {
      setDbMsg('Erro: ' + e.message)
    }
    setDbSaving(false)
  }

  const handleExportNotes = async () => {
    setExporting(true)
    setExportMsg('')
    try {
      const r = await exportNotesAsMd(notes, folders)
      showNotification(
        `✅ ${r.count} notas exportadas com sucesso!`, 
        'success', 
        () => revealInExplorer(r.filePath || r.path),
        'Abrir Pasta'
      )
    } catch (e) {
      showNotification('Erro ao exportar: ' + e.message, 'error')
    }
    setExporting(false)
  }

  const handleExportDb = async () => {
    setExporting(true)
    setExportMsg('')
    try {
      const r = await exportDb(backupFormat)
      showNotification(
        `✅ Backup (${backupFormat}) realizado com sucesso!`, 
        'success', 
        () => revealInExplorer(r.filePath || r.path),
        'Abrir Pasta'
      )
    } catch (e) {
      showNotification('Erro no backup: ' + e.message, 'error')
    }
    setExporting(false)
  }

  const tabs = [
    { id: 'general',    label: 'Geral',     icon: Settings },
    { id: 'appearance', label: 'Aparência', icon: Palette },
    { id: 'vim',        label: 'Vim',       icon: Terminal },
    { id: 'security',   label: 'Segurança', icon: Lock },
    { id: 'ai',         label: 'IA',        icon: RefreshCw },
    { id: 'database',   label: 'Banco',     icon: Database },
    { id: 'memoria',    label: 'Memória',   icon: Brain },
    { id: 'shortcuts',  label: 'Atalhos',   icon: Keyboard },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center text-ui-text"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-xl shadow-2xl w-full max-w-3xl fade-in flex flex-col"
        style={{ background: '#1e1e2e', border: '1px solid #313244', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #313244' }}>
          <div className="flex items-center gap-2">
            <Settings size={15} className="text-ui-accent" />
            <span className="text-ui-text font-semibold text-sm">Configurações</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-text transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex px-4 pt-1 gap-1 flex-shrink-0 overflow-x-auto scrollbar-thin" style={{ borderBottom: '1px solid #313244' }}>
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-t transition-colors flex-shrink-0 ${
                  tab === t.id ? 'text-ui-accent border-b-2' : 'text-ui-muted hover:text-ui-text'
                }`}
                style={tab === t.id ? { borderBottomColor: primary } : {}}
              >
                <Icon size={12} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6 scrollbar-thin">
          {tab === 'general' && (
            <GeneralTab 
              projectName={projectName} setProjectName={setProjectName}
              ignoreNovidades={ignoreNovidades} setIgnoreNovidades={setIgnoreNovidades}
              screenKey={screenKey} setScreenKey={setScreenKey}
              liveMemoryEnabled={liveMemoryEnabled} setLiveMemoryEnabled={setLiveMemoryEnabled}
              primary={primary}
            />
          )}
          {tab === 'appearance' && (
            <AppearanceTab 
              primary={primary} setPrimary={setPrimary}
              secondary={secondary} setSecondary={setSecondary}
              fontFamily={fontFamily} setFontFamily={setFontFamily}
            />
          )}
          {tab === 'vim' && (
            <VimTab 
              vimMode={vimMode} setVimMode={setVimMode}
              vimrc={vimrc} setVimrc={setVimrc}
            />
          )}
          {tab === 'security' && (
            <SecurityTab 
              encryptionKey={encryptionKey} 
              showKey={showKey} setShowKey={setShowKey}
              newKey={newKey} setNewKey={setNewKey}
              confirmKey={confirmKey} setConfirmKey={setConfirmKey}
              keyError={keyError} setKeyError={setKeyError}
              keySuccess={keySuccess} setKeySuccess={setKeySuccess}
              handleUpdateKey={handleUpdateKey} updatingKey={updatingKey}
              primary={primary}
            />
          )}
          {tab === 'ai' && (
            <AITab 
              aiModel={aiModel} setAiModel={setAiModel}
              embedModel={embedModel} setEmbedModel={setEmbedModel}
              ollamaStatus={ollamaStatus} testingOllama={testingOllama}
              testOllama={testOllama} primary={primary}
            />
          )}
          {tab === 'database' && (
            <DatabaseTab 
              dbConfig={dbConfig} setDbConfig={setDbConfig}
              dbSaving={dbSaving} handleSaveDbConfig={handleSaveDbConfig}
              dbMsg={dbMsg} handleExportNotes={handleExportNotes}
              handleExportDb={handleExportDb} exporting={exporting}
              exportMsg={exportMsg} backupFormat={backupFormat}
              setBackupFormat={setBackupFormat} notes={notes}
              primary={primary}
            />
          )}
          {tab === 'memoria' && (
            <MemoryTab 
              handleExportNotes={handleExportNotes} 
              exporting={exporting} exportMsg={exportMsg}
              notes={notes} primary={primary}
            />
          )}
          {tab === 'shortcuts' && <ShortcutsTab primary={primary} />}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ borderTop: '1px solid #313244', background: 'rgba(22,22,34,0.3)' }}>
          <div className="text-[10px] text-ui-muted">
            v1.5.0 SOLID · {user?.nickname}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs text-ui-muted hover:text-ui-text transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg text-xs font-bold shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              style={{ background: primary, color: '#1e1e2e' }}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
