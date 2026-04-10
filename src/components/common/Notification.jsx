import React, { useEffect, useState } from 'react'
import { X, CheckCircle, AlertTriangle, Info, FolderOpen } from 'lucide-react'

export function Notification({ 
  message, 
  type = 'success', 
  onClose, 
  onAction, 
  actionLabel = 'Abrir',
  duration = 5000 
}) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (duration > 0) {
      const t = setTimeout(() => {
        setVisible(false)
        setTimeout(onClose, 300)
      }, duration)
      return () => clearTimeout(t)
    }
  }, [duration, onClose])

  const icons = {
    success: <CheckCircle className="text-green-400" size={18} />,
    error: <AlertTriangle className="text-red-400" size={18} />,
    info: <Info className="text-blue-400" size={18} />,
  }

  return (
    <div 
      className={`fixed bottom-6 right-6 z-[9999] transition-all duration-300 transform ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div 
        className="flex items-center gap-4 px-4 py-3 rounded-xl shadow-2xl border border-[#313244]"
        style={{ 
          background: 'rgba(30, 30, 46, 0.95)', 
          backdropFilter: 'blur(10px)',
          minWidth: '320px',
          maxWidth: '450px'
        }}
      >
        <div className="flex-shrink-0">
          {icons[type] || icons.info}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ui-text font-medium leading-tight truncate-multiline">
            {message}
          </p>
        </div>

        {onAction && (
          <button
            onClick={() => { onAction?.(); setVisible(false); setTimeout(onClose, 300) }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 bg-ui-accent text-[#1e1e2e]"
          >
            <FolderOpen size={13} />
            {actionLabel}
          </button>
        )}

        <button 
          onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
          className="p-1 rounded-lg hover:bg-ui-hover text-ui-muted hover:text-ui-text transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

// Add CSS for multiline truncation if needed, but for now simple flex works.
