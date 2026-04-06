$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pidFile = Join-Path $root '.demo-stack.pids.json'

if (-not (Test-Path $pidFile)) {
  Write-Host "No PID file found at $pidFile"
  Write-Host 'Nothing to stop.'
  exit 0
}

$payload = Get-Content -Raw -Path $pidFile | ConvertFrom-Json

foreach ($entry in $payload.processes) {
  try {
    $proc = Get-Process -Id $entry.pid -ErrorAction Stop
    cmd /c "taskkill /PID $($proc.Id) /T /F" | Out-Null
    Write-Host "Stopped $($entry.name) (PID $($entry.pid))"
  } catch {
    Write-Host "$($entry.name) already stopped or unavailable (PID $($entry.pid))"
  }
}

Remove-Item -LiteralPath $pidFile -Force
Write-Host 'ResQ AI demo stack stopped.'
