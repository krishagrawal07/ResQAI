$ErrorActionPreference = 'Stop'

$apiBaseUrl = if ($env:RESQ_DEMO_API_BASE_URL) {
  $env:RESQ_DEMO_API_BASE_URL.TrimEnd('/')
} else {
  'http://localhost:4000/api'
}

$incident = @{
  dispatchPreferences = @{
    guardianMode = $true
    notifyNearbyResponders = $true
  }
  emergencyPlan = @{
    bloodGroup = 'O+'
    medicalNotes = 'Demo profile: no known allergies'
    roadsidePlan = 'Nearest hospital + emergency contact'
    safeWord = 'ResQ'
  }
  location = @{
    lat = 28.6139
    lng = 77.2090
    address = 'India Gate, New Delhi demo route'
    speedKmh = 5
  }
  metadata = @{
    appVersion = 'demo-script'
    detectedAt = (Get-Date).ToUniversalTime().ToString('o')
    source = 'demo-seed-script'
  }
  mode = 'biker'
  sensorSnapshot = @{
    accelG = 4.35
    audioDb = 112
    gyroMag = 185
    orientationTiltDeg = 83
    speed = 5
    speedBeforeKmh = 62
  }
  userProfile = @{
    name = 'Aarav Demo Rider'
    phone = '+919999999999'
    bloodGroup = 'O+'
    medicalNotes = 'No known allergies'
    vehicleId = 'DL-01-RESQ'
    emergencyContact = @{
      name = 'Priya Emergency Contact'
      phone = '+919888888888'
      relation = 'Sibling'
    }
  }
}

try {
  $healthUrl = $apiBaseUrl -replace '/api$', ''
  Invoke-RestMethod -Uri "$healthUrl/health" -TimeoutSec 8 | Out-Null
} catch {
  Write-Error "Backend is not reachable at $apiBaseUrl. Start it with 'npm run backend' or 'npm run demo:start' first."
}

$response = Invoke-RestMethod `
  -Uri "$apiBaseUrl/incidents" `
  -Method Post `
  -ContentType 'application/json' `
  -Body ($incident | ConvertTo-Json -Depth 8) `
  -TimeoutSec 15

Write-Host ''
Write-Host 'Seeded ResQ AI demo incident.'
Write-Host "Incident ID: $($response.incident.id)"
Write-Host "Severity: $($response.incident.severity.label) ($($response.incident.severity.score)/100)"
Write-Host "Tracking URL: $($response.incident.trackingUrl)"
Write-Host ''
Write-Host 'Open the dashboard at http://localhost:5173 to show the realtime rescue queue.'
