# Exporta los SVG propios a PNG con Microsoft Edge en modo headless.
# Ejecutar: powershell -ExecutionPolicy Bypass -File img/fuentes-svg/exportar-png.ps1
$ErrorActionPreference = 'Stop'
$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path -LiteralPath $edgePath)) { throw 'Microsoft Edge no encontrado. Ajusta $edgePath.' }
$outputDir = Split-Path -Parent $PSScriptRoot
$profileDir = Join-Path ([System.IO.Path]::GetTempPath()) ('mayoristapro-c4-edge-' + [guid]::NewGuid())
foreach ($source in Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'nivel*.svg') {
    [xml]$svg = Get-Content -LiteralPath $source.FullName -Raw -Encoding UTF8
    $width = [int]$svg.DocumentElement.width
    $height = [int]$svg.DocumentElement.height
    $target = Join-Path $outputDir ($source.BaseName + '.png')
    # El HTML evita los márgenes del visor SVG del navegador.
    $htmlPath = Join-Path $profileDir ($source.BaseName + '.html')
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    $svgContent = Get-Content -LiteralPath $source.FullName -Raw -Encoding UTF8
    $html = '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden}svg{display:block}</style>' + $svgContent
    [System.IO.File]::WriteAllText($htmlPath, $html, [System.Text.UTF8Encoding]::new($false))
    $uri = [System.Uri]::new($htmlPath).AbsoluteUri
    $edgeArgs = @('--headless', '--disable-gpu', '--no-first-run', '--hide-scrollbars', "--user-data-dir=`"$profileDir`"", "--screenshot=`"$target`"", "--window-size=$width,$height", '--force-device-scale-factor=1', "`"$uri`"")
    Start-Process -FilePath $edgePath -ArgumentList $edgeArgs -WindowStyle Hidden -Wait
    if (-not (Test-Path -LiteralPath $target)) { throw "No se generó $target" }
    Write-Output "Exportado: $($source.BaseName).png ($width x $height)"
}
