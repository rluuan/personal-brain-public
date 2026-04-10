import React from 'react'
import { Brain } from 'lucide-react'

export function MemoryTab({ handleExportNotes, exporting, exportMsg, notes, primary }) {
  return (
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
          💡 Esta funcionalidade é útil para backups manuais ou para fornecer conhecimento para ferramentas de RAG externas.
        </p>
      </div>
    </div>
  )
}
