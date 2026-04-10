import React from 'react'
import { Server, Database, HardDrive, Check, Download, FolderOpen } from 'lucide-react'

export function DatabaseTab({ 
  dbConfig, setDbConfig, dbSaving, handleSaveDbConfig, dbMsg,
  handleExportNotes, handleExportDb, exporting, exportMsg,
  backupFormat, setBackupFormat, notes, primary 
}) {
  if (!dbConfig) {
    return <div className="text-ui-muted text-xs text-center py-4">Carregando configuração...</div>
  }

  return (
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
                  onBlur={(e) => (e.target.style.borderColor = '#45475a')} 
                />
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
  )
}
