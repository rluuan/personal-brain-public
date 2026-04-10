import React from 'react'
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'

export function AITab({ aiModel, setAiModel, embedModel, setEmbedModel, ollamaStatus, testingOllama, testOllama, primary }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] text-ui-muted uppercase mb-1.5 ml-1">Modelo de Chat (Ollama)</label>
        <input type="text" value={aiModel} onChange={(e) => setAiModel(e.target.value)}
          placeholder="Ex: gemma3:12b"
          className="w-full px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: '#252535', border: '1px solid #45475a', color: '#cdd6f4', caretColor: primary }}
          onFocus={(e) => (e.target.style.borderColor = primary)} 
          onBlur={(e) => (e.target.style.borderColor = '#45475a')} 
        />
      </div>
      <div>
        <label className="block text-[10px] text-ui-muted uppercase mb-1.5 ml-1">Modelo de Embedding</label>
        <input type="text" value={embedModel} onChange={(e) => setEmbedModel(e.target.value)}
          placeholder="Ex: nomic-embed-text"
          className="w-full px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: '#252535', border: '1px solid #45475a', color: '#cdd6f4', caretColor: primary }}
          onFocus={(e) => (e.target.style.borderColor = primary)} 
          onBlur={(e) => (e.target.style.borderColor = '#45475a')} 
        />
      </div>

      <div className="pt-1" style={{ borderTop: '1px solid #313244' }}>
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-[10px] text-ui-muted uppercase">Testar conexão Ollama</label>
        </div>
        <button onClick={testOllama} disabled={testingOllama}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{ background: 'rgba(137,180,250,0.12)', border: '1px solid #89b4fa', color: '#89b4fa', opacity: testingOllama ? 0.7 : 1 }}>
          {testingOllama ? <RefreshCw size={11} className="animate-spin" /> : <Wifi size={11} />}
          {testingOllama ? 'Testando...' : 'Testar Ollama'}
        </button>
        {ollamaStatus && (
          <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: ollamaStatus.ok ? 'rgba(166,227,161,0.1)' : 'rgba(243,139,168,0.1)', border: `1px solid ${ollamaStatus.ok ? '#a6e3a1' : '#f38ba8'}` }}>
            {ollamaStatus.ok ? (
              <div>
                <div className="flex items-center gap-1 font-semibold" style={{ color: '#a6e3a1' }}>
                  <Wifi size={11} /> Ollama conectado
                </div>
                <div className="text-ui-muted mt-1">Modelos: {ollamaStatus.models?.join(', ') || 'nenhum instalado'}</div>
              </div>
            ) : (
              <div className="flex items-center gap-1" style={{ color: '#f38ba8' }}>
                <WifiOff size={11} /> Offline: {ollamaStatus.error}
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-[10px] text-ui-muted leading-relaxed px-1">
        ⚠️ Certifique-se que os modelos estão instalados no seu Ollama local.
      </p>
    </div>
  )
}
