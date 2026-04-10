import React from 'react'

export function GeneralTab({ projectName, setProjectName, ignoreNovidades, setIgnoreNovidades, screenKey, setScreenKey, primary }) {
  return (
    <>
      <div>
        <label className="block text-[10px] text-ui-muted uppercase mb-1.5 ml-1">Nome do Sistema</label>
        <input 
          type="text" 
          value={projectName} 
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Ex: My Personal Brain"
          className="w-full px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: '#252535', border: '1px solid #45475a', color: '#cdd6f4', caretColor: primary }}
          onFocus={(e) => (e.target.style.borderColor = primary)}
          onBlur={(e) => (e.target.style.borderColor = '#45475a')} 
        />
      </div>

      <div className="rounded-lg px-4 py-3 flex items-center justify-between gap-4" style={{ background: '#252535', border: '1px solid #313244' }}>
        <div className="min-w-0">
          <div className="text-xs text-ui-text font-medium">Ignorar Últimas Novidades</div>
          <div className="text-[10px] text-ui-muted mt-0.5">Impede que a nota <span className="font-mono text-ui-accent">🚀 Últimas Novidades</span> seja criada/aberta ao iniciar.</div>
        </div>
        <button
          onClick={() => setIgnoreNovidades(v => !v)}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: ignoreNovidades ? 'rgba(243,139,168,0.15)' : 'rgba(69,71,90,0.4)',
            border: `1px solid ${ignoreNovidades ? '#f38ba8' : '#45475a'}`,
            color: ignoreNovidades ? '#f38ba8' : '#6c7086',
            minWidth: 64,
          }}
        >
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: ignoreNovidades ? '#f38ba8' : '#45475a',
            flexShrink: 0,
          }} />
          {ignoreNovidades ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="rounded-lg px-4 py-3 flex items-center justify-between gap-4" style={{ background: '#252535', border: '1px solid #313244' }}>
        <div className="min-w-0">
          <div className="text-xs text-ui-text font-medium">Screenkey</div>
          <div className="text-[10px] text-ui-muted mt-0.5">Exibe cada tecla pressionada na tela em tempo real, como o <span className="font-mono text-ui-accent">Screenkey</span> do Linux.</div>
        </div>
        <button
          onClick={() => setScreenKey(v => !v)}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: screenKey ? 'rgba(166,227,161,0.15)' : 'rgba(69,71,90,0.4)',
            border: `1px solid ${screenKey ? '#a6e3a1' : '#45475a'}`,
            color: screenKey ? '#a6e3a1' : '#6c7086',
            minWidth: 64,
          }}
        >
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: screenKey ? '#a6e3a1' : '#45475a',
            flexShrink: 0,
          }} />
          {screenKey ? 'ON' : 'OFF'}
        </button>
      </div>
    </>
  )
}
