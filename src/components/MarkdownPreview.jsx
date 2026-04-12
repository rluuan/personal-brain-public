import React, { useMemo, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeHighlight from 'rehype-highlight'
import { useNotesStore } from '../store/useNotesStore'
import InlineGraph from './InlineGraph'
import ExcalidrawView from './ExcalidrawView'
import { getLanguageMetadata } from '../utils/languageUtils'

// Highlight.js theme import (Tokyo Night Dark)
import 'highlight.js/styles/tokyo-night-dark.css'

// Extracts raw text from a hast node tree (handles rehype-highlight span wrapping)
function extractHastText(node) {
  if (!node) return ''
  if (node.type === 'text') return node.value || ''
  if (Array.isArray(node.children)) return node.children.map(extractHastText).join('')
  return ''
}

// Process wiki links [[Title]] and #tags in content before rendering
function processContent(content, notes) {
  return content
    .replace(/\[\[([^\]]+)\]\]/g, (_, title) => {
      const exists = notes.find((n) => n.title.toLowerCase() === title.toLowerCase())
      return `[${title}](wikilink:${encodeURIComponent(title)}${exists ? '' : '?broken'})`
    })
    .replace(/#(\w+)/g, (_, tag) => `[\`#${tag}\`](tag:${tag})`)
    // Force hard line breaks: add two trailing spaces before newlines that follow a markdown link
    .replace(/(\]\([^)]+\)) *\n/g, '$1  \n')
}

export default function MarkdownPreview({ content, filename = '', onDiagramUpdate }) {
  const { notes, setActiveNote, getNoteByTitle, createNote } = useNotesStore()
  const onDiagramUpdateRef = useRef(onDiagramUpdate)
  useEffect(() => { onDiagramUpdateRef.current = onDiagramUpdate }, [onDiagramUpdate])

  const { isMarkdown, alias } = getLanguageMetadata(filename)

  const processed = useMemo(() => {
    const raw = processContent(content, notes)
    if (isMarkdown) return raw
    return `\`\`\`${alias}\n${content}\n\`\`\``
  }, [content, notes, isMarkdown, alias])

  // Stable components — never recreated, so Excalidraw never remounts while typing
  const components = useMemo(() => ({
    a: ({ href, children }) => {
      if (href?.startsWith('wikilink:')) {
        const broken = href.includes('?broken')
        const handleClick = () => {
          const title = decodeURIComponent(href.replace('wikilink:', '').replace('?broken', ''))
          const note = getNoteByTitle(title)
          if (note) setActiveNote(note.id)
          else createNote(title)
        }
        return (
          <span className={`wiki-link${broken ? ' broken' : ''}`} onClick={handleClick}>
            {children}
          </span>
        )
      }
      if (href?.startsWith('tag:')) return <span className="tag-pill">{children}</span>
      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    },
    code: ({ className, children, node }) => {
      const match = /language-(\w+)/.exec(className || '')
      const lang = match ? match[1] : null
      // For diagram blocks, extract raw text from AST to bypass any rehype-highlight processing
      const codeValue = lang === 'diagram'
        ? extractHastText(node).replace(/\n$/, '')
        : String(children).replace(/\n$/, '')

      if (lang === 'diagram') {
        try {
          const data = JSON.parse(codeValue)
          return (
            <ExcalidrawView
              data={data}
              onSave={(newData) => {
                if (onDiagramUpdateRef.current) {
                  // Pass _id instead of codeValue — content may have changed since mount
                  onDiagramUpdateRef.current(data._id, JSON.stringify(newData, null, 2))
                }
              }}
            />
          )
        } catch (e) {
          return (
            <pre className="bg-red-900/10 p-2 text-xs text-red-400 border border-red-900/30 rounded">
              Diagram Error: {e.message}
            </pre>
          )
        }
      }
      return <code className={className}>{children}</code>
    },
  }), []) // empty deps — stable forever; uses refs for callbacks

  return (
    <div className="markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
        components={components}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}
