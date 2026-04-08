import React, { useState, useRef, useEffect } from 'react'
import { Lock, Eye, EyeOff, ShieldCheck, AlertTriangle } from 'lucide-react'

/**
 * Shown when the user is logged in but has no encryption key stored in localStorage.
 * Two modes:
 *  - "enter": returning user on a new device — enters their existing key
 *  - "create": first access ever — chooses a new key and confirms it
 *
 * Props:
 *  hasEncryptedNotes {boolean} — if true, user already has encrypted data; force "enter" mode
 *  onConfirm(key: string) — called with the validated key
 */
export default function KeyModal({ hasEncryptedNotes, onConfirm }) {
  const [mode, setMode]         = useState(hasEncryptedNotes ? 'enter' : 'create')
  const [key, setKey]           = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showKey, setShowKey]   = useState(false)
  const [error, setError]       = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [mode])

  const submit = () => {
    setError('')
    if (!key.trim()) { setError('A chave não pode ser vazia.'); return }
    if (mode === 'create') {
      if (key.length < 6) { setError('Use pelo menos 6 caracteres.'); return }
      if (key !== confirm) { setError('As chaves não coincidem.'); return }
    }
    onConfirm(key)
  }

  const inputStyle = {
    background: 'rgba(49,49,68,0.8)',
    border: '1px solid #45475a',
    caretColor: '#cba6f7',
    color: '#cdd6f4',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 fade-in"
        style={{
          background: 'rgba(22,22,36,0.98)',
          border: '1px solid #313244',
          boxShadow: '0 0 60px rgba(203,166,247,0.12)',
        }}
      >
        {/* Icon + title */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'rgba(203,166,247,0.12)', border: '1px solid rgba(203,166,247,0.3)' }}
          >
            <Lock size={24} className="text-ui-accent" />
          </div>
          <h2 className="text-ui-text text-lg font-semibold">Chave de Criptografia</h2>
          <p className="text-ui-muted text-xs mt-1 text-center leading-relaxed">
            {mode === 'create'
              ? 'Suas notas serão criptografadas localmente. Escolha uma chave — ela nunca é enviada ao servidor.'
              : 'Este dispositivo não tem sua chave salva. Insira a chave que você configurou anteriormente.'}
          </p>
        </div>

        {/* Mode tabs (only if no encrypted notes yet) */}
        {!hasEncryptedNotes && (
          <div className="flex rounded-lg overflow-hidden mb-5" style={{ border: '1px solid #313244' }}>
            {['create', 'enter'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className="flex-1 py-2 text-xs font-medium transition-colors"
                style={{
                  background: mode === m ? 'rgba(203,166,247,0.15)' : 'transparent',
                  color: mode === m ? '#cba6f7' : '#6c7086',
                  borderRight: m === 'create' ? '1px solid #313244' : 'none',
                }}
              >
                {m === 'create' ? 'Nova chave' : 'Já tenho chave'}
              </button>
            ))}
          </div>
        )}

        {/* Key input */}
        <div className="relative mb-3">
          <input
            ref={inputRef}
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => { setKey(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && (mode === 'create' ? document.getElementById('key-confirm')?.focus() : submit())}
            placeholder={mode === 'create' ? 'Escolha uma chave secreta...' : 'Sua chave de criptografia...'}
            className="w-full px-4 py-3 rounded-lg text-sm outline-none pr-10"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#cba6f7')}
            onBlur={(e)  => (e.target.style.borderColor = '#45475a')}
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ui-muted hover:text-ui-text transition-colors"
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {/* Confirm input (create mode only) */}
        {mode === 'create' && (
          <input
            id="key-confirm"
            type={showKey ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Confirme a chave..."
            className="w-full px-4 py-3 rounded-lg text-sm outline-none mb-3"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#cba6f7')}
            onBlur={(e)  => (e.target.style.borderColor = '#45475a')}
          />
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-1.5 text-ui-red text-xs mb-3">
            <AlertTriangle size={12} />
            <span>{error}</span>
          </div>
        )}

        {/* Warning */}
        <div
          className="flex items-start gap-2 rounded-lg p-3 mb-5 text-xs"
          style={{ background: 'rgba(243,139,168,0.08)', border: '1px solid rgba(243,139,168,0.2)' }}
        >
          <AlertTriangle size={12} className="text-ui-red flex-shrink-0 mt-0.5" />
          <span className="text-ui-muted leading-relaxed">
            {mode === 'create'
              ? 'Guarde sua chave em local seguro. Se perdê-la, suas notas não poderão ser recuperadas.'
              : 'Se inserir a chave errada, suas notas aparecerão ilegíveis. Nenhum dado é perdido.'}
          </span>
        </div>

        {/* Confirm button */}
        <button
          onClick={submit}
          disabled={!key.trim()}
          className="w-full py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2"
          style={{
            background: key.trim() ? 'rgba(203,166,247,0.2)' : 'rgba(49,49,68,0.4)',
            border: `1px solid ${key.trim() ? '#cba6f7' : '#313244'}`,
            color: key.trim() ? '#cba6f7' : '#6c7086',
            cursor: key.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          <ShieldCheck size={14} />
          {mode === 'create' ? 'Criar chave e entrar' : 'Desbloquear notas'}
        </button>
      </div>
    </div>
  )
}
