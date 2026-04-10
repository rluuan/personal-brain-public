param(
  [Parameter(Mandatory=$true)]
  [string]$Version
)

$ErrorActionPreference = "Stop"

Write-Host "→ Atualizando versão para $Version..."
$pkg = Get-Content package.json -Raw | ConvertFrom-Json
$pkg.version = $Version
$pkg | ConvertTo-Json -Depth 10 | Set-Content package.json

Write-Host "→ Buildando..."
npm run electron:build

Write-Host "→ Commitando..."
git add .
git commit -m "chore: release v$Version"

Write-Host "→ Criando tag v$Version..."
git tag "v$Version"

Write-Host "→ Fazendo push..."
git push origin main
git push origin "v$Version"

Write-Host ""
Write-Host "✓ Versão v$Version publicada!"
Write-Host ""
Write-Host "Agora acesse o GitHub e suba os arquivos do release:"
Write-Host "  dist/Personal Brain Setup $Version.exe"
Write-Host "  dist/Personal Brain Portable $Version.exe"
Write-Host "  dist/latest.yml"
Write-Host ""
Write-Host "https://github.com/rluuan/personal-brain-public/releases/new?tag=v$Version"
