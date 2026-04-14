param(
  [switch]$Install
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

function Ensure-Env {
  param([string]$Folder)

  $envPath = Join-Path $Folder ".env"
  $examplePath = Join-Path $Folder ".env.example"

  if (-not (Test-Path $envPath) -and (Test-Path $examplePath)) {
    Copy-Item $examplePath $envPath
    Write-Host ("[info] Arquivo criado: " + $envPath)
  }
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm nao encontrado. Instale Node.js antes de continuar."
}

Ensure-Env $backend
Ensure-Env $frontend

if ($Install -or -not (Test-Path (Join-Path $backend "node_modules"))) {
  Push-Location $backend
  npm install
  Pop-Location
}

if ($Install -or -not (Test-Path (Join-Path $frontend "node_modules"))) {
  Push-Location $frontend
  npm install
  Pop-Location
}

Write-Host "[info] Abra o PostgreSQL e rode backend\db\schema.sql antes de usar o sistema."

$backendCmd = "Set-Location '$backend'; npm run dev"
$frontendCmd = "Set-Location '$frontend'; npm start"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd | Out-Null
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd | Out-Null

Write-Host "[ok] Backend e frontend iniciados em janelas separadas."
