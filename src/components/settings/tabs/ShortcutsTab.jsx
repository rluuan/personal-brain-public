import React from 'react'
import { Keyboard } from 'lucide-react'

export function ShortcutsTab({ primary }) {
  const shortcuts = [
    { group: 'Notas', items: [
      { keys: ['Ctrl', 'N'], desc: 'Criar nova nota (com modal de nome e pasta)' },
      { keys: ['Ctrl', 'K'], desc: 'Abrir busca global' },
    ]},
    { group: 'Abas', items: [
      { keys: ['Ctrl', 'W'], desc: 'Fechar aba ativa' },
      { keys: ['Ctrl', 'Tab'], desc: 'Próxima aba' },
      { keys: ['Ctrl', 'Shift', 'Tab'], desc: 'Aba anterior' },
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
  ]

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-ui-muted">Atalhos de teclado disponíveis no sistema.</p>
      {shortcuts.map(({ group, items }) => (
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
  )
}
