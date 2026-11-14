# Ver o liberar los puertos fijos del proyecto (ver docs/puertos.md).
# Uso: powershell -File scripts/puertos.ps1 [ver|liberar]
param([string]$Accion = 'ver')
$puertos = 3000, 3300, 4200, 5000, 5055, 8080
foreach ($p in $puertos) {
  $conexiones = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
  if (-not $conexiones) { Write-Host "$p libre"; continue }
  foreach ($id in ($conexiones.OwningProcess | Sort-Object -Unique)) {
    $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
    $nombre = if ($proc) { $proc.ProcessName } else { '?' }
    if ($Accion -eq 'liberar' -and $nombre -match '^(node|python|python3|py|uvicorn)$') {
      Stop-Process -Id $id -Force
      Write-Host "$p liberado ($nombre, PID $id)"
    } else {
      Write-Host "$p ocupado por $nombre (PID $id)"
    }
  }
}
