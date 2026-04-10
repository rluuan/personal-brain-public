import React, { useEffect } from 'react'

const BALLOON_EMOJIS = ['🎈', '🎉', '🎊', '🎈', '✨', '🌟']

export function BalloonOverlay({ onDone }) {
  const items = Array.from({ length: 18 }, (_, i) => ({
    emoji: BALLOON_EMOJIS[i % BALLOON_EMOJIS.length],
    left: Math.random() * 95,
    size: 1.4 + Math.random() * 1.6,
    duration: 2.8 + Math.random() * 2.2,
    delay: Math.random() * 1.2,
  }))

  useEffect(() => {
    const t = setTimeout(onDone, 4500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {items.map((b, i) => (
        <span key={i} className="balloon" style={{
          left: `${b.left}%`, bottom: '-8%',
          fontSize: `${b.size}rem`,
          animationDuration: `${b.duration}s`,
          animationDelay: `${b.delay}s`,
        }}>{b.emoji}</span>
      ))}
    </div>
  )
}
