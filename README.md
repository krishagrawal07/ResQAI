# ResQ AI

ResQ AI is an intelligent emergency response system that detects road accidents, confirms severity, and alerts emergency contacts plus nearby hospitals without requiring user interaction.

This repo contains a complete MVP stack:
- `mobile` React Native app (existing root app) for crash detection + SOS workflow
- `backend` Node.js + Express + Socket.IO API for incidents/alerts/live tracking
- `dashboard` React web control room for active incidents, map view, and heatmap

## What Is Implemented

### Mobile App
- Sensor fusion crash detection using accelerometer + gyroscope + speed trends
- Required crash rule:
  `high G-force + sudden speed drop + abnormal orientation => accident`
- 10-second AI confirmation countdown modal
- Severity classification: `Low / Medium / Critical`
- `Simulate Crash` button for demo mode
- Driver profile + medical notes + blood group
- Emergency contact screen
- Dispatch/live alert screen with tracking link and delivery status
- Live location streaming to backend after SOS confirmation

### Backend API
- Incident ingestion endpoint from mobile app
- Severity scoring engine and incident metadata persistence (in-memory MVP store)
- Nearest hospital lookup (mock geospatial resolver for fast demo)
- Alert delivery orchestration:
  - Twilio SMS when configured
  - Offline fallback queue when provider/network fails
- WebSocket realtime event stream for dashboard
- Public tracking endpoint by share token
- Heatmap and metrics endpoints

### Admin Dashboard (Web)
- Realtime active incidents feed
- KPI cards (total, active, critical, medium)
- Map marker visualization (Mapbox-enabled when token is provided)
- Incident detail panel with severity reasons + tracking link
- Crash heatmap panel (severity/intensity weighted)
- Public live tracker page: `/track/:shareToken`

## Hackathon Add-ons Included
- AI severity prediction (rule-based scoring engine)
- Offline SMS fallback queue
- Crash heatmap visualization

## Project Structure

```txt
ResQAI/
|-- App.js
|-- src/
|   |-- components/
|   |-- context/AppContext.js
|   |-- navigation/AppNavigator.js
|   |-- screens/
|   |   |-- MonitorScreen.js
|   |   |-- DispatchScreen.js
|   |   |-- ProfileScreen.js
|   |   |-- ContactsScreen.js
|   |-- services/
|   |   |-- CrashDetectionService.js
|   |   |-- SensorService.js
|   |   |-- BackendService.js
|   |   |-- LiveTrackingService.js
|   |-- utils/constants.js
|
|-- backend/
|   |-- package.json
|   |-- .env.example
|   |-- src/
|       |-- server.js
|       |-- socket.js
|       |-- config/env.js
|       |-- routes/incidents.js
|       |-- routes/public.js
|       |-- services/
|       |   |-- store.js
|       |   |-- hospitalService.js
|       |   |-- notificationService.js
|       |-- utils/
|           |-- geo.js
|           |-- severity.js
|
|-- dashboard/
|   |-- package.json
|   |-- .env.example
|   |-- index.html
|   |-- vite.config.js
|   |-- src/
|       |-- main.jsx
|       |-- App.jsx
|       |-- api.js
|       |-- styles.css
```

## Crash Detection Logic

Detection is performed locally on-device (`src/services/CrashDetectionService.js`):

1. Compute acceleration magnitude and convert to G
2. Estimate tilt/orientation from accelerometer vector
3. Detect sudden speed drop from previous speed sample
4. Trigger incident when all are true:
   - `highImpact`
   - `suddenStop`
   - `abnormalOrientation`

Severity scoring then uses weighted components:
- impact force
- speed drop %
- orientation tilt
- rotational spike
- audio spike

## API Overview

Backend base: `http://localhost:4000`

- `GET /health`
- `POST /api/incidents`
- `PATCH /api/incidents/:id/location`
- `PATCH /api/incidents/:id/status`
- `GET /api/incidents?status=active`
- `GET /api/incidents/metrics`
- `GET /api/incidents/heatmap`
- `GET /api/incidents/fallback-queue`
- `GET /api/live/:shareToken`

## Setup Instructions

## 1) Prerequisites
- Node.js 18+
- Android Studio / Xcode for React Native app
- Emulator/device for mobile demo

## 2) Install dependencies

From repo root:

```bash
npm install
npm --prefix backend install
npm --prefix dashboard install
```

Or use:

```bash
npm run setup:all
```

## 3) Environment configuration

### Mobile (`.env` at repo root)
- `RESQ_API_BASE_URL=http://10.0.2.2:4000/api` (Android emulator)
- Use `http://localhost:4000/api` for iOS simulator
- Add Twilio/Firebase/Maps keys as needed

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and configure:
- `PORT=4000`
- `CLIENT_ORIGIN=http://localhost:5173`
- `DASHBOARD_PUBLIC_URL=http://localhost:5173`
- Optional Twilio:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`

### Dashboard (`dashboard/.env`)

Copy `dashboard/.env.example` to `dashboard/.env`:
- `VITE_API_BASE_URL=http://localhost:4000/api`
- Optional `VITE_MAPBOX_TOKEN=<your-token>`

## 4) Run the stack

Open 4 terminals:

### Terminal 1: Backend
```bash
npm run backend
```

### Terminal 2: Dashboard
```bash
npm run dashboard
```

### Terminal 3: Metro bundler
```bash
npm start
```

### Terminal 4: Mobile app
```bash
npm run android
```

### Fast Demo Launcher (Windows PowerShell)
```bash
npm run demo:start
npm run demo:check
```

Seed a dashboard incident without the mobile app:

```bash
npm run demo:incident
```

When done:
```bash
npm run demo:stop
```

## 5) Demo flow

1. Open mobile app on **Monitor** screen
2. Press **Arm Protection**
3. Press **Crash Drill**
4. Show countdown modal with severity label
5. Let countdown finish (or press **Send SOS now**)
6. Open **Dispatch** tab and show:
   - incident tracking link
   - alert delivery entries
   - live map dispatch lanes
7. Open dashboard and show:
   - new incident in realtime
   - severity badge
   - heatmap update
8. Open tracking link (`/track/:token`) to demonstrate public live location sharing

Backup path if the mobile build is slow: run `npm run demo:incident` after `npm run demo:start`, then show the seeded incident appearing in the dashboard and open its tracking link.

## Presentation Script (Under 5 minutes)

1. "ResQ AI continuously monitors motion sensors and speed in the background."
2. "A crash is only triggered when high impact, sudden stop, and abnormal orientation happen together."
3. "After detection, we run a 10-second no-touch safety countdown."
4. "If there is no response, AI confirms severity and auto-generates an emergency incident."
5. "The backend notifies emergency contacts and nearby hospitals, with Twilio or offline fallback queue."
6. "Dispatch teams and family get a live tracking link instantly."
7. "The dashboard shows active incidents in realtime with a crash heatmap for hotspot analysis."
8. "This can reduce emergency response time when victims cannot call for help themselves."

## Notes

- This is an MVP optimized for hackathon demo speed and realism.
- Backend persistence is currently in-memory for fast setup; swap `store.js` with Firestore/PostgreSQL for production persistence.
- Twilio is optional; without keys, notifications are mocked and fallback queue is still demonstrated.
