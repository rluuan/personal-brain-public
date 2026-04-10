import React from 'react'
import { Eye, EyeOff, AlertTriangle, ShieldCheck } from 'lucide-react'

export function SecurityTab({ 
  encryptionKey, showKey, setShowKey, 
  newKey, setNewKey, confirmKey, setConfirmKey, 
  keyError, setKeyError, keySuccess, setKeySuccess, 
  handleUpdateKey, updatingKey, primary 
}) {
  return (
    <>
      <div className="rounded-lg p-3" style={{ background: '#252535', border: '1px solid #313244' }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-ui-muted text-xs">Chave atual (salva neste dispositivo)</span>
          <button onClick={() => setShowKey(s => !s)} className="text-ui-muted hover:text-ui-text transition-colors">
            {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        </div>
        <code className="text-xs font-mono" style={{ color: primary, wordBreak: 'break-all' }}>
          {showKey ? (encryptionKey || '—') : (encryptionKey ? '•'.repeat(Math.min(encryptionKey.length, 24)) : '—')}
        </code>
        <p className="text-ui-muted text-xs mt-2 leading-relaxed" style={{ fontSize: '10px' }}>
          🔒 Sua chave fica armazenada <strong>apenas no localStorage deste navegador</strong>. Ela nunca é enviada ao servidor.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-ui-muted text-xs">Atualizar chave — todas as notas serão re-criptografadas:</p>
        <input
          type={showKey ? 'text' : 'password'} value={newKey}
          onChange={(e) => { setNewKey(e.target.value); setKeyError(''); setKeySuccess(false) }}
          placeholder="Nova chave..."
          className="w-full px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: '#1e1e2e', border: '1px solid #45475a', color: '#cdd6f4', caretColor: primary }}
          onFocus={(e) => (e.target.style.borderColor = primary)} 
          onBlur={(e) => (e.target.style.borderColor = '#45475a')} 
        />
        <input
          type={showKey ? 'text' : 'password'} value={confirmKey}
          onChange={(e) => { setConfirmKey(e.target.value); setKeyError(''); setKeySuccess(false) }}
          placeholder="Confirmar nova chave..."
          className="w-full px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: '#1e1e2e', border: '1px solid #45475a', color: '#cdd6f4', caretColor: primary }}
          onFocus={(e) => (e.target.style.borderColor = primary)} 
          onBlur={(e) => (e.target.style.borderColor = '#45475a')} 
        />
        {keyError && <div className="flex items-center gap-1 text-ui-red text-xs"><AlertTriangle size={11} />{keyError}</div>}
        {keySuccess && <div className="flex items-center gap-1 text-ui-green text-xs"><ShieldCheck size={11} />Chave atualizada!</div>}
        <button onClick={handleUpdateKey} disabled={updatingKey || !newKey.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{ 
            background: newKey.trim() ? 'rgba(203,166,247,0.12)' : 'transparent', 
            border: `1px solid ${newKey.trim() ? primary : '#313244'}`, 
            color: newKey.trim() ? primary : '#6c7086', 
            cursor: newKey.trim() && !updatingKey ? 'pointer' : 'not-allowed', 
            opacity: updatingKey ? 0.7 : 1 
          }}>
          <ShieldCheck size={12} />
          {updatingKey ? 'Re-criptografando…' : 'Atualizar chave'}
        </button>
      </div>
    </>
  )
}
