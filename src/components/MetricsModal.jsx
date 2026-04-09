import React, { useMemo } from 'react'
import { X, FileText, FolderOpen, Hash, Type, TrendingUp, Award, Calendar, Clock } from 'lucide-react'
import { useNotesStore } from '../store/useNotesStore'

// ── SVG Pie Chart ─────────────────────────────────────────────────────────────
function PieChart({ slices, size = 160, label }) {
  if (!slices || slices.length === 0) return null
  const cx = size / 2, cy = size / 2, r = size / 2 - 10
  let cumAngle = -Math.PI / 2
  const total  = slices.reduce((s, sl) => s + sl.value, 0)
  if (total === 0) return null

  const paths = slices.map((sl, i) => {
    const angle = (sl.value / total) * 2 * Math.PI
    const x1 = cx + r * Math.cos(cumAngle)
    const y1 = cy + r * Math.sin(cumAngle)
    cumAngle += angle
    const x2 = cx + r * Math.cos(cumAngle)
    const y2 = cy + r * Math.sin(cumAngle)
    const large = angle > Math.PI ? 1 : 0
    return (
      <path
        key={i}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
        fill={sl.color}
        opacity={0.88}
        stroke="#1e1e2e"
        strokeWidth={1.5}
      >
        <title>{sl.label}: {sl.value} ({Math.round((sl.value / total) * 100)}%)</title>
      </path>
    )
  })

  return (
    <div className="flex flex-col items-center gap-3">
      {label && <div className="text-xs text-ui-muted uppercase tracking-wider">{label}</div>}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths}
        {/* Center hole */}
        <circle cx={cx} cy={cy} r={r * 0.42} fill="#1e1e2e" />
      </svg>
      {/* Legend */}
      <div className="flex flex-col gap-1 w-full">
        {slices.map((sl, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sl.color }} />
              <span className="text-ui-muted truncate max-w-[110px]">{sl.label}</span>
            </div>
            <span className="text-ui-text font-medium flex-shrink-0">
              {sl.value} <span className="text-ui-muted">({Math.round((sl.value / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────
function BarChart({ bars, label, color = 'var(--color-primary)', height = 110 }) {
  if (!bars || bars.length === 0) return null
  const max = Math.max(...bars.map(b => b.value), 1)
  const barW = Math.min(28, Math.floor(240 / bars.length) - 4)
  const chartW = bars.length * (barW + 4)

  return (
    <div className="flex flex-col gap-2">
      {label && <div className="text-xs text-ui-muted uppercase tracking-wider">{label}</div>}
      <svg width="100%" viewBox={`0 0 ${chartW} ${height + 20}`} preserveAspectRatio="xMidYMid meet">
        {bars.map((b, i) => {
          const barH = Math.max(2, (b.value / max) * height)
          const x = i * (barW + 4)
          const y = height - barH
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} opacity={0.8} />
              {b.value > 0 && (
                <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fill="#cdd6f4">{b.value}</text>
              )}
              <text x={x + barW / 2} y={height + 14} textAnchor="middle" fontSize={8} fill="#6c7086">{b.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'var(--color-primary)' }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: '#252535', border: '1px solid #313244' }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg" style={{ background: `${color}20` }}>
          <Icon size={13} style={{ color }} />
        </div>
        <span className="text-[10px] text-ui-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-ui-muted">{sub}</div>}
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function MetricsModal({ onClose }) {
  const { notes, folders, getAllTags, settings } = useNotesStore()
  const primary   = settings.primaryColor   || '#cba6f7'
  const secondary = settings.secondaryColor || '#89b4fa'

  const metrics = useMemo(() => {
    const totalWords = notes.reduce((sum, n) => {
      const text = (n.content || '').replace(/[#*`\[\]()>~_]/g, '')
      return sum + text.trim().split(/\s+/).filter(Boolean).length
    }, 0)

    const avgWords = notes.length ? Math.round(totalWords / notes.length) : 0

    const longestNote = notes.reduce((best, n) => {
      const wc = (n.content || '').trim().split(/\s+/).filter(Boolean).length
      return wc > (best?.wc || 0) ? { note: n, wc } : best
    }, null)

    const allTags  = getAllTags()
    const withTags = notes.filter(n => /#\w+/.test(n.content || '')).length

    // Notas por pasta
    const byFolder = folders.map(f => ({
      label: f.name,
      value: notes.filter(n => n.folder_id === f.id).length,
    })).filter(s => s.value > 0)
    const noFolder = notes.filter(n => !n.folder_id).length
    if (noFolder > 0) byFolder.push({ label: 'Sem pasta', value: noFolder })

    // Notas por mês (últimos 6 meses)
    const monthlyBars = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleString('pt-BR', { month: 'short' })
      const value = notes.filter(n => {
        const nd = new Date(n.created_at)
        return nd.getFullYear() === d.getFullYear() && nd.getMonth() === d.getMonth()
      }).length
      monthlyBars.push({ label, value })
    }

    // Notas por dia da semana
    const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const weekBars = DIAS.map((label, di) => ({
      label,
      value: notes.filter(n => new Date(n.updated_at).getDay() === di).length,
    }))

    // Notas criadas este mês
    const thisMonth = notes.filter(n => {
      const d = new Date(n.created_at)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length

    // Streak de dias com atividade
    const activitySet = new Set(notes.map(n => new Date(n.updated_at).toISOString().slice(0, 10)))
    let streak = 0
    for (let i = 0; i < 365; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      if (activitySet.has(d.toISOString().slice(0, 10))) streak++
      else if (i > 0) break
    }

    // Notas com/sem wikilinks
    const withLinks = notes.filter(n => /\[\[.+\]\]/.test(n.content || '')).length

    // Pie: tags vs sem tags
    const tagsPie = [
      { label: 'Com tags',  value: withTags,              color: primary },
      { label: 'Sem tags',  value: notes.length - withTags, color: '#313244' },
    ].filter(s => s.value > 0)

    // Pie: notas por pasta (max 6 fatias)
    const PALETTE = [primary, secondary, '#a6e3a1', '#f9e2af', '#fab387', '#f38ba8', '#89dceb']
    const folderPie = byFolder.slice(0, 6).map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }))

    return {
      totalWords, avgWords, longestNote, allTags, withTags, withLinks,
      byFolder, monthlyBars, weekBars, thisMonth, streak,
      tagsPie, folderPie,
    }
  }, [notes, folders, primary, secondary])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-2xl shadow-2xl w-full fade-in flex flex-col"
        style={{ background: '#1e1e2e', border: '1px solid #313244', maxWidth: 820, maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #313244' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: `${primary}20` }}>
              <TrendingUp size={16} style={{ color: primary }} />
            </div>
            <div>
              <div className="text-ui-text font-semibold text-sm">Métricas</div>
              <div className="text-[10px] text-ui-muted">Visão geral da sua atividade</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ui-hover text-ui-muted hover:text-ui-text transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={FileText}   label="Notas"         value={notes.length}           sub={`${metrics.thisMonth} este mês`}    color={primary} />
            <StatCard icon={FolderOpen} label="Pastas"        value={folders.length}         sub="pastas criadas"                     color={secondary} />
            <StatCard icon={Type}       label="Palavras"      value={metrics.totalWords.toLocaleString('pt-BR')} sub={`~${metrics.avgWords} por nota`} color="#a6e3a1" />
            <StatCard icon={Hash}       label="Tags únicas"   value={metrics.allTags.length} sub={`${metrics.withTags} notas com tag`} color="#f9e2af" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={Award}    label="Nota mais longa"  value={metrics.longestNote?.wc || 0}  sub={metrics.longestNote?.note.title?.slice(0, 20) || '—'} color="#fab387" />
            <StatCard icon={Calendar} label="Notas este mês"   value={metrics.thisMonth}             sub="criadas agora"          color="#f38ba8" />
            <StatCard icon={TrendingUp} label="Com wikilinks"  value={metrics.withLinks}             sub={`de ${notes.length} notas`} color="#89dceb" />
            <StatCard icon={Clock}    label="Streak"           value={`${metrics.streak}d`}          sub="dias consecutivos"      color="#cba6f7" />
          </div>

          {/* ── Charts row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Pizza: notas por pasta */}
            <div className="rounded-xl p-4" style={{ background: '#252535', border: '1px solid #313244' }}>
              <PieChart slices={metrics.folderPie} size={150} label="Notas por pasta" />
            </div>

            {/* Pizza: com/sem tags */}
            <div className="rounded-xl p-4" style={{ background: '#252535', border: '1px solid #313244' }}>
              <PieChart slices={metrics.tagsPie} size={150} label="Notas com tags" />
            </div>

            {/* Atividade da semana */}
            <div className="rounded-xl p-4" style={{ background: '#252535', border: '1px solid #313244' }}>
              <BarChart
                bars={metrics.weekBars}
                label={`Atividade da semana — total: ${metrics.weekBars.reduce((s, b) => s + b.value, 0)}`}
                color={secondary}
                height={100}
              />
            </div>
          </div>

          {/* ── Notas por mês ── */}
          <div className="rounded-xl p-4" style={{ background: '#252535', border: '1px solid #313244' }}>
            <BarChart
              bars={metrics.monthlyBars}
              label={`Notas criadas por mês — últimos 6 meses — total: ${metrics.monthlyBars.reduce((s, b) => s + b.value, 0)}`}
              color={primary}
              height={110}
            />
          </div>

        </div>
      </div>
    </div>
  )
}
