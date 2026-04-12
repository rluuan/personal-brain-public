import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

function parseDiagramBlocks(value) {
  const lines = value.split('\n')
  const blocks = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].trim() === '```diagram') {
      const startLine = i
      let jsonStr = ''
      let j = i + 1
      while (j < lines.length && lines[j].trim() !== '```') {
        jsonStr += lines[j] + '\n'
        j++
      }
      try {
        const id = JSON.parse(jsonStr)._id
        if (id) blocks.push({ id, startLine, collapsed: false })
      } catch {}
      i = j + 1
    } else if (lines[i].startsWith('```diagram:collapsed:')) {
      const id = lines[i].replace('```diagram:collapsed:', '').trim()
      blocks.push({ id, startLine: i, collapsed: true })
      i += 2
    } else {
      i++
    }
  }
  return blocks
}

export default function DiagramFoldButtons({ textareaRef, content, foldedDiagrams, onToggle }) {
  const [items, setItems] = useState([])
  const frameRef = useRef(null)

  useEffect(() => {
    const compute = () => {
      const textarea = textareaRef.current
      if (!textarea) return
      const style = window.getComputedStyle(textarea)
      const lineHeight = parseFloat(style.lineHeight) || 23.8
      const paddingTop = parseFloat(style.paddingTop) || 32
      const blocks = parseDiagramBlocks(textarea.value || '')
      setItems(blocks.map(b => ({
        ...b,
        top: paddingTop + b.startLine * lineHeight - textarea.scrollTop,
      })))
    }

    // rAF ensures layout is stable before reading measurements
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(compute)

    const textarea = textareaRef.current
    if (textarea) textarea.addEventListener('scroll', compute)
    return () => {
      cancelAnimationFrame(frameRef.current)
      if (textarea) textarea.removeEventListener('scroll', compute)
    }
  }, [content, foldedDiagrams, textareaRef])

  if (items.length === 0) return null

  return (
    <>
      {items.map(({ id, top, collapsed }) => (
        <button
          key={id}
          onMouseDown={(e) => { e.preventDefault(); onToggle(id) }}
          title={collapsed ? 'Expandir diagrama' : 'Colapsar diagrama'}
          style={{
            position: 'absolute',
            top: Math.max(4, top),
            right: 10,
            zIndex: 20,
            display: top > -24 && top < 9999 ? 'flex' : 'none',
            alignItems: 'center',
            gap: 3,
            padding: '2px 7px',
            borderRadius: 4,
            border: '1px solid #45475a',
            background: '#1e1e2e',
            color: '#a6adc8',
            cursor: 'pointer',
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 1.4,
            userSelect: 'none',
          }}
        >
          {collapsed
            ? <ChevronRight size={11} color="#cba6f7" />
            : <ChevronDown size={11} color="#cba6f7" />}
          diagrama
        </button>
      ))}
    </>
  )
}
