import React, { useState } from 'react'
import { Brain, RefreshCw, GitBranch, MessageSquare, FileText, Zap } from 'lucide-react'
import { useNotesStore } from '../../../store/useNotesStore'

export function ClaudeMemoryTab({ trackClaudeMemory, setTrackClaudeMemory, primary }) {
  const { claudeProjects, fetchClaudeProjects, syncClaudeProject } = useNotesStore()
  const [syncingProject, setSyncingProject] = useState(null)
  const [syncResults, setSyncResults]       = useState({})

  const handleSync = async (pName) => {
    setSyncingProject(pName)
    const result = await syncClaudeProject(pName)
    setSyncResults(prev => ({ ...prev, [pName]: result }))
    setSyncingProject(null)
  }

  return (
    <>
      {/* Toggle principal */}
      <div className="rounded-lg px-4 py-3 flex items-center justify-between gap-4"
        style={{ background: '#252535', border: '1px solid #313244' }}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-ui-text font-medium">
            <Brain size={12} style={{ color: '#a78bfa' }} />
            Acompanhar Memória do Claude
          </div>
          <div className="text-[10px] text-ui-muted mt-0.5">
            Exibe sessões e subagentes do Claude Code como nós no grafo. Injeta contexto no chat.
          </div>
        </div>
        <button
          onClick={() => setTrackClaudeMemory(v => !v)}
          className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: trackClaudeMemory ? '#a78bfa26' : 'rgba(69,71,90,0.4)',
            border: `1px solid ${trackClaudeMemory ? '#a78bfa' : '#45475a'}`,
            color: trackClaudeMemory ? '#a78bfa' : '#6c7086',
            minWidth: 64,
          }}
        >
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: trackClaudeMemory ? '#a78bfa' : '#45475a', flexShrink: 0 }} />
          {trackClaudeMemory ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Explicação conceitual */}
      <div className="rounded-lg p-4 space-y-4" style={{ background: '#0d0d1a', border: '1px solid #a78bfa22' }}>
        <div className="flex items-center gap-2 mb-1">
          <Brain size={13} style={{ color: '#a78bfa' }} />
          <span className="text-xs font-semibold" style={{ color: '#c4b5fd' }}>Como funciona</span>
        </div>

        <p className="text-[11px] leading-relaxed" style={{ color: '#9484c4' }}>
          O Claude Code registra cada conversa em arquivos <span className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: '#1a1030', color: '#c4b5fd' }}>~/.claude/projects</span>.
          O Personal Brain lê esses arquivos e transforma cada interação em um <strong style={{ color: '#c4b5fd' }}>nó</strong> visível no grafo.
        </p>

        {/* O que é um nó */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-semibold tracking-widest mb-2" style={{ color: '#6d5fa6' }}>O que é um nó</div>

          <NodeExplain icon={<FileText size={11} />} color="#a78bfa" label="Memória (MEMORY.md)" desc="O arquivo de memória persistente do projeto — anotações que o Claude carrega em toda nova conversa." />
          <NodeExplain icon={<MessageSquare size={11} />} color="#60a5fa" label="Sessão" desc="Uma conversa completa com o Claude. Contém pares de pergunta/resposta. Aparece apenas se tiver 2 ou mais trocas." />
          <NodeExplain icon={<Zap size={11} />} color="#f59e0b" label="Subagente" desc="Uma tarefa delegada pelo Claude principal para um agente especializado (Explore, Plan, general-purpose, etc.)." />
        </div>

        {/* O que liga um nó no outro */}
        <div className="space-y-2 pt-2" style={{ borderTop: '1px solid #a78bfa18' }}>
          <div className="text-[10px] uppercase font-semibold tracking-widest mb-2" style={{ color: '#6d5fa6' }}>O que liga um nó a outro</div>

          <LinkExplain color="#a78bfa" label="memory →sessão" desc="O nó de memória se conecta a todas as sessões do projeto — representa o contexto compartilhado." />
          <LinkExplain color="#f59e0b" label="sessão → subagente" desc='Uma sessão se conecta aos subagentes que ela disparou via "spawned" — mostra a árvore de delegação.' />
        </div>

        {/* Regra de exibição */}
        <div className="rounded-lg px-3 py-2.5 text-[10px] leading-relaxed" style={{ background: '#1a1030', border: '1px solid #a78bfa18', color: '#7c6fa6' }}>
          <span style={{ color: '#c4b5fd' }}>Sessões com menos de 2 interações não aparecem no grafo</span> — uma única mensagem não forma uma troca de conhecimento relevante.
        </div>
      </div>

      {/* Projetos encontrados */}
      {trackClaudeMemory && (
        <div className="rounded-lg p-4 space-y-2" style={{ background: '#1a1a2e', border: '1px solid #a78bfa33' }}>
          <div className="flex items-center gap-2 mb-3">
            <GitBranch size={12} style={{ color: '#a78bfa' }} />
            <span className="text-xs font-semibold" style={{ color: '#a78bfa' }}>Projetos Claude Code</span>
            <button
              onClick={fetchClaudeProjects}
              className="ml-auto p-1 rounded transition-colors"
              style={{ color: '#6d5fa6' }}
              onMouseOver={e => e.currentTarget.style.color = '#a78bfa'}
              onMouseOut={e => e.currentTarget.style.color = '#6d5fa6'}
              title="Atualizar lista"
            >
              <RefreshCw size={11} />
            </button>
          </div>

          {!claudeProjects?.length ? (
            <div className="text-[10px] text-ui-muted text-center py-3">
              Nenhum projeto encontrado em <span className="font-mono">~/.claude/projects</span>
            </div>
          ) : claudeProjects.map(p => {
            const hash = [...p.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
            const hue  = Math.abs(hash) % 360
            const result = syncResults[p.name]
            return (
              <div key={p.name} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg"
                style={{ background: `hsla(${hue}, 40%, 15%, 0.5)`, border: `1px solid hsl(${hue}, 50%, 30%)` }}>
                <div className="min-w-0">
                  <div className="text-xs font-mono truncate" style={{ color: `hsl(${hue}, 80%, 75%)` }}>{p.name}</div>
                  <div className="text-[10px] text-ui-muted">{p.sessions} sessão{p.sessions !== 1 ? 'ões' : ''}{p.hasMemory ? ' · tem MEMORY.md' : ''}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {result && (
                    <span className="text-[10px]" style={{ color: result.error ? '#f38ba8' : '#a6e3a1' }}>
                      {result.error ? '✗ erro' : `✓ ${result.synced} nós`}
                    </span>
                  )}
                  <button
                    onClick={() => handleSync(p.name)}
                    disabled={syncingProject === p.name}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold transition-all"
                    style={{
                      background: syncingProject === p.name ? 'rgba(100,80,180,0.2)' : `hsla(${hue}, 60%, 25%, 0.6)`,
                      border: `1px solid hsl(${hue}, 50%, 40%)`,
                      color: syncingProject === p.name ? '#6d5fa6' : `hsl(${hue}, 80%, 70%)`,
                    }}
                  >
                    <RefreshCw size={9} className={syncingProject === p.name ? 'animate-spin' : ''} />
                    SYNC IA
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function NodeExplain({ icon, color, label, desc }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg" style={{ background: '#13102a' }}>
      <span className="mt-0.5 flex-shrink-0" style={{ color }}>{icon}</span>
      <div>
        <div className="text-[11px] font-semibold" style={{ color }}>{label}</div>
        <div className="text-[10px] mt-0.5 leading-relaxed" style={{ color: '#6d5fa6' }}>{desc}</div>
      </div>
    </div>
  )
}

function LinkExplain({ color, label, desc }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg" style={{ background: '#13102a' }}>
      <span className="text-[9px] mt-1 font-mono flex-shrink-0 px-1 py-0.5 rounded" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>{label}</span>
      <div className="text-[10px] leading-relaxed" style={{ color: '#6d5fa6' }}>{desc}</div>
    </div>
  )
}
