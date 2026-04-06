$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pidFile = Join-Path $root '.demo-stack.pids.json'
$logDir = Join-Path $root 'logs'
$demoLogDir = Join-Path $logDir 'demo-stack'

function Start-StackProcess {
  param(
    [Parameter(Mandatory = $true)][string]$DisplayName,
    [Parameter(Mandatory = $true)][string]$ScriptName,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$Command
  )

  $stdoutLog = Join-Path $demoLogDir "$DisplayName.out.log"
  $stderrLog = Join-Path $demoLogDir "$DisplayName.err.log"

  $proc = Start-Process `
    -FilePath 'cmd.exe' `
    -ArgumentList '/c', $Command `
    -WorkingDirectory $WorkingDirectory `
    -PassThru `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog

  return [pscustomobject]@{
    name = $DisplayName
    pid = $proc.Id
    cwd = $WorkingDirectory
    scriptName = $ScriptName
    command = $Command
    stdoutLog = $stdoutLog
    stderrLog = $stderrLog
  }
}

if (Test-Path $pidFile) {
  Write-Host "Existing PID file found at $pidFile"
  Write-Host 'Run demo:stop first if a previous stack is still running.'
}

New-Item -ItemType Directory -Force -Path $demoLogDir | Out-Null

$processes = @()

Write-Host 'Starting ResQ AI backend...'
$processes += Start-StackProcess `
  -DisplayName 'backend' `
  -ScriptName 'start' `
  -WorkingDirectory (Join-Path $root 'backend') `
  -Command 'npm run start'

Start-Sleep -Seconds 2

Write-Host 'Starting ResQ AI dashboard...'
$processes += Start-StackProcess `
  -DisplayName 'dashboard' `
  -ScriptName 'dev' `
  -WorkingDirectory (Join-Path $root 'dashboard') `
  -Command 'npm run dev'

Start-Sleep -Seconds 2

Write-Host 'Starting Metro bundler...'
$processes += Start-StackProcess `
  -DisplayName 'metro' `
  -ScriptName 'start' `
  -WorkingDirectory $root `
  -Command 'npm run start'

$payload = [pscustomobject]@{
  startedAt = (Get-Date).ToString('o')
  processes = $processes
}

$payload | ConvertTo-Json -Depth 4 | Set-Content -Path $pidFile

Write-Host ''
Write-Host 'ResQ AI stack launch initiated.'
Write-Host "PID file: $pidFile"
Write-Host "Logs: $demoLogDir"
Write-Host 'Next: run `npm run demo:check`'
