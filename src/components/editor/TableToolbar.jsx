import React from 'react'
import {
  AlignLeft, AlignCenter, AlignRight,
  ArrowUpToLine, ArrowDownToLine, MoveUp, MoveDown, Trash2,
  ArrowLeftToLine, ArrowRightToLine, Columns3,
} from 'lucide-react'

function Btn({ icon: Icon, title, onClick, disabled, active }) {
  return (
    <button
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); if (!disabled) onClick() }}
      className={`flex items-center justify-center w-7 h-7 rounded transition-colors ${
        disabled ? 'opacity-30 cursor-default' : active ? 'bg-ui-accent/20 text-ui-accent' : 'hover:bg-ui-hover text-ui-text'
      }`}
    >
      <Icon size={14} />
    </button>
  )
}

function Sep() {
  return <div className="w-px h-5 bg-ui-hover/50 mx-1" />
}

export function TableToolbar({ context, onAction }) {
  if (!context) return null
  const { x, bottom, align, dataRowIndex, rowCount } = context

  return (
    <div
      className="fixed z-40 flex items-center gap-0.5 px-1.5 py-1 rounded-lg shadow-2xl fade-in"
      style={{
        left: Math.max(8, Math.min(x, window.innerWidth - 340)),
        bottom: Math.max(8, window.innerHeight - bottom),
        background: 'rgba(var(--color-panel-rgb),0.98)',
        border: '1px solid var(--color-border-strong)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Btn icon={AlignLeft} title="Alinhar à esquerda" onClick={() => onAction('align', 'left')} active={align === 'left'} />
      <Btn icon={AlignCenter} title="Centralizar" onClick={() => onAction('align', 'center')} active={align === 'center'} />
      <Btn icon={AlignRight} title="Alinhar à direita" onClick={() => onAction('align', 'right')} active={align === 'right'} />
      <Sep />
      <Btn icon={ArrowUpToLine} title="Inserir linha acima" onClick={() => onAction('insertRow', 'above')} disabled={dataRowIndex == null} />
      <Btn icon={ArrowDownToLine} title="Inserir linha abaixo" onClick={() => onAction('insertRow', 'below')} />
      <Btn icon={MoveUp} title="Mover linha pra cima" onClick={() => onAction('moveRow', 'up')} disabled={dataRowIndex == null || dataRowIndex === 0} />
      <Btn icon={MoveDown} title="Mover linha pra baixo" onClick={() => onAction('moveRow', 'down')} disabled={dataRowIndex == null || dataRowIndex === rowCount - 1} />
      <Btn icon={Trash2} title="Excluir linha" onClick={() => onAction('deleteRow')} disabled={dataRowIndex == null} />
      <Sep />
      <Btn icon={ArrowLeftToLine} title="Inserir coluna à esquerda" onClick={() => onAction('insertColumn', 'left')} />
      <Btn icon={ArrowRightToLine} title="Inserir coluna à direita" onClick={() => onAction('insertColumn', 'right')} />
      <Btn icon={Columns3} title="Excluir coluna" onClick={() => onAction('deleteColumn')} />
    </div>
  )
}
