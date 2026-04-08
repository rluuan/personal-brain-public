import React, { useState, useEffect, useRef } from 'react'
import { useNotesStore } from '../store/useNotesStore'

export default function NicknameModal({ onConfirm }) {
  const { settings } = useNotesStore()
  const projectName = settings.extra?.projectName || 'Personal Brain'
  const [name, setName] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 fade-in text-center"
        style={{ background: 'rgba(25,25,40,0.97)', border: '1px solid #313244', boxShadow: '0 0 60px rgba(203,166,247,0.15)' }}
      >
        <div className="text-5xl mb-4">⬡</div>
        <h1 className="text-ui-text text-xl font-semibold mb-1">Bem-vindo ao {projectName}</h1>
        <p className="text-ui-muted text-sm mb-6">
          Escolha um nickname para identificar suas notas.<br />
          Você pode compartilhar o {projectName} com outros usuários.
        </p>

        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Seu nickname..."
          maxLength={32}
          className="w-full px-4 py-3 rounded-lg text-ui-text text-sm outline-none mb-4"
          style={{
            background: 'rgba(49,49,68,0.8)',
            border: '1px solid #45475a',
            caretColor: '#cba6f7',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#cba6f7')}
          onBlur={(e) => (e.target.style.borderColor = '#45475a')}
        />

        <button
          onClick={submit}
          disabled={!name.trim()}
          className="w-full py-3 rounded-lg font-semibold text-sm transition-all"
          style={{
            background: name.trim() ? 'rgba(203,166,247,0.2)' : 'rgba(49,49,68,0.4)',
            border: `1px solid ${name.trim() ? '#cba6f7' : '#313244'}`,
            color: name.trim() ? '#cba6f7' : '#6c7086',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Entrar no {projectName} →
        </button>

        <p className="text-ui-muted text-xs mt-4">
          Seus dados ficam salvos localmente no navegador.
        </p>
      </div>
    </div>
  )
}
