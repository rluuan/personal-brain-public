import React, { useState, useEffect } from 'react'
import {
  X, Palette, Check, Lock, Eye, EyeOff, ShieldCheck, AlertTriangle,
  Database, Download, FolderOpen, RefreshCw, Server, HardDrive,
  Brain, Wifi, WifiOff, Keyboard,
} from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'
import { localStorageKey, encryptText } from '../crypto'
import { dbUpdateNote } from '../db/database'

const PRIMARY_PRESETS = [
  { label: 'Lavanda',  value: '#cba6f7' },
  { label: 'Rosa',     value: '#f5c2e7' },
  { label: 'Verde',    value: '#a6e3a1' },
  { label: 'Azul',     value: '#89dceb' },
  { label: 'Amarelo',  value: '#f9e2af' },
  { label: 'Pêssego',  value: '#fab387' },
  { label: 'Vermelho', value: '#f38ba8' },
  { label: 'Branco',   value: '#cdd6f4' },
]

const SECONDARY_PRESETS = [
  { label: 'Azul',     value: '#89b4fa' },
  { label: 'Ciano',    value: '#89dceb' },
  { label: 'Verde',    value: '#a6e3a1' },
  { label: 'Lavanda',  value: '#cba6f7' },
  { label: 'Amarelo',  value: '#f9e2af' },
  { label: 'Coral',    value: '#fab387' },
  { label: 'Rosa',     value: '#f5c2e7' },
  { label: 'Branco',   value: '#cdd6f4' },
]

