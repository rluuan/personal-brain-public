import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { sql } from '@codemirror/lang-sql'
import { rust } from '@codemirror/lang-rust'
import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { php } from '@codemirror/lang-php'
import { go } from '@codemirror/lang-go'
import { yaml } from '@codemirror/lang-yaml'
import { xml } from '@codemirror/lang-xml'

const EXT_MAP = {
  'js':   { lang: javascript, alias: 'javascript' },
  'jsx':  { lang: () => javascript({ jsx: true }), alias: 'javascript' },
  'ts':   { lang: () => javascript({ typescript: true }), alias: 'typescript' },
  'tsx':  { lang: () => javascript({ typescript: true, jsx: true }), alias: 'typescript' },
  'py':   { lang: python, alias: 'python' },
  'html': { lang: html, alias: 'html' },
  'css':  { lang: css, alias: 'css' },
  'json': { lang: json, alias: 'json' },
  'sql':  { lang: sql, alias: 'sql' },
  'rs':   { lang: rust, alias: 'rust' },
  'rust': { lang: rust, alias: 'rust' },
  'cpp':  { lang: cpp, alias: 'cpp' },
  'c':    { lang: cpp, alias: 'cpp' },
  'h':    { lang: cpp, alias: 'cpp' },
  'java': { lang: java, alias: 'java' },
  'php':  { lang: php, alias: 'php' },
  'go':   { lang: go, alias: 'go' },
  'yaml': { lang: yaml, alias: 'yaml' },
  'yml':  { lang: yaml, alias: 'yaml' },
  'xml':  { lang: xml, alias: 'xml' },
  'md':   { lang: markdown, alias: 'markdown' },
}

export function getLanguageMetadata(filename = '') {
  const ext = filename.split('.').pop()?.toLowerCase() || 'md'
  const found = EXT_MAP[ext] || { lang: markdown, alias: 'markdown' }
  
  // Some lang functions take options, others don't.
  // We normalize them here.
  const extension = typeof found.lang === 'function' ? found.lang() : found.lang
  
  return {
    extension,
    alias: found.alias,
    isMarkdown: ext === 'md' || !EXT_MAP[ext]
  }
}
