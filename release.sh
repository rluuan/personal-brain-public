#!/usr/bin/env bash
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Uso: bash release.sh <versão>"
  echo "Exemplo: bash release.sh 1.1.0"
  exit 1
fi

echo "→ Atualizando versão para $VERSION..."
# Atualiza version no package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

echo "→ Buildando..."
npm run electron:build

echo "→ Commitando..."
git add package.json package-lock.json
git commit -m "chore: release v$VERSION"

echo "→ Criando tag v$VERSION..."
git tag "v$VERSION"

echo "→ Fazendo push..."
git push origin main
git push origin "v$VERSION"

echo ""
echo "✓ Versão v$VERSION publicada!"
echo ""
echo "Agora acesse o GitHub e suba os arquivos do release:"
echo "  dist/Personal Brain Setup $VERSION.exe"
echo "  dist/Personal Brain Portable $VERSION.exe"
echo "  dist/latest.yml"
echo ""
echo "https://github.com/rluuan/personal-brain-public/releases/new?tag=v$VERSION"
