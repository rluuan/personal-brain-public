export const COOKIE_NAME = 'personal-brain-user'
export const COOKIE_DAYS = 365
export const ACTIVE_NOTE_KEY = 'personal-brain-active-note'
export const OPEN_TABS_KEY   = 'personal-brain-open-tabs'

export function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

export function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

export function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

export const NOVIDADES_CONTENT = `# 🚀 Últimas Novidades

Bem-vindo à versão mais recente do **Personal Brain**! Aqui estão as funcionalidades adicionadas recentemente:

---

## 🔗 Live Memory — Captura automática de links

Todo site que você visita no Chrome pode ser salvo automaticamente no Personal Brain via extensão.

- **Extensão Chrome** (Manifest V3) na pasta \`chrome-extension/\` do projeto
- Carregue em \`chrome://extensions/\` → Modo desenvolvedor → Carregar sem compactação
- Configure a URL do servidor (\`http://localhost:3001\`) e seu nickname no popup da extensão
- Fila offline: links capturados sem conexão são enviados ao reconectar
- Sem duplicatas: mesma URL nunca é salva duas vezes

### Como acessar

- Clique no ícone 🔗 na barra lateral para ver o **histórico completo** de links
- Busca, paginação, exportar JSON, criar nota a partir de um link — tudo na mesma tela

### Grafo interativo

Nós de Live Memory aparecem em **azul** no grafo. Clique com botão direito para abrir o link ou criar uma nota a partir dele.

### Chat com contexto de links

No ChatPanel, ative o toggle **Links** para que a IA use seus links visitados como contexto da conversa.

### Ativar / Desativar

Vá em **Configurações → Geral → Live Memory** para pausar a captura sem precisar remover a extensão.

---

## ⌨️ Modo Vim

O Vim tem sua própria aba nas **Configurações → Vim**.
- Configuração de **vimrc integrado** para seus defaults.
- Atalhos rápidos: \`:w\` salvar · \`:q\` fechar · \`:h\` ajuda.

## 🗓️ Nota Diária

Clique no ícone de calendário na barra lateral para criar/abrir a nota do dia.
Estrutura de pastas: \`ano > mês > dia\`

## 🔒 Criptografia E2E

Notas criptografadas no navegador com **AES-256**. Sua chave nunca sai do dispositivo.

---

> 💡 Para não ver esta nota na próxima vez, ative **"Ignorar Últimas Novidades"** nas Configurações.
`
