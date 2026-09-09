import React, { useState, useEffect, useRef } from 'react'
import { Palette } from 'lucide-react'
import { FOLDER_COLORS, FOLDER_ICONS, FOLDER_ICON_NAMES } from '../../utils/sidebarOptions'

export function FolderColorIconPicker({ folder, onChange }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!containerRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const CurrentIcon = FOLDER_ICONS[folder.icon] || null

  return (
    <div ref={containerRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Cor e ícone da pasta"
        className="p-0.5 rounded hover:text-ui-accent transition-colors text-ui-muted"
      >
        {CurrentIcon ? <CurrentIcon size={10} style={{ color: folder.color || undefined }} /> : <Palette size={10} />}
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg p-2 shadow-xl"
          style={{ background: 'rgba(25,25,40,0.98)', border: '1px solid #45475a', minWidth: 170 }}
        >
          <div className="text-[9px] text-ui-muted uppercase tracking-wider mb-1 px-0.5">Cor</div>
          <div className="grid grid-cols-8 gap-1 mb-2">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ color: folder.color === c ? null : c })}
                className="w-4 h-4 rounded-full hover:scale-110 transition-transform"
                style={{ background: c, border: folder.color === c ? '2px solid white' : '1px solid rgba(255,255,255,0.15)' }}
                title={c}
              />
            ))}
          </div>
          <div className="text-[9px] text-ui-muted uppercase tracking-wider mb-1 px-0.5">Ícone</div>
          <div className="grid grid-cols-8 gap-1">
            {FOLDER_ICON_NAMES.map((name) => {
              const Icon = FOLDER_ICONS[name]
              const active = folder.icon === name
              return (
                <button
                  key={name}
                  onClick={() => onChange({ icon: active ? null : name })}
                  className="w-4 h-4 flex items-center justify-center rounded hover:bg-ui-hover transition-colors"
                  style={{ color: active ? (folder.color || 'var(--color-primary)') : '#a6adc8', background: active ? 'rgba(255,255,255,0.08)' : 'transparent' }}
                  title={name}
                >
                  <Icon size={11} />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
