import React from 'react'
import { Check } from 'lucide-react'

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

const FONT_OPTIONS = [
  { label: 'Inter (padrão)',       value: 'Inter' },
  { label: 'Roboto',               value: 'Roboto' },
  { label: 'JetBrains Mono',       value: 'JetBrains Mono' },
  { label: 'Fira Code',            value: 'Fira Code' },
  { label: 'Source Serif 4',       value: 'Source Serif 4' },
  { label: 'Merriweather',         value: 'Merriweather' },
  { label: 'IBM Plex Mono',        value: 'IBM Plex Mono' },
]

export function AppearanceTab({ primary, setPrimary, secondary, setSecondary, fontFamily, setFontFamily }) {
  return (
    <>
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
    </>
  )
}
