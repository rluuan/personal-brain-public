import React, { useEffect, useState, useRef, useCallback } from 'react'

const DISPLAY_DURATION = 1500
const MAX_KEYS = 8

const SPECIAL_LABELS = {
  ' ': '␣',
  Enter: '↵',
  Backspace: '⌫',
  Delete: '⌦',
  Tab: '⇥',
  Escape: 'Esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Control: 'Ctrl',
  Meta: '⌘',
  Alt: 'Alt',
  Shift: '⇧',
  CapsLock: 'Caps',
}

function formatKey(e) {
  const parts = []
  if (e.ctrlKey && e.key !== 'Control') parts.push('Ctrl')
  if (e.altKey && e.key !== 'Alt') parts.push('Alt')
  if (e.shiftKey && e.key !== 'Shift' && e.key.length > 1) parts.push('⇧')
  if (e.metaKey && e.key !== 'Meta') parts.push('⌘')

  const label = SPECIAL_LABELS[e.key] || (e.key.length === 1 ? e.key : e.key)
  parts.push(label)
  return parts.join(' + ')
}

let idCounter = 0

export default function ScreenkeyOverlay() {
  const [keys, setKeys] = useState([])
  const timersRef = useRef({})

  const removeKey = useCallback((id) => {
    setKeys(prev => prev.filter(k => k.id !== id))
    delete timersRef.current[id]
  }, [])

  useEffect(() => {
    const handler = (e) => {
      // Ignore lone modifier keys
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return

      const id = ++idCounter
      const label = formatKey(e)

      setKeys(prev => {
        const next = [...prev, { id, label, timestamp: Date.now() }]
        return next.slice(-MAX_KEYS)
      })

      timersRef.current[id] = setTimeout(() => removeKey(id), DISPLAY_DURATION)
    }

    window.addEventListener('keydown', handler, true)
    return () => {
      window.removeEventListener('keydown', handler, true)
      Object.values(timersRef.current).forEach(clearTimeout)
    }
  }, [removeKey])

  if (keys.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 60,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        display: 'flex',
        gap: 6,
        pointerEvents: 'none',
        alignItems: 'center',
      }}
    >
      {keys.map((k) => {
        const age = Date.now() - k.timestamp
        const opacity = Math.max(0, 1 - age / DISPLAY_DURATION)
        return (
          <span
            key={k.id}
            style={{
              display: 'inline-block',
              background: 'rgba(30, 30, 46, 0.92)',
              border: '1px solid rgba(69, 71, 90, 0.6)',
              color: '#cdd6f4',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 14,
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: 8,
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              opacity,
              transition: 'opacity 0.3s ease-out',
              animation: 'screenkey-pop 0.15s ease-out',
              whiteSpace: 'nowrap',
            }}
          >
            {k.label}
          </span>
        )
      })}
    </div>
  )
}
