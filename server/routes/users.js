import { Router } from 'express'
import { isSqlite, getSqlite, getPgPool } from '../db/connection.js'

const router = Router()

function getDefaultNotes(id, nickname, now) {
  return [
    {
      id: `${id}-news`, title: '🚀 Últimas Novidades', folder_id: null,
      content: `# 🚀 Últimas Novidades\n\nBem-vindo à versão mais recente do **Personal Brain**! Aqui estão as funcionalidades principais:\n\n---\n\n## ⌨️ Modo Vim\n\nAtive na aba **Vim** das configurações.\n- Use comandos como \`:w\` para salvar e \`:q\` para sair.\n- Suporte a \`vimrc\` para configurações personalizadas.\n\n## 🗓️ Nota Diária\n\nClique no ícone de calendário na barra lateral para organizar seus pensamentos por data.\n\n## 📊 Métricas\n\nContagem de palavras e caracteres em tempo real no rodapé.\n\n## 🔒 Segurança\n\nCriptografia de ponta a ponta (E2E). Sua chave nunca sai do navegador.\n\n---\n\n> 💡 Para ocultar esta nota no futuro, ative **"Ignorar Últimas Novidades"** nas Configurações.`,
    },
    {
      id: `${id}-n1`, title: 'Bem-vindo', folder_id: null,
      content: `# Bem-vindo, ${nickname}!\n\nEste é o seu espaço pessoal de conhecimento.\n\n## Recursos\n\n- **Editor Markdown** com preview ao vivo\n- **[[Wiki Links]]** para conectar notas\n- **#tags** para organização\n- **Grafo** em 3 painéis: editor | preview | grafo\n- **Busca** em tempo real (Ctrl+K)\n- **Backlinks** para ver conexões\n- **Subpastas** para organização\n\nVeja também: [[Guia Rápido]] e [[Guia Markdown]]`,
    },
    {
      id: `${id}-n2`, title: 'Guia Rápido', folder_id: `${id}-f1`,
      content: `# Guia Rápido\n\n## Modos de Visualização\n\n| Modo | Descrição |\n|------|----------|\n| ✏️ Edit | Somente editor |\n| ↔ Split | Editor + Preview |\n| 👁 Preview | Somente preview |\n| 🔗 Grafo | Editor + Preview + Grafo |\n\n## Wiki Links\n\nUse \`[[Título]]\` para linkar notas. Exemplo: [[Bem-vindo]]\n\n## Tags\n\n#guia #atalhos\n\nVeja também: [[Guia Markdown]]`,
    },
    {
      id: `${id}-n3`, title: 'Guia Markdown', folder_id: `${id}-f1-1`,
      content: `# Guia Markdown\n\n**Negrito**  *Itálico*  ~~Tachado~~  \`código\`\n\n## Código\n\n\`\`\`javascript\nconst hello = () => console.log("Olá!");\n\`\`\`\n\n## Checklist\n\n- [x] Criar notas\n- [x] Wiki links\n- [ ] Explorar o grafo\n\n#markdown #referência`,
    },
    {
      id: `${id}-n4`, title: 'Ideias', folder_id: `${id}-f2`,
      content: `# Ideias\n\nEspaço livre para capturar pensamentos.\n\n- [[Bem-vindo]]\n- [[Guia Rápido]]\n\n#ideias #criatividade`,
    },
  ]
}

router.post('/users/login', async (req, res) => {
  const { nickname } = req.body
  if (!nickname) return res.status(400).json({ error: 'nickname required' })

  try {
    let existing
    if (isSqlite()) {
      existing = getSqlite().prepare('SELECT * FROM users WHERE nickname=?').get(nickname)
    } else {
      const r = await getPgPool().query('SELECT * FROM users WHERE nickname=$1', [nickname])
      existing = r.rows[0]
    }
    if (existing) return res.json(existing)

    const id  = `u-${Date.now()}`
    const now = new Date().toISOString()

    if (isSqlite()) {
      const db = getSqlite()
      db.prepare('INSERT INTO users(id,nickname,created_at) VALUES(?,?,?)').run(id, nickname, now)
      const folders = [
        { id: `${id}-f1`,   name: 'Guias',    parent_id: null },
        { id: `${id}-f2`,   name: 'Pessoal',  parent_id: null },
        { id: `${id}-f1-1`, name: 'Markdown', parent_id: `${id}-f1` },
      ]
      for (const f of folders) {
        db.prepare('INSERT INTO folders(id,user_id,name,parent_id,created_at) VALUES(?,?,?,?,?)').run(f.id, id, f.name, f.parent_id, now)
      }
      const notes = getDefaultNotes(id, nickname, now)
      for (const n of notes) {
        db.prepare('INSERT INTO notes(id,user_id,title,content,folder_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(n.id, id, n.title, n.content, n.folder_id, now, now)
      }
    } else {
      const pool = getPgPool()
      await pool.query('INSERT INTO users(id,nickname,created_at) VALUES($1,$2,$3)', [id, nickname, now])
      const folders = [
        { id: `${id}-f1`,   name: 'Guias',    parent_id: null },
        { id: `${id}-f2`,   name: 'Pessoal',  parent_id: null },
        { id: `${id}-f1-1`, name: 'Markdown', parent_id: `${id}-f1` },
      ]
      for (const f of folders) {
        await pool.query('INSERT INTO folders(id,user_id,name,parent_id,created_at) VALUES($1,$2,$3,$4,$5)', [f.id, id, f.name, f.parent_id, now])
      }
      const notes = getDefaultNotes(id, nickname, now)
      for (const n of notes) {
        await pool.query('INSERT INTO notes(id,user_id,title,content,folder_id,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$6)', [n.id, id, n.title, n.content, n.folder_id, now])
      }
    }

    res.json({ id, nickname, created_at: now })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

export default router
