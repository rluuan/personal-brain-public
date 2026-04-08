import React, { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle, AlertCircle, ShieldAlert } from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'

export default function SyncModal({ onClose }) {
  const { user, notes } = useNotesStore()
  const [status, setStatus] = useState('checking')
  const [progress, setProgress] = useState(0)
  const [syncedCount, setSyncedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [message, setMessage] = useState('')
  
  useEffect(() => {
    checkStatus()
  }, [])
  
  const checkStatus = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:3001/api/sync/status?user_id=${user.id}`)
      if (!res.ok) throw new Error('Erro ao buscar status')
      const data = await res.json()
      setTotalCount(data.total)
      setSyncedCount(data.synced)
      
      if (data.pending === 0 && data.total > 0) {
        setStatus('done')
        setMessage('Tudo sincronizado! Suas notas já estão com os embeddings gerados.')
      } else if (data.total === 0) {
        setStatus('done')
        setMessage('Nenhuma nota para sincronizar. Crie algumas notas primeiro!')
      } else {
        setStatus('idle')
        setMessage(`Há ${data.pending} nota(s) pendente(s) de sincronização de um total de ${data.total}.`)
      }
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  const handleSync = async () => {
    setStatus('syncing')
    setProgress(0)
    setMessage('Sincronizando notas...')
    
    try {
      // Send decrypted notes from memory so the server can embed plaintext.
      // Notes are already decrypted in the store — the server never sees the key.
      const clientNotes = notes.map((n) => ({ id: n.id, title: n.title, content: n.content }))
      const { settings } = useNotesStore.getState()
      const embed_model = settings.extra?.embedModel || 'nomic-embed-text'

      const res = await fetch(`http://${window.location.hostname}:3001/api/sync/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: user.id, 
          notes: clientNotes,
          embed_model: embed_model
        }),
      })
      if (!res.ok) throw new Error('Erro no servidor')
      
      const reader = res.body.getReader()
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
            if (evt.type === 'start') {
              setTotalCount(evt.total)
            } else if (evt.type === 'progress') {
              const pct = evt.total > 0 ? Math.floor((evt.done / evt.total) * 100) : 100
              setProgress(pct)
              setMessage(`Processando: ${evt.note_title}...`)
            } else if (evt.type === 'done') {
              setStatus('done')
              setProgress(100)
              setMessage('Sincronização RAG concluída com sucesso!')
            } else if (evt.type === 'error') {
              throw new Error(evt.message)
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setStatus('error')
      setMessage(`Erro na sincronização: ${err.message}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center fade-in bg-black/60">
      <div className="bg-ui-panel border border-ui-border rounded-xl shadow-2xl p-6 w-full max-w-md relative">
        <h2 className="text-ui-text font-semibold mb-4 text-lg flex items-center gap-2">
          <RefreshCw size={18} className="text-ui-accent" />
          Sincronização IA (RAG)
        </h2>
        
        <p className="text-ui-muted text-sm mb-3 leading-relaxed">
          Gera embeddings das suas notas no banco de dados. Quando estiver 100%, você poderá
          marcar "Buscar nas notas (RAG)" no Chat para que a IA leia seus documentos antes de responder.
        </p>
        <div
          className="flex items-start gap-2 rounded-lg p-3 mb-4 text-xs"
          style={{ background: 'rgba(249,226,175,0.07)', border: '1px solid rgba(249,226,175,0.2)' }}
        >
          <ShieldAlert size={12} className="text-ui-yellow flex-shrink-0 mt-0.5" />
          <span className="text-ui-muted leading-relaxed">
            <strong className="text-ui-yellow">Aviso de privacidade:</strong> O sync envia o conteúdo
            descriptografado ao servidor local (Ollama) para gerar os vetores. Suas notas permanecem
            criptografadas no banco — apenas o processamento de embedding é feito em plaintext.
          </span>
        </div>

        <div className="bg-ui-hover/30 rounded-lg p-4 mb-6 border border-ui-border/50">
          {status === 'checking' && <div className="text-ui-muted text-sm ai-pulse">Verificando banco...</div>}
          
          {(status === 'idle' || status === 'done' || status === 'error') && (
            <div className="text-sm">
              <div className="flex items-center gap-2 mb-2">
                {status === 'done' ? <CheckCircle size={16} className="text-ui-green" /> : 
                 status === 'error' ? <AlertCircle size={16} className="text-ui-red" /> : 
                 <RefreshCw size={16} className="text-ui-accent" />}
                <span className={status === 'error' ? 'text-ui-red' : 'text-ui-text'}>{message}</span>
              </div>
              {totalCount > 0 && (
                <div className="text-ui-muted mt-2 space-y-0.5">
                  <div>Notas com embedding: <strong className="text-ui-text">{syncedCount}</strong></div>
                  <div>Total de notas: <strong className="text-ui-text">{totalCount}</strong></div>
                  {totalCount - syncedCount > 0 && (
                    <div style={{ color: '#f9e2af' }}>⚠️ {totalCount - syncedCount} nota(s) ainda pendente(s)</div>
                  )}
                </div>
              )}
            </div>
          )}

          {status === 'syncing' && (
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-ui-text truncate mr-2">{message}</span>
                <span className="text-ui-accent font-mono">{progress}%</span>
              </div>
              <div className="h-2 w-full bg-ui-hover rounded-full overflow-hidden">
                <div 
                  className="h-full bg-ui-accent transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end mt-2">
          {status !== 'syncing' && (
             <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-ui-muted hover:text-ui-text hover:bg-ui-hover transition-colors"
            >
              Fechar
            </button>
          )}
          {status === 'idle' && (
            <button
              onClick={handleSync}
              className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-all flex items-center gap-2"
              style={{ background: '#89b4fa', color: '#1e1e2e' }}
            >
              <RefreshCw size={14} />
              Iniciar Sincronização
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
