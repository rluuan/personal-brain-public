import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

export default function ExcalidrawView({ data, onSave }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null)
  const saveTimerRef = useRef(null)
  const onSaveRef = useRef(onSave)
  const dataRef = useRef(data)
  const dataIdRef = useRef(data._id)

  // Keep refs in sync without triggering re-renders
  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  useEffect(() => { dataRef.current = data }, [data])

  // When note changes (_id changes), reset Excalidraw scene
  useEffect(() => {
    if (!excalidrawAPI || data._id === dataIdRef.current) return
    dataIdRef.current = data._id
    excalidrawAPI.updateScene({
      elements: data.elements || [],
      appState: { theme: 'dark', ...(data.appState || {}) },
    })
  }, [data._id, excalidrawAPI])

  // Stable onChange — never recreated, uses refs
  const handleChange = useCallback((elements, appState) => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (onSaveRef.current) {
        onSaveRef.current({ ...dataRef.current, elements, appState: { theme: appState.theme || 'dark' } })
      }
    }, 800)
  }, [])

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-[#313244] shadow-2xl" style={{ height: 550 }}>
      <Excalidraw
        excalidrawAPI={setExcalidrawAPI}
        initialData={{
          elements: data.elements || [],
          appState: { theme: 'dark', ...(data.appState || {}) },
        }}
        onChange={handleChange}
        theme="dark"
        UIOptions={{ canvasActions: { export: false, loadScene: false } }}
      />
    </div>
  )
}
