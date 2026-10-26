# Local static preview only. Stop with Ctrl+C.
param([int]$Port = 8081)
$ErrorActionPreference = 'Stop'
$bundledPython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
Write-Host "OceanGate preview: http://127.0.0.1:$Port/"
if (Test-Path -LiteralPath $bundledPython) {
    & $bundledPython -m http.server $Port --bind 127.0.0.1 --directory $PSScriptRoot
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    py -3 -m http.server $Port --bind 127.0.0.1 --directory $PSScriptRoot
} else {
    python -m http.server $Port --bind 127.0.0.1 --directory $PSScriptRoot
}
