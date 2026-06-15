# SDD-ES — Atajo de instalación para Windows (PowerShell).
#
# Delega en el CLI Node multiplataforma (cli\index.js), que es la fuente
# de verdad única de la lógica de instalación. Si no hay Node, avisa.
#
# Uso:
#   .\instalar.ps1            Instala en el proyecto actual
#   .\instalar.ps1 -Global    Instala para todos tus proyectos ($HOME\.claude)
#
# El camino canónico recomendado es:  npx sdd-es init [--global]
#
# Si PowerShell bloquea el script por la política de ejecución, corre:
#   powershell -ExecutionPolicy Bypass -File .\instalar.ps1

param(
    [switch]$Global
)

$ErrorActionPreference = "Stop"
$PluginDir = $PSScriptRoot

# Verificar Node
$node = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $node) {
    Write-Host "✗ Node.js no está instalado." -ForegroundColor Red
    Write-Host "  SDD-ES necesita Node >=18 para instalarse."
    Write-Host "  Instala Node desde https://nodejs.org y reintenta."
    exit 1
}

# Construir argumentos para el CLI
$cliArgs = @("init")
if ($Global) {
    $cliArgs += "--global"
}

# Delegar al CLI Node (misma lógica que instalar.sh y npx sdd-es)
& node (Join-Path $PluginDir "cli\index.js") @cliArgs
exit $LASTEXITCODE
