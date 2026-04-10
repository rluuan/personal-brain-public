import React, { useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'

export function SpeechBrain({ onTranscript, onClose }) {
  const canvasRef = useRef(null)
  const [isListening, setIsListening] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const recognitionRef = useRef(null)
  const requestRef = useRef(null)
  
  // Particle system for the "Neural Brain"
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    let w = canvas.width = window.innerWidth
    let h = canvas.height = window.innerHeight
    
    const particles = []
    const particleCount = 130
    
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2
        const rad = Math.random() * 100
      particles.push({
        x: w / 2 + Math.cos(angle) * rad,
        y: h / 2 + Math.sin(angle) * rad,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2 + 0.5,
        phase: Math.random() * Math.PI * 2
      })
    }
    
    const animate = () => {
      ctx.clearRect(0, 0, w, h)
      
      const time = Date.now() * 0.0015
      const pulse = isListening ? Math.sin(time * 4) * 20 + 25 : Math.sin(time) * 5 + 10
      
      particles.forEach((p, i) => {
        p.x += p.vx + Math.sin(time + p.phase) * 0.2
        p.y += p.vy + Math.cos(time + p.phase) * 0.2
        const dx = w/2 - p.x
        const dy = h/2 - p.y
        const dist = Math.sqrt(dx*dx + dy*dy)
        const targetDist = 100 + Math.sin(time + i * 0.1) * pulse * 0.5
        const force = (dist - targetDist) * 0.002
        p.vx += dx * force * 0.01
        p.vy += dy * force * 0.01
        p.vx *= 0.99
        p.vy *= 0.99
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
      })
      
      ctx.lineWidth = 0.6
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const d2 = dx*dx + dy*dy
          const limit = 2500 + pulse * 20
          if (d2 < limit) {
            const alpha = (1 - d2 / limit) * (isListening ? 0.25 : 0.1)
            ctx.strokeStyle = `rgba(203, 166, 247, ${alpha})`
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }
      
      particles.forEach(p => {
        const glow = isListening ? 0.3 + Math.sin(time * 5 + p.phase) * 0.3 : 0.1
        ctx.fillStyle = isListening ? `rgba(166, 227, 161, ${0.5 + glow})` : 'rgba(203, 166, 247, 0.4)'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
        
        if (isListening && Math.random() > 0.995) {
            ctx.fillStyle = '#fff'
            ctx.beginPath()
            ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2)
            ctx.fill()
        }
      })
      
      requestRef.current = requestAnimationFrame(animate)
    }
    
    animate()
    const handleResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight }
    window.addEventListener('resize', handleResize)
    return () => { cancelAnimationFrame(requestRef.current); window.removeEventListener('resize', handleResize) }
  }, [isListening])

  // Speech Recognition Logic
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setErrorMessage("Seu navegador não suporta reconhecimento de fala.")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'pt-BR'

    const SILENCE_TIMEOUT = 3500 
    let silenceTimer = null

    const resetSilenceTimer = () => {
        if (silenceTimer) clearTimeout(silenceTimer)
        silenceTimer = setTimeout(() => {
            recognition.stop()
            onClose()
        }, SILENCE_TIMEOUT)
    }

    recognition.onstart = () => {
        setIsListening(true)
        setErrorMessage(null)
        resetSilenceTimer()
    }
    recognition.onend = () => {
        setIsListening(false)
        if (silenceTimer) clearTimeout(silenceTimer)
    }
    recognition.onerror = (event) => {
        console.error("Speech Error:", event.error)
        if (event.error === 'not-allowed') {
            setErrorMessage("Acesso negado ao microfone.")
            // We DON'T close immediately so the user can see the error
        } else {
            onClose()
        }
    }
    
    recognition.onresult = (event) => {
      resetSilenceTimer()
      let interimTranscript = ''
      let finalUpdate = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalUpdate += transcript
        } else {
          interimTranscript += transcript
        }
      }
      if (finalUpdate || interimTranscript) {
          onTranscript({ final: finalUpdate, interim: interimTranscript })
      }
    }

    // Wrap start in a timeout to ensure any previous instances are fully cleaned up
    const startTimeout = setTimeout(() => {
        try { recognition.start() } catch (e) { console.warn("Recognition already started or failed:", e) }
    }, 100)
    
    recognitionRef.current = recognition

    return () => {
      clearTimeout(startTimeout)
      if (recognitionRef.current) {
        recognitionRef.current.onend = null
        recognitionRef.current.onerror = null
        try { recognitionRef.current.stop() } catch(e){}
      }
      if (silenceTimer) clearTimeout(silenceTimer)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      <div className="fixed inset-0 pointer-events-auto cursor-pointer" onClick={onClose} />
      
      {/* Floating Canvas */}
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Error display */}
      {errorMessage && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center gap-3">
             <div className="flex items-center gap-2 px-6 py-3 bg-red-500/10 border border-red-500/20 rounded-full backdrop-blur-md text-red-400 text-sm font-medium animate-in fade-in zoom-in duration-300">
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
             </div>
             <p className="text-[10px] text-ui-muted uppercase tracking-widest font-bold opacity-50">Clique em qualquer lugar para fechar</p>
        </div>
      )}
    </div>
  )
}
