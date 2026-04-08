# Personal Brain 🚀 

**Este é o primeiro projeto open-source que estou postando!** Estou muito animado em compartilhar o **Personal Brain** com a comunidade. Como é minha primeira contribuição pública, estou totalmente aberto a feedbacks, sugestões e críticas construtivas. O objetivo é aprender e evoluir essa ferramenta continuamente, então sinta-se à vontade para colaborar. Bora evoluir esse projeto juntos!

---

# Personal Brain

**Personal Brain** é um sistema de anotações pessoal focado em **Inteligência Artificial** (RAG e Formatação), desenvolvido na web utilizando React, Vite e PostgreSQL local. 

O aplicativo permite a interligação de suas anotações, visualizações completas de grafos interativos de wiki-links, e comunicação bidirecional com a IA baseada nas suas ferramentas locais de inferência com **Ollama**.

> [!NOTE]
> Este projeto é um **MVP** (Minimum Viable Product) focado na demonstração técnica da integração entre LLM local e gestão de conhecimento pessoal.

## 🧠 Conceito e Inspiração

Este projeto foi inspirado na visão de **Andrej Karpathy** sobre o uso de LLMs (Large Language Models) como orquestradores de bases de conhecimento pessoais. A ideia central é que, em vez de apenas armazenar notas passivamente, o usuário utilize a IA como uma ferramenta ativa para:

1.  **Recuperação Contextual (RAG):** Converter um repositório de Markdown em uma base de dados vetorial, permitindo que o Chat localize e correlacione informações que você já esqueceu.
2.  **Manutenção Automatizada:** Utilizar LLMs para formatar, limpar e sugerir conexões (*backlinks*) entre documentos, reduzindo o esforço manual de organização.
3.  **Privacidade e Segurança (E2EE):**
    *   **Criptografia Zero-Knowledge:** Todas as notas são criptografadas diretamente no navegador usando **AES-256** com derivação de chave **PBKDF2**.
    *   **Privacidade Total:** A sua chave de criptografia nunca sai do seu navegador (armazenada apenas no `localStorage`). O servidor e o banco de dados PostgreSQL armazenam apenas o conteúdo cifrado (*ciphertext*).
    *   **Processamento Local:** Todo o processamento de IA ocorre via **Ollama** local. Seus dados nunca são enviados para APIs externas de nuvem.

**Diferenciais Técnicos:**
*   **Navegação Rápida:** Atalho `Ctrl + K` para busca instantânea e grafo 3D interativo para visualização de conexões.
*   **Chat Inteligente:** O Chat integrado realiza busca semântica em tempo real nas suas notas para responder com contexto real através de RAG.
*   **Formatação Assistida por IA (Magic Sparkles):** 
    *   Cole um texto bruto e use o botão de "Sparkles" para que a IA gere a estrutura Markdown automaticamente.
    *   Suporta formatação da **nota completa** ou apenas de um **trecho selecionado**.
    *   Opção de tradução simultânea durante a formatação.
*   **Editor Fluido:** Foco em Markdown com preview em tempo real e comandos de formatação rápidos.

## Funcionalidades Principais

- 📝 **Editor Markdown** com Auto-Save instantâneo (Debounce).
- 🔗 **Wiki-links bidirecionais** automáticos através de `[[Notas]]`.
- 🕸️ **Painel de Grafo (Inline e Full)** dinâmico, renderizado em canvas, permitindo arrastar os nós (Particle Force Directed Graph).
- 🪄 **Automação IA e Formatação:** O sistema formata trechos de textos inteiros sem alterar a semântica usando LLM.
- 💬 **Sincronização RAG e Chat AI:** 
  - Geração de modelo vetorial (*Embeendings*) local para chunking das anotações em base de dados vetorial usando Postgres.
  - O Chat consegue recuperar partes idênticas das anotações gerando um raciocínio contextual para a IA através de RAG (Busca e Geração).
  - Capacidades completas offline.
- ✨ **Interface de Vidro** moderna através de background dinâmico transparente com controle de densidade e repulsão interativa, criando um UX luxuoso com tema escuro (Catppuccin Macchiato custom).
- 🗂️ **Gerenciador de Subpastas** completo, barra de busca poderosa e interface em múltiplos layout flexíveis (Edit/Split).

## Tecnologias

- **Frontend:** React, Zustand (Gerenciador de Estado), TailwindCSS.
- **Backend:** Node.js, Express.js.
- **Banco de Dados:** PostgreSQL (`/api` endpoints conectam nativamente). Requer a extensão **[pgvector](https://github.com/pgvector/pgvector)** instalada para busca vetorial nativa.
- **Inteligência Artificial:** Ollama com suporte a qualquer modelo (Configurável nas configurações do sistema). Por padrão, utiliza `nomic-embed-text` para Embeddings local e `gemma3:12b` para LLM. Sugere-se o mínimo de 8GB de VRAM.

### 🗄️ Esquema do Banco de Dados
O esquema (tabelas e índices) é criado automaticamente ao iniciar o servidor (`npm run server`). 

> [!IMPORTANT]
> O servidor tentará habilitar a extensão `vector` automaticamente. Se o seu usuário do banco não for superusuário, você deve rodar o comando abaixo manualmente no seu banco uma vez:
> `CREATE EXTENSION IF NOT EXISTS vector;`

## Requisitos
- Node.js (`v18+`)
- PostgreSQL database (default port: `5432`) com extensão `pgvector`.
- [Ollama](https://ollama.com/) configurado em localhost: `11434`
  
### Configuração Inicial de Modelos IA
```bash
# Baixe os modelos na sua máquina
ollama pull gemma3:12b
ollama pull nomic-embed-text
```

## Instalação e Execução

1. Compile / Instale as dependências.
   ```bash
   npm install
   ```
2. Configure seu PostgreSQL com as senhas padrão ou adicione arquivo `.env`. O banco e as tabelas são inferidas no bootstrap.
3. Inicie os servidores paralelamente:

```bash
# Inicia a interface na porta padrão Vite
npm run dev

# Inicie o sub-sistema em outra aba:
npm run server
```

---

## 📝 Licença
**AGPL-3.0-or-later. See [LICENSE.](LICENSE) = [https://github.com/rluuan/personal-brain-public/blob/main/LICENSE](https://github.com/rluuan/personal-brain-public/blob/main/LICENSE)**
