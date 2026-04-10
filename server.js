/**
 * Personal Brain API — Entry Point
 *
 * This file is a thin wrapper that delegates to the modular server in ./server/.
 * All route handlers, DB logic, and services live in dedicated modules:
 *
 *   server/
 *   ├── config.js          — Config loading/saving
 *   ├── index.js           — Express app assembly
 *   ├── db/
 *   │   ├── connection.js  — SQLite/PG pool management
 *   │   ├── query.js       — Unified query abstraction
 *   │   └── schema.js      — Schema creation & init
 *   ├── routes/
 *   │   ├── config.js      — GET/POST /api/config
 *   │   ├── users.js       — POST /api/users/login
 *   │   ├── notes.js       — CRUD /api/notes
 *   │   ├── folders.js     — CRUD /api/folders
 *   │   ├── settings.js    — GET/PUT /api/settings/:user_id
 *   │   ├── export.js      — POST /api/export/*
 *   │   ├── ai.js          — Ollama status, critique, scrape, format
 *   │   └── rag.js         — Sync, embeddings, chat
 *   └── services/
 *       └── ollama.js      — Embedding, streaming, generation
 */

import { startServer } from './server/index.js'

startServer().catch((err) => {
  console.error('Erro fatal ao iniciar:', err.message)
  process.exit(1)
})
