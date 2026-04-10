import React from 'react'
import { Terminal } from 'lucide-react'

export function VimTab({ vimMode, setVimMode, vimrc, setVimrc }) {
  return (
    <>
      <div className="rounded-lg p-4 space-y-3" style={{ background: '#252535', border: '1px solid #313244' }}>
        <div className="flex items-center gap-2 text-ui-accent">
          <Terminal size={14} />
          <span className="text-xs font-semibold">Por que usar Vim?</span>
        </div>
        <p className="text-[11px] text-ui-muted leading-relaxed">
          O modo Vim transforma o editor em uma ferramenta de alta produtividade. Em vez de usar o mouse, você usa comandos de teclado para navegar, editar e manipular texto sem tirar as mãos da linha central. É ideal para quem busca velocidade e precisão na escrita e organização de conhecimento.
        </p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="p-2 rounded bg-black/20 border border-white/5 text-[10px]">
            <span className="text-ui-accent block font-bold mb-0.5">Navegação HJKL</span>
            Mova-se entre linhas e caracteres sem as setas.
          </div>
          <div className="p-2 rounded bg-black/20 border border-white/5 text-[10px]">
            <span className="text-ui-accent block font-bold mb-0.5">Poder Modal</span>
            Alternância rápida entre inserção e comandos.
          </div>
        </div>
      </div>

      <div className="rounded-lg px-4 py-3 flex items-center justify-between gap-4" style={{ background: '#252535', border: '1px solid #313244' }}>
        <div className="min-w-0">
          <div className="text-xs text-ui-text font-medium">Ativar Modo Vim</div>
          <div className="text-[10px] text-ui-muted mt-0.5">Habilita emulação Vim (NORMAL/INSERT) no editor.</div>
        </div>
        <button
          onClick={() => setVimMode(v => !v)}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: vimMode ? 'rgba(166,227,161,0.15)' : 'rgba(69,71,90,0.4)',
            border: `1px solid ${vimMode ? '#a6e3a1' : '#45475a'}`,
            color: vimMode ? '#a6e3a1' : '#6c7086',
            minWidth: 64,
          }}
        >
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: vimMode ? '#a6e3a1' : '#45475a',
            flexShrink: 0,
          }} />
          {vimMode ? 'ON' : 'OFF'}
        </button>
      </div>

      {vimMode && (
        <div className="rounded-lg px-4 py-3 flex flex-col gap-2" style={{ background: '#252535', border: '1px solid #313244' }}>
          <div className="text-xs text-ui-text font-medium">Configuração Vim (vimrc)</div>
          <div className="text-[10px] text-ui-muted">Comandos executados ao carregar. Ex: <span className="font-mono text-ui-accent">set number</span></div>
          <textarea
            value={vimrc}
            onChange={e => setVimrc(e.target.value)}
            placeholder={"set number\nset relativenumber\n\" comentários com aspas duplas"}
            rows={5}
            spellCheck={false}
            style={{
              background: '#1e1e2e',
              border: '1px solid #313244',
              borderRadius: 6,
              color: '#cdd6f4',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              padding: '8px 10px',
              resize: 'vertical',
              outline: 'none',
              lineHeight: 1.6,
            }}
          />
        </div>
      )}
    </>
  )
}
