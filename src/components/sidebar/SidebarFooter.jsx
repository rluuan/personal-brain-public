import React, { useEffect, useState } from 'react'
import { User, TrendingUp, Settings, LogOut, Github, Download, RefreshCw } from 'lucide-react'

export function SidebarFooter({ user, noteCount, onShowMetrics, onSettings, onLogout, projectName }) {
  const [updateState, setUpdateState] = useState(null)
  const [version, setVersion] = useState(window.updater?.version || null)

  useEffect(() => {
    if (!window.updater?.version) {
      fetch('/api/version').then(r => r.json()).then(d => setVersion(d.version)).catch(() => {})
    }
  }, [])
  // updateState: null | 'available' | { progress: 0-100 } | 'ready'

  useEffect(() => {
    if (!window.updater) return

    window.updater.onUpdateAvailable(() => {
      setUpdateState('available')
    })

    window.updater.onDownloadProgress(({ percent }) => {
      setUpdateState({ progress: Math.round(percent) })
    })

    window.updater.onUpdateDownloaded(() => {
      setUpdateState('ready')
    })
  }, [])

  return (
    <div className="flex flex-col flex-shrink-0">
      {/* Github Credits */}
      <div className="px-3 py-1.5 flex items-center justify-center gap-1.5" style={{ background: 'rgba(18,18,30,0.3)', borderTop: '1px solid #313244' }}>
        <a
          href="https://github.com/rluuan"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-ui-muted hover:text-ui-accent transition-colors group"
        >
          <Github size={10} className="group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-medium tracking-tight">Criado por @rluuan</span>
        </a>
      </div>

      {/* Update bar */}
      {updateState && (
        <div className="px-3 py-1.5 flex flex-col gap-1" style={{ borderTop: '1px solid #313244', background: 'rgba(203,166,247,0.07)' }}>
          {updateState === 'available' && (
            <div className="flex items-center gap-1.5">
              <Download size={10} style={{ color: 'var(--color-primary)' }} />
              <span className="text-[10px]" style={{ color: 'var(--color-primary)' }}>Nova versão disponível — baixando...</span>
            </div>
          )}

          {updateState?.progress !== undefined && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-ui-muted">Baixando atualização...</span>
                <span className="text-[10px]" style={{ color: 'var(--color-primary)' }}>{updateState.progress}%</span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(203,166,247,0.15)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${updateState.progress}%`, background: 'var(--color-primary)' }}
                />
              </div>
            </>
          )}

          {updateState === 'ready' && (
            <button
              onClick={() => window.updater.installUpdate()}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all hover:opacity-90 w-full justify-center"
              style={{ background: 'rgba(203,166,247,0.15)', border: '1px solid rgba(203,166,247,0.35)', color: 'var(--color-primary)' }}
            >
              <RefreshCw size={10} />
              Reiniciar e atualizar
            </button>
          )}
        </div>
      )}

      {/* Main Footer Row */}
      <div className="px-3 py-2.5 flex items-center justify-between gap-2"
        style={{ borderTop: '1px solid #313244', background: 'rgba(18,18,30,0.6)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-primary)', color: '#1e1e2e' }}>
            <User size={14} />
          </div>
          <div className="min-w-0 hidden sm:block">
            <div className="text-xs font-semibold text-ui-text truncate">{user?.nickname}</div>
            <div className="text-[10px] text-ui-muted">{noteCount} nota{noteCount !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {version && (
          <span className="text-[10px] text-ui-muted flex-shrink-0">v{version}</span>
        )}

        <button
          onClick={onShowMetrics}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all hover:opacity-90 flex-shrink-0"
          style={{ background: 'rgba(203,166,247,0.1)', border: '1px solid rgba(203,166,247,0.25)', color: 'var(--color-primary)' }}
          title="Ver métricas de uso"
        >
          <TrendingUp size={10} />
          Métricas
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onSettings} className="p-1.5 rounded hover:bg-ui-hover hover:text-ui-accent transition-colors text-ui-muted" title="Configurações">
            <Settings size={15} />
          </button>
          <button onClick={() => { if (confirm(`Sair do ${projectName || 'Personal Brain'}?`)) onLogout() }}
            className="p-1.5 rounded hover:bg-ui-hover hover:text-ui-red transition-colors text-ui-muted" title="Sair">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
