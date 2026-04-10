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

## ⌨️ Modo Vim

O Vim agora tem sua própria aba nas **Configurações → Vim**.
- Adicionada seção educativa sobre os benefícios do uso modal.
- Configuração de **vimrc integrado** para seus defaults.
- Atalhos rápidos: \`:w\` salvar · \`:q\` fechar · \`:h\` ajuda.

## 🗓️ Nota Diária

Clique no ícone de calendário na barra lateral para criar/abrir a nota do dia automaticamente.
Estrutura de pastas: \`ano > mês > dia\`

## 📊 Métricas em Tempo Real

Contador de palavras e caracteres visível no rodapé do editor.

## 🗂️ Sistema de Abas

Notas abertas ficam em abas persistentes entre sessões.

## 🔒 Criptografia E2E

Notas criptografadas no navegador com **AES-256**. Sua chave nunca sai do dispositivo.

---

> 💡 Para não ver esta nota na próxima vez, ative **"Ignorar Últimas Novidades"** nas Configurações.
`
