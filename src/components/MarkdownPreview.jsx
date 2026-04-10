import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeHighlight from 'rehype-highlight'
import { useNotesStore } from '../store/useNotesStore'
import InlineGraph from './InlineGraph'
import DiagramView from './DiagramView'
import { getLanguageMetadata } from '../utils/languageUtils'

// Highlight.js theme import (Tokyo Night Dark)
import 'highlight.js/styles/tokyo-night-dark.css'

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

export default function MarkdownPreview({ content, filename = '', activeTool = 'select', onDiagramUpdate }) {
  const { notes, setActiveNote, getNoteByTitle, createNote } = useNotesStore()
  
  const { isMarkdown, alias } = getLanguageMetadata(filename)
  
  const processed = React.useMemo(() => {
    const raw = processContent(content, notes)
    if (isMarkdown) return raw
    // For non-markdown files, wrap in code block with correct language alias
    return `\`\`\`${alias}\n${content}\n\`\`\``
  }, [content, notes, isMarkdown, alias])

  const handleClick = (href) => {
    if (!href) return
    if (href.startsWith('wikilink:')) {
      const title = decodeURIComponent(href.replace('wikilink:', '').replace('?broken', ''))
      const note = getNoteByTitle(title)
      if (note) setActiveNote(note.id)
      else createNote(title)
    }
  }

  return (
    <div className="markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith('wikilink:')) {
              const broken = href.includes('?broken')
              return (
                <span className={`wiki-link${broken ? ' broken' : ''}`} onClick={() => handleClick(href)}>
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
            const codeValue = String(children).replace(/\n$/, '')

            if (lang === 'diagram') {
              try {
                const data = JSON.parse(codeValue)
                return (
                  <div className="my-4">
                    <DiagramView
                      data={data}
                      activeTool={activeTool}
                      isEditable={true}
                      onSave={(newData) => {
                        if (onDiagramUpdate) onDiagramUpdate(codeValue, JSON.stringify(newData, null, 2))
                      }}
                    />
                  </div>
                )
              } catch (e) {
                return (
                  <pre className="bg-red-900/10 p-2 text-xs text-red-400 border border-red-900/30 rounded">
                    Diagram Error: {e.message}
                  </pre>
                )
              }
            }
            // If class exists, rehype-highlight already did its job and we just return the code tag
            // highlight.js adds classes to the code tag which are styled by the css import
            return <code className={className}>{children}</code>
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}
