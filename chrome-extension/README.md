# Personal Brain — Live Memory Chrome Extension

Captura automaticamente links visitados no Chrome e envia para o Personal Brain.

## Instalação (Carregar Extensão Descompactada)

1. Abra o Chrome e acesse `chrome://extensions/`
2. Ative o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `chrome-extension/` deste projeto
5. A extensão aparecerá na barra de ferramentas

## Configuração

1. Clique no ícone ⬡ da extensão na barra de ferramentas
2. Preencha:
   - **URL do servidor**: `http://localhost:3001` (padrão)
   - **Seu nickname**: o mesmo usado no Personal Brain
3. Clique em **Salvar configuração**
4. O indicador verde confirma a conexão

## Funcionalidades

- **Captura automática**: toda aba aberta ou atualizada é capturada
- **Sem duplicatas**: URLs já salvas são ignoradas silenciosamente
- **Fila offline**: links capturados sem conexão são enviados ao reconectar
- **Toggle de ativação**: desative a captura pelo popup sem remover a extensão

## Filtros automáticos

URLs ignoradas automaticamente:
- `chrome://` (páginas internas do Chrome)
- `chrome-extension://` (extensões)
- `about:` (páginas about)
- Qualquer URL que não começa com `http://` ou `https://`

## Release como .zip

Para distribuir:
```bash
# Na raiz do projeto
cd chrome-extension
zip -r ../personal-brain-live-memory.zip . --exclude "*.md" --exclude "generate-icons.js"
```

O arquivo `.zip` pode ser carregado via "Carregar sem compactação" após descompactar.
