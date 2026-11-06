import React from 'react'

export function GeneralTab({
  projectName, setProjectName,
  ignoreNovidades, setIgnoreNovidades,
  screenKey, setScreenKey,
  liveMemoryEnabled, setLiveMemoryEnabled,
  primary,
}) {
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
          style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border-strong)', color: 'var(--color-text)', caretColor: primary }}
          onFocus={(e) => (e.target.style.borderColor = primary)}
          onBlur={(e) => (e.target.style.borderColor = 'var(--color-border-strong)')}
        />
      </div>

      <div className="rounded-lg px-4 py-3 flex items-center justify-between gap-4" style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)' }}>
        <div className="min-w-0">
          <div className="text-xs text-ui-text font-medium">Ignorar Últimas Novidades</div>
          <div className="text-[10px] text-ui-muted mt-0.5">Impede que a nota <span className="font-mono text-ui-accent">🚀 Últimas Novidades</span> seja criada/aberta ao iniciar.</div>
        </div>
        <ToggleButton value={ignoreNovidades} onChange={setIgnoreNovidades} color="#f38ba8" />
      </div>

      <div className="rounded-lg px-4 py-3 flex items-center justify-between gap-4" style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)' }}>
        <div className="min-w-0">
          <div className="text-xs text-ui-text font-medium">Live Memory</div>
          <div className="text-[10px] text-ui-muted mt-0.5">Aceita capturas enviadas pela extensão do Chrome.</div>
        </div>
        <ToggleButton value={liveMemoryEnabled} onChange={setLiveMemoryEnabled} color="#3b82f6" />
      </div>

      <div className="rounded-lg px-4 py-3 flex items-center justify-between gap-4" style={{ background: 'var(--color-panel)', border: '1px solid var(--color-border)' }}>
        <div className="min-w-0">
          <div className="text-xs text-ui-text font-medium">Screenkey</div>
          <div className="text-[10px] text-ui-muted mt-0.5">Exibe cada tecla pressionada na tela em tempo real.</div>
        </div>
        <ToggleButton value={screenKey} onChange={setScreenKey} color="#a6e3a1" />
      </div>

    </>
  )
}

function ToggleButton({ value, onChange, color }) {
  return (
    <button
      onClick={() => onChange(v => !v)}
      className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{
        background: value ? `${color}26` : 'rgba(var(--color-border-strong-rgb),0.4)',
        border: `1px solid ${value ? color : 'var(--color-border-strong)'}`,
        color: value ? color : 'var(--color-muted)',
        minWidth: 64,
      }}
    >
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: value ? color : 'var(--color-border-strong)', flexShrink: 0 }} />
      {value ? 'ON' : 'OFF'}
    </button>
  )
}