export default function SettingsModal({ onClose }) {
  const { settings, saveSettings, encryptionKey, user, notes, folders, getServerConfig, saveServerConfig, exportNotesAsMd, exportDb } = useNotesStore()
  const [tab, setTab] = useState('appearance')
  const [primary, setPrimary]     = useState(settings.primaryColor)
  const [secondary, setSecondary] = useState(settings.secondaryColor)
  const [projectName, setProjectName] = useState(settings.extra?.projectName || 'Personal Brain')
  const [aiModel, setAiModel]         = useState(settings.extra?.aiModel || 'gemma3:12b')
  const [embedModel, setEmbedModel]   = useState(settings.extra?.embedModel || 'nomic-embed-text')
  const [fontFamily, setFontFamily]   = useState(settings.extra?.fontFamily || 'Inter')
  const [backupFormat, setBackupFormat] = useState('json')

  const FONT_OPTIONS = [
    { label: 'Inter (padrão)',       value: 'Inter' },
    { label: 'Roboto',               value: 'Roboto' },
    { label: 'JetBrains Mono',       value: 'JetBrains Mono' },
    { label: 'Fira Code',            value: 'Fira Code' },
    { label: 'Source Serif 4',       value: 'Source Serif 4' },
    { label: 'Merriweather',         value: 'Merriweather' },
    { label: 'IBM Plex Mono',        value: 'IBM Plex Mono' },
  ]
  const [saving, setSaving] = useState(false)

  // AI tab
  const [ollamaStatus, setOllamaStatus] = useState(null) // null | {ok, models} | {ok:false, error}
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

  // Key section
  const [showKey, setShowKey]     = useState(false)
  const [newKey, setNewKey]       = useState('')
  const [confirmKey, setConfirmKey] = useState('')
  const [keyError, setKeyError]   = useState('')
  const [keySuccess, setKeySuccess] = useState(false)
  const [updatingKey, setUpdatingKey] = useState(false)

  // DB config
  const [dbConfig, setDbConfig]   = useState(null)
  const [dbSaving, setDbSaving]   = useState(false)
  const [dbMsg, setDbMsg]         = useState('')
  const [exportMsg, setExportMsg] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (tab === 'database') {
      getServerConfig().then(cfg => setDbConfig(cfg)).catch(() => {})
    }
  }, [tab])

  const handleSave = async () => {
    setSaving(true)
    await saveSettings({
      ...settings,
      primaryColor: primary,
      secondaryColor: secondary,
      extra: { ...settings.extra, projectName, aiModel, embedModel, fontFamily }
    })
    // Apply font immediately
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
      // Pass decrypted notes + folders from client store — server writes them as-is
      const r = await exportNotesAsMd(notes, folders)
      setExportMsg(`✅ ${r.count} notas exportadas.\n📄 memory_complete.md: ${r.memoryFile}`)
    } catch (e) {
      setExportMsg('Erro: ' + e.message)
    }
    setExporting(false)
  }

  const handleExportDb = async () => {
    setExporting(true)
    setExportMsg('')
    try {
      const r = await exportDb(backupFormat)
      setExportMsg(`✅ Backup salvo em: ${r.path}`)
    } catch (e) {
      setExportMsg('Erro: ' + e.message)
    }
    setExporting(false)
  }

  const tabs = [
    { id: 'appearance', label: 'Aparência', icon: Palette },
    { id: 'security',   label: 'Segurança', icon: Lock },
    { id: 'ai',         label: 'IA',        icon: RefreshCw },
    { id: 'database',   label: 'Banco',     icon: Database },
    { id: 'memoria',    label: 'Memória',   icon: Brain },
    { id: 'shortcuts',  label: 'Atalhos',   icon: Keyboard },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-xl shadow-2xl w-full max-w-xl fade-in flex flex-col"
        style={{ background: '#1e1e2e', border: '1px solid #313244', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #313244' }}>
          <div className="flex items-center gap-2">
            <Palette size={15} className="text-ui-accent" />
            <span className="text-ui-text font-semibold text-sm">Configurações</span>
          </div>
<button onClick={onClose} className="p-1 rounded hover:bg-ui-hover text-ui-muted hover:text-ui-text transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-2 gap-1 flex-shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid #313244', scrollbarWidth: 'none' }}>
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1 px-2 py-2 text-xs rounded-t transition-colors flex-shrink-0 ${
                  tab === t.id ? 'text-ui-accent border-b-2' : 'text-ui-muted hover:text-ui-text'
                }`}
                style={tab === t.id ? { borderBottomColor: primary } : {}}
              >
                <Icon size={11} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* ── Appearance ── */}
          {tab === 'appearance' && <>
            <div>
              <label className="block text-xs text-ui-muted uppercase tracking-wider mb-3">Cor primária</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PRIMARY_PRESETS.map((p) => (
                  <button key={p.value} onClick={() => setPrimary(p.value)} title={p.label}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                    style={{ background: p.value, outline: primary === p.value ? `2px solid ${p.value}` : '2px solid transparent', outlineOffset: '2px' }}>
                    {primary === p.value && <Check size={12} color="#1e1e2e" strokeWidth={3} />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="w-8 h-8 rounded cursor-pointer" style={{ background: 'transparent', border: 'none', padding: 0 }} />
                <span className="text-ui-muted text-xs font-mono">{primary}</span>
                <div className="ml-auto flex items-center gap-1.5 text-xs text-ui-muted">
                  <span>Preview:</span>
                  <span className="font-semibold" style={{ color: primary }}>texto ativo</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-ui-muted uppercase tracking-wider mb-3">Cor secundária</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {SECONDARY_PRESETS.map((p) => (
                  <button key={p.value} onClick={() => setSecondary(p.value)} title={p.label}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                    style={{ background: p.value, outline: secondary === p.value ? `2px solid ${p.value}` : '2px solid transparent', outlineOffset: '2px' }}>
                    {secondary === p.value && <Check size={12} color="#1e1e2e" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg px-4 py-3 text-xs space-y-1" style={{ background: '#252535', border: '1px solid #313244' }}>
              <div className="text-ui-muted mb-2">Preview do tema:</div>
              <div style={{ color: primary }}>⬡ Nota ativa · Wiki link</div>
              <div style={{ color: secondary }}>🔗 Link externo · #tag · botão</div>
              <div className="text-ui-text">Texto normal da nota</div>
            </div>

            <div>
              <label className="block text-[10px] text-ui-muted uppercase mb-1.5 ml-1">Nome do Sistema</label>
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ex: My Personal Brain"
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: '#252535', border: '1px solid #45475a', color: '#cdd6f4', caretColor: primary }}
                onFocus={(e) => (e.target.style.borderColor = primary)}
                onBlur={(e) => (e.target.style.borderColor = '#45475a')} />
            </div>

            <div>
              <label className="block text-[10px] text-ui-muted uppercase mb-1.5 ml-1">Fonte da interface</label>
              <div className="grid grid-cols-2 gap-1.5">
                {FONT_OPTIONS.map(f => (
                  <button key={f.value}
                    onClick={() => setFontFamily(f.value)}
                    className="px-3 py-2 rounded-lg text-xs text-left transition-all"
                    style={{
                      fontFamily: `'${f.value}', sans-serif`,
                      background: fontFamily === f.value ? `${primary}20` : '#252535',
                      border: `1px solid ${fontFamily === f.value ? primary : '#45475a'}`,
                      color: fontFamily === f.value ? primary : '#cdd6f4',
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-ui-muted mt-1.5 px-1">Salve para aplicar.</p>
            </div>
          </>}

          {/* ── Security ── */}
          {tab === 'security' && <>
            <div className="rounded-lg p-3" style={{ background: '#252535', border: '1px solid #313244' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-ui-muted text-xs">Chave atual (salva neste dispositivo)</span>
                <button onClick={() => setShowKey(s => !s)} className="text-ui-muted hover:text-ui-text transition-colors">
                  {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <code className="text-xs font-mono" style={{ color: primary, wordBreak: 'break-all' }}>
                {showKey ? (encryptionKey || '—') : (encryptionKey ? '•'.repeat(Math.min(encryptionKey.length, 24)) : '—')}
              </code>
              <p className="text-ui-muted text-xs mt-2 leading-relaxed" style={{ fontSize: '10px' }}>
                🔒 Sua chave fica armazenada <strong>apenas no localStorage deste navegador</strong>. Ela nunca é enviada ao servidor.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-ui-muted text-xs">Atualizar chave — todas as notas serão re-criptografadas:</p>
              <input
                type={showKey ? 'text' : 'password'} value={newKey}
                onChange={(e) => { setNewKey(e.target.value); setKeyError(''); setKeySuccess(false) }}
                placeholder="Nova chave..."
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: '#1e1e2e', border: '1px solid #45475a', color: '#cdd6f4', caretColor: primary }}
                onFocus={(e) => (e.target.style.borderColor = primary)} onBlur={(e) => (e.target.style.borderColor = '#45475a')} />
              <input
                type={showKey ? 'text' : 'password'} value={confirmKey}
                onChange={(e) => { setConfirmKey(e.target.value); setKeyError(''); setKeySuccess(false) }}
                placeholder="Confirmar nova chave..."
                className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: '#1e1e2e', border: '1px solid #45475a', color: '#cdd6f4', caretColor: primary }}
                onFocus={(e) => (e.target.style.borderColor = primary)} onBlur={(e) => (e.target.style.borderColor = '#45475a')} />
              {keyError && <div className="flex items-center gap-1 text-ui-red text-xs"><AlertTriangle size={11} />{keyError}</div>}
              {keySuccess && <div className="flex items-center gap-1 text-ui-green text-xs"><ShieldCheck size={11} />Chave atualizada!</div>}
              <button onClick={handleUpdateKey} disabled={updatingKey || !newKey.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                style={{ background: newKey.trim() ? 'rgba(203,166,247,0.12)' : 'transparent', border: `1px solid ${newKey.trim() ? primary : '#313244'}`, color: newKey.trim() ? primary : '#6c7086', cursor: newKey.trim() && !updatingKey ? 'pointer' : 'not-allowed', opacity: updatingKey ? 0.7 : 1 }}>
                <ShieldCheck size={12} />
                {updatingKey ? 'Re-criptografando…' : 'Atualizar chave'}
              </button>
            </div>
          </>}

          {/* ── AI ── */}
          {tab === 'ai' && <>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-ui-muted uppercase mb-1.5 ml-1">Modelo de Chat (Ollama)</label>
                <input type="text" value={aiModel} onChange={(e) => setAiModel(e.target.value)}
                  placeholder="Ex: gemma3:12b"
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                  style={{ background: '#252535', border: '1px solid #45475a', color: '#cdd6f4', caretColor: primary }}
                  onFocus={(e) => (e.target.style.borderColor = primary)} onBlur={(e) => (e.target.style.borderColor = '#45475a')} />
              </div>
              <div>
                <label className="block text-[10px] text-ui-muted uppercase mb-1.5 ml-1">Modelo de Embedding</label>
                <input type="text" value={embedModel} onChange={(e) => setEmbedModel(e.target.value)}
                  placeholder="Ex: nomic-embed-text"
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                  style={{ background: '#252535', border: '1px solid #45475a', color: '#cdd6f4', caretColor: primary }}
                  onFocus={(e) => (e.target.style.borderColor = primary)} onBlur={(e) => (e.target.style.borderColor = '#45475a')} />
              </div>

              {/* Ollama test */}
              <div className="pt-1" style={{ borderTop: '1px solid #313244' }}>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-[10px] text-ui-muted uppercase">Testar conexão Ollama</label>
                </div>
                <button onClick={testOllama} disabled={testingOllama}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                  style={{ background: 'rgba(137,180,250,0.12)', border: '1px solid #89b4fa', color: '#89b4fa', opacity: testingOllama ? 0.7 : 1 }}>
                  {testingOllama ? <RefreshCw size={11} className="animate-spin" /> : <Wifi size={11} />}
                  {testingOllama ? 'Testando...' : 'Testar Ollama'}
                </button>
                {ollamaStatus && (
                  <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: ollamaStatus.ok ? 'rgba(166,227,161,0.1)' : 'rgba(243,139,168,0.1)', border: `1px solid ${ollamaStatus.ok ? '#a6e3a1' : '#f38ba8'}` }}>
                    {ollamaStatus.ok ? (
                      <div>
                        <div className="flex items-center gap-1 font-semibold" style={{ color: '#a6e3a1' }}>
                          <Wifi size={11} /> Ollama conectado
                        </div>
                        <div className="text-ui-muted mt-1">Modelos: {ollamaStatus.models?.join(', ') || 'nenhum instalado'}</div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1" style={{ color: '#f38ba8' }}>
                        <WifiOff size={11} /> Offline: {ollamaStatus.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-ui-muted leading-relaxed px-1">
                ⚠️ Certifique-se que os modelos estão instalados no seu Ollama local.
              </p>
            </div>
          </>}

          {/* ── Database & Export ── */}
          {tab === 'database' && <>
            {!dbConfig ? (
              <div className="text-ui-muted text-xs text-center py-4">Carregando configuração...</div>
            ) : (
              <>
                {/* DB type toggle */}
                <div>
                  <label className="block text-xs text-ui-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Server size={11} /> Tipo de Banco de Dados
                  </label>
                  <div className="flex gap-2">
                    {['postgres', 'sqlite'].map(type => (
                      <button key={type}
                        onClick={() => setDbConfig(c => ({ ...c, dbType: type }))}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all"
                        style={{
                          background: dbConfig.dbType === type ? 'rgba(203,166,247,0.15)' : '#252535',
                          border: `1px solid ${dbConfig.dbType === type ? primary : '#45475a'}`,
                          color: dbConfig.dbType === type ? primary : '#a6adc8',
                        }}>
                        {type === 'postgres' ? <Database size={11} /> : <HardDrive size={11} />}
                        {type === 'postgres' ? 'PostgreSQL' : 'SQLite'}
                        {dbConfig.dbType === type && <Check size={10} />}
                      </button>
                    ))}
                  </div>
                  {dbConfig.dbType === 'sqlite' && (
                    <p className="text-[10px] text-ui-muted mt-2 px-1">📄 Arquivo: <code style={{ color: primary }}>{dbConfig.sqliteFile}</code></p>
                  )}
                </div>

                {/* PostgreSQL fields */}
                {dbConfig.dbType === 'postgres' && (
                  <div className="space-y-3">
                    <label className="block text-xs text-ui-muted uppercase tracking-wider flex items-center gap-1.5">
                      <Database size={11} /> Conexão PostgreSQL
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'host',     label: 'Host',     placeholder: 'localhost' },
                        { key: 'port',     label: 'Port',     placeholder: '5432' },
                        { key: 'user',     label: 'Usuário',  placeholder: 'postgres' },
                        { key: 'password', label: 'Senha',    placeholder: '••••••••', type: 'password' },
                        { key: 'database', label: 'Database', placeholder: 'postgres' },
                      ].map(field => (
                        <div key={field.key} className={field.key === 'database' ? 'col-span-2' : ''}>
                          <label className="block text-[10px] text-ui-muted uppercase mb-1 ml-1">{field.label}</label>
                          <input
                            type={field.type || 'text'}
                            value={dbConfig[field.key] || ''}
                            onChange={(e) => setDbConfig(c => ({ ...c, [field.key]: e.target.value }))}
                            placeholder={field.placeholder}
                            className="w-full px-2 py-1.5 rounded text-xs outline-none"
                            style={{ background: '#1e1e2e', border: '1px solid #45475a', color: '#cdd6f4' }}
                            onFocus={(e) => (e.target.style.borderColor = primary)}
                            onBlur={(e) => (e.target.style.borderColor = '#45475a')} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={handleSaveDbConfig} disabled={dbSaving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full justify-center"
                  style={{ background: `${primary}22`, border: `1px solid ${primary}`, color: primary, opacity: dbSaving ? 0.7 : 1 }}>
                  <Database size={12} />
                  {dbSaving ? 'Salvando...' : 'Salvar Configuração do Banco'}
                </button>
                {dbMsg && <p className="text-[10px] text-ui-muted px-1">{dbMsg}</p>}

                {/* Export */}
                <div style={{ borderTop: '1px solid #313244', paddingTop: '1rem' }}>
                  <label className="block text-xs text-ui-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Download size={11} /> Exportar & Backup
                  </label>
                   <div className="space-y-2">
                    <button onClick={handleExportNotes} disabled={exporting}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-all"
                      style={{ background: '#252535', border: '1px solid #45475a', color: '#cdd6f4' }}>
                      <FolderOpen size={13} className="text-ui-accent" />
                      <div className="text-left">
                        <div className="font-medium">Exportar notas como .md</div>
                        <div className="text-ui-muted text-[10px]">Salva todas as notas em pastas organizadas (para uso em outras IAs)</div>
                      </div>
                    </button>

                    <div className="flex flex-col gap-1">
                      <div className="flex bg-[#252535] border border-[#45475a] rounded-lg overflow-hidden h-[54px]">
                        <button onClick={handleExportDb} disabled={exporting}
                          className="flex-1 flex items-center gap-2 px-3 py-2 text-xs transition-all hover:bg-ui-hover">
                          <HardDrive size={13} className="text-ui-accent" />
                          <div className="text-left">
                            <div className="font-medium">Backup do banco</div>
                            <div className="text-ui-muted text-[10px]">Total: {notes.length} notas</div>
                          </div>
                        </button>
                        <div className="flex flex-col w-12 border-l border-[#45475a]">
                          {['json', 'csv'].map(f => (
                            <button key={f}
                              onClick={() => setBackupFormat(f)}
                              title={`Formato: ${f.toUpperCase()}`}
                              className="flex-1 text-[10px] font-bold uppercase transition-all"
                              style={{
                                background: backupFormat === f ? `${primary}20` : 'transparent',
                                color: backupFormat === f ? primary : '#6c7086',
                                borderTop: f === 'csv' ? '1px solid #45475a' : 'none'
                              }}>
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  {exporting && <p className="text-[10px] text-ui-muted mt-2 animate-pulse">Exportando...</p>}
                  {exportMsg && <p className="text-[10px] mt-2 px-1" style={{ color: exportMsg.startsWith('✅') ? '#a6e3a1' : '#f38ba8' }}>{exportMsg}</p>}
                </div>
              </>
            )}
          </>}

          {/* ── Atalhos ── */}
          {tab === 'shortcuts' && (
            <div className="space-y-4">
              <p className="text-[10px] text-ui-muted">Atalhos de teclado disponíveis no sistema.</p>
              {[
                { group: 'Notas', items: [
                  { keys: ['Ctrl', 'N'], desc: 'Criar nova nota (com modal de nome e pasta)' },
                  { keys: ['Ctrl', 'K'], desc: 'Abrir busca global' },
                ]},
                { group: 'Editor', items: [
                  { keys: ['Ctrl', 'B'], desc: 'Negrito' },
                  { keys: ['Ctrl', 'I'], desc: 'Itálico' },
                  { keys: ['Ctrl', 'S'], desc: 'Salvar nota manualmente' },
                ]},
                { group: 'Navegação', items: [
                  { keys: ['↑', '↓'], desc: 'Navegar sugestões de wikilink' },
                  { keys: ['Enter'], desc: 'Confirmar sugestão de wikilink' },
                  { keys: ['Esc'], desc: 'Fechar modal / cancelar sugestão' },
                ]},
              ].map(({ group, items }) => (
                <div key={group}>
                  <div className="text-[10px] text-ui-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Keyboard size={10} />{group}
                  </div>
                  <div className="space-y-1.5">
                    {items.map(({ keys, desc }) => (
                      <div key={desc} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#252535', border: '1px solid #313244' }}>
                        <span className="text-xs text-ui-text">{desc}</span>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                          {keys.map((k, i) => (
                            <React.Fragment key={k}>
                              {i > 0 && <span className="text-ui-muted text-[10px]">+</span>}
                              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold" style={{ background: '#1e1e2e', border: '1px solid #45475a', color: primary }}>{k}</kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Memória ── */}
          {tab === 'memoria' && <>
            <div className="space-y-4">
              <div className="rounded-lg p-3" style={{ background: '#252535', border: '1px solid #313244' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Brain size={13} className="text-ui-accent" />
                  <span className="text-xs font-semibold text-ui-text">Exportar Memória</span>
                </div>
                <p className="text-[10px] text-ui-muted leading-relaxed">
                  Exporta todas as suas notas <strong>descriptografadas</strong> como arquivos <code>.md</code>, organizadas por pasta.
                  Também gera um arquivo <code>memory_complete.md</code> com tudo concatenado — ideal para usar como contexto em outras IAs.
                </p>
              </div>

              <button onClick={handleExportNotes} disabled={exporting}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs transition-all"
                style={{ background: `${primary}15`, border: `1px solid ${primary}`, color: primary }}>
                <Brain size={15} />
                <div className="text-left">
                  <div className="font-semibold">Exportar Memória Completa</div>
                  <div className="opacity-70 text-[10px] mt-0.5">{notes.length} notas · Inclui memory_complete.md</div>
                </div>
              </button>

              {exporting && <p className="text-[10px] text-ui-muted animate-pulse">Exportando...</p>}
              {exportMsg && (
                <div className="rounded-lg p-3 text-[10px] leading-relaxed"
                  style={{ background: exportMsg.startsWith('✅') ? 'rgba(166,227,161,0.1)' : 'rgba(243,139,168,0.1)', border: `1px solid ${exportMsg.startsWith('✅') ? '#a6e3a1' : '#f38ba8'}`, color: exportMsg.startsWith('✅') ? '#a6e3a1' : '#f38ba8' }}>
                  {exportMsg.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                </div>
              )}

              <div className="rounded-lg p-3" style={{ background: '#252535', border: '1px solid #313244' }}>
                <p className="text-[10px] text-ui-muted leading-relaxed">
                  💡 <strong>Dica:</strong> Use o <code>memory_complete.md</code> no ChatGPT, Claude ou qualquer IA com janela de contexto grande para que ela "conheça" suas notas.
                </p>
              </div>
            </div>
          </>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 flex-shrink-0" style={{ borderTop: '1px solid #313244' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs text-ui-muted hover:text-ui-text transition-colors" style={{ background: '#252535' }}>
            Cancelar
          </button>
          {tab !== 'database' && tab !== 'memoria' && tab !== 'shortcuts' && (
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{ background: primary, color: '#1e1e2e', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
