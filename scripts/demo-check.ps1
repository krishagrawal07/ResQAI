$ErrorActionPreference = 'Stop'

function Invoke-EndpointCheck {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Url
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10
    return [pscustomobject]@{
      service = $Name
      url = $Url
      ok = $true
      statusCode = $response.StatusCode
      detail = 'reachable'
    }
  } catch {
    return [pscustomobject]@{
      service = $Name
      url = $Url
      ok = $false
      statusCode = 0
      detail = $_.Exception.Message
    }
  }
}

$checks = @()
$checks += Invoke-EndpointCheck -Name 'backend' -Url 'http://localhost:4000/health'
$checks += Invoke-EndpointCheck -Name 'dashboard' -Url 'http://localhost:5173'
$checks += Invoke-EndpointCheck -Name 'metro' -Url 'http://localhost:8081/status'

$checks | Format-Table -AutoSize

$failed = $checks | Where-Object { -not $_.ok }
if ($failed.Count -gt 0) {
  $root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  $pidFile = Join-Path $root '.demo-stack.pids.json'

  if (Test-Path $pidFile) {
    $payload = Get-Content -Raw -Path $pidFile | ConvertFrom-Json
    foreach ($item in $failed) {
      $entry = $payload.processes | Where-Object { $_.name -eq $item.service }
      if ($null -ne $entry) {
        Write-Host ''
        Write-Host "Recent logs for $($item.service):"
        if (Test-Path $entry.stdoutLog) {
          Get-Content -Path $entry.stdoutLog -Tail 12
        }
        if (Test-Path $entry.stderrLog) {
          Get-Content -Path $entry.stderrLog -Tail 12
        }
      }
    }
  }

  Write-Error "One or more services are not reachable. Failed: $($failed.service -join ', ')"
}

Write-Host ''
Write-Host 'All services are reachable.'
