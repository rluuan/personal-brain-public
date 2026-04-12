import React, { useState, useRef, useEffect } from 'react'
import { Send, Link } from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'
import { dbSearchLiveMemories } from '../db/database'

const API = `http://${window.location.hostname}:3001`

export default function ChatPanel() {
  const { user } = useNotesStore()
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Vou te ajudar a encontrar textos que você anotou mas já esqueceu 🔍' },
  ])
  const [input, setInput]         = useState('')
  const [rag, setRag]             = useState(false)
  const [ragLiveMemory, setRagLiveMemory] = useState(false)
  const [streaming, setStreaming]   = useState(false)
  const [searching, setSearching]   = useState(false)
  const endRef   = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || streaming) return
    const userMsg = input.trim()
    setInput('')

    const history = messages.slice(1)

    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setStreaming(true)
    setSearching(false)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    const { settings } = useNotesStore.getState()
    const ai_model    = settings.extra?.aiModel
    const embed_model = settings.extra?.embedModel

    // Fetch live memory context if enabled
    let liveMemoryContext = null
    if (ragLiveMemory && user) {
      try {
        const results = await dbSearchLiveMemories(user.id, userMsg, 5)
        if (results.length > 0) {
          liveMemoryContext = results.map(m => `- ${m.title || m.url} (${m.url})`).join('\n')
        }
      } catch { /* ignore */ }
    }

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          user_id: user?.id,
          rag,
          history,
          ai_model,
          embed_model,
          live_memory_context: liveMemoryContext,
        }),
      })
      if (!res.ok) throw new Error(`Servidor: ${res.statusText}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'searching') {
              setSearching(true)
            } else if (evt.type === 'thought') {
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = { ...copy[copy.length - 1], thought: evt.text }
                return copy
              })
            } else if (evt.type === 'start') {
              setSearching(false)
            } else if (evt.type === 'token') {
              setMessages(prev => {
                const copy = [...prev]
                copy[copy.length - 1] = {
                  ...copy[copy.length - 1],
                  content: copy[copy.length - 1].content + evt.token,
                }
                return copy
              })
            } else if (evt.type === 'error') {
              throw new Error(evt.message)
            }
          } catch { /* linha malformada */ }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: `❌ Erro: ${err.message}` }
        return copy
      })
    } finally {
      setStreaming(false)
      setSearching(false)
      inputRef.current?.focus()
    }
  }

  const noSource = !rag && !ragLiveMemory

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(14,14,26,0.4)' }}>
      {/* Header */}
      <div className="flex items-center px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid #313244', background: 'rgba(22,22,34,0.5)' }}>
        <span className="text-ui-text text-sm font-medium">💬 Chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <span className="mr-2 mt-1 text-ui-muted flex-shrink-0" style={{ fontSize: 16 }}>⬡</span>
            )}
            <div
              className="max-w-[80%] rounded-xl px-4 py-2.5 text-sm fade-in"
              style={{
                background: msg.role === 'user' ? 'rgba(137,180,250,0.12)' : 'rgba(37,37,53,0.5)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(137,180,250,0.25)' : '#313244'}`,
                color: '#cdd6f4',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.65,
                wordBreak: 'break-word',
              }}
            >
              {msg.thought && (
                <details className="mb-3 text-xs group cursor-pointer">
                  <summary className="text-ui-muted select-none flex items-center gap-1.5 focus:outline-none">
                    <span className="text-ui-accent font-semibold">🔍 Contexto Encontrado (RAG)</span>
                    <span className="opacity-50 group-open:rotate-90 transition-transform text-[10px]">▶</span>
                  </summary>
                  <div className="mt-2 p-2 rounded bg-black/20 border border-ui-border/50 text-ui-muted whitespace-pre-wrap max-h-40 overflow-y-auto" style={{ lineHeight: 1.4 }}>
                    {msg.thought.trim()}
                  </div>
                </details>
              )}
              {msg.content
                ? msg.content
                : (streaming && i === messages.length - 1)
                  ? <span className="ai-pulse" style={{ color: '#cba6f7' }}>▋</span>
                  : null
              }
            </div>
          </div>
        ))}

        {searching && (
          <div className="flex justify-start">
            <span className="mr-2 mt-1 text-ui-muted flex-shrink-0" style={{ fontSize: 16 }}>⬡</span>
            <div className="rounded-xl px-4 py-2.5 text-xs ai-pulse"
              style={{ background: 'rgba(37,37,53,0.5)', border: '1px solid #313244', color: '#89b4fa' }}>
              🔍 Buscando{rag ? ' nas notas' : ''}{ragLiveMemory ? ' nos links' : ''}…
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #313244' }}>
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
            }}
            placeholder="Pergunte sobre suas notas… (Enter para enviar, Shift+Enter para nova linha)"
            disabled={streaming}
            rows={2}
            className="flex-1 px-3 py-2 rounded-lg text-sm outline-none resize-none"
            style={{
              background: '#252535',
              border: '1px solid #45475a',
              color: '#cdd6f4',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
          />
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {/* RAG notes toggle */}
            <label
              className="flex items-center gap-1 text-[10px] cursor-pointer select-none transition-colors px-2 py-1 rounded-lg"
              style={{
                color: rag ? '#89b4fa' : '#585b70',
                background: rag ? 'rgba(137,180,250,0.08)' : 'transparent',
                border: '1px solid',
                borderColor: rag ? 'rgba(137,180,250,0.25)' : '#313244',
              }}
              title="Busca trechos relevantes das suas notas como contexto"
            >
              <input type="checkbox" checked={rag} onChange={e => setRag(e.target.checked)} className="accent-blue-400 w-3 h-3" />
              <span>Notas</span>
            </label>
            {/* RAG live memory toggle */}
            <label
              className="flex items-center gap-1 text-[10px] cursor-pointer select-none transition-colors px-2 py-1 rounded-lg"
              style={{
                color: ragLiveMemory ? '#60a5fa' : '#585b70',
                background: ragLiveMemory ? 'rgba(96,165,250,0.08)' : 'transparent',
                border: '1px solid',
                borderColor: ragLiveMemory ? 'rgba(96,165,250,0.25)' : '#313244',
              }}
              title="Inclui links visitados como contexto da resposta"
            >
              <input type="checkbox" checked={ragLiveMemory} onChange={e => setRagLiveMemory(e.target.checked)} className="accent-blue-500 w-3 h-3" />
              <Link size={9} />
              <span>Links</span>
            </label>
            <button
              onClick={sendMessage}
              disabled={streaming || !input.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: (streaming || !input.trim()) ? '#313244' : '#89b4fa',
                color: (streaming || !input.trim()) ? '#585b70' : '#1e1e2e',
                height: 42,
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
        <div className="mt-1.5 text-ui-muted text-xs opacity-50">
          {noSource
            ? 'Sem contexto — conversa geral'
            : `🔍 RAG: ${[rag && 'notas', ragLiveMemory && 'links'].filter(Boolean).join(' + ')}`
          }
        </div>
      </div>
    </div>
  )
}
