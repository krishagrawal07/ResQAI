# ResQ AI

ResQ AI is an intelligent emergency response system that detects road accidents, confirms severity, and alerts emergency contacts plus nearby hospitals without requiring user interaction.

This repo contains a complete MVP stack:

- `mobile` React Native app (existing root app) for crash detection + SOS workflow
- `backend` Node.js + Express + Socket.IO API for incidents/alerts/live tracking
- `dashboard` React web control room for active incidents, map view, and heatmap

## What Is Implemented

### Mobile App

- Real Expo sensor fusion crash detection using `expo-sensors` accelerometer + gyroscope and `expo-location` GPS speed trends
- Required crash rule:
  `score threshold + high G-force + sudden speed drop + rotation/orientation change => accident`
- Shake-to-SOS trigger using repeated strong real accelerometer movement
- 10-second AI confirmation countdown modal
- Manual "Send SOS Now" button
- Expo SMS composer handoff with fallback simulation when SMS is unavailable
- Expo Haptics vibration plus Expo AV alert sound
- Severity classification: `Low / Medium / Critical`
- `Crash Drill` button for testing the rescue flow without pretending it is live sensor input
- Driver profile + medical notes + blood group
- Emergency contact screen
- Dispatch/live alert screen with tracking link and delivery status
- Live location streaming every 4 seconds to backend/local state after SOS confirmation
- `expo-task-manager` + `expo-background-fetch` heartbeat registration and Expo background location updates

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

Detection is performed locally on-device (`src/services/CrashDetectionService.js` and `src/services/SensorService.js`):

1. Read real accelerometer values from `expo-sensors` and convert `g` to `m/s2`
2. Read real gyroscope values from `expo-sensors` and convert `rad/s` to `deg/s`
3. Read real GPS from `expo-location` every 3-5 seconds and calculate speed drop from previous location samples
4. Compute weighted score:
   `impact force + gyro rotation + GPS speed drop + orientation tilt`
5. Trigger incident when all are true:
   - `score >= profile scoreThreshold`
   - `highImpact`
   - `suddenStop`
   - `orientationChange` from abnormal tilt or rapid rotation

Shake SOS is separate: repeated strong acceleration spikes inside a short window immediately trigger SOS without waiting for crash scoring.

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

If you are building iOS, run this on macOS after `npm install`:

```bash
cd ios
pod install
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
npm run expo:start
```

### Terminal 4: Mobile app

```bash
npm run expo:android
```

The legacy bare commands still exist (`npm start`, `npm run android`, `npm run ios`), but the Expo commands are recommended for the Expo Sensors/Location/SMS/Haptics/AV integration.

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

## 5) Required Phone Permissions

Grant these on the physical device:

- Location while using the app
- Background/always location for live rescue tracking
- Motion and fitness / activity recognition for accelerometer and gyroscope access
- Notifications on Android 13+ so the monitoring foreground service can stay visible
- SMS app access is handled by the native SMS composer; Expo opens the composer with the emergency text prefilled

Android declarations are in `android/app/src/main/AndroidManifest.xml` and `app.json`.

iOS declarations are in `ios/ResQAI/Info.plist` and `app.json`.

## 6) Real Device Test Flow

Use a real iOS or Android phone. Simulators do not provide reliable crash-like accelerometer, gyroscope, SMS, or background location behavior.

1. Add your emergency contact in Profile or Contacts.
2. Open Home and tap `Arm Protection`.
3. Accept foreground location, background location, and motion permissions.
4. Confirm the sensor cards move when the phone moves.
5. Walk/drive slowly in a safe environment and confirm GPS speed updates every 3-5 seconds.
6. Shake the phone strongly three times in about one second to trigger immediate Shake SOS.
7. Use `Crash Drill` only to test the countdown and dispatch UI without creating a dangerous real crash scenario.
8. For a real crash signal, the score must combine a high impact, a rapid rotation/flip, and a GPS speed drop; do not attempt unsafe testing in traffic.

## 7) Demo flow

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

1. "ResQ AI continuously monitors real accelerometer, gyroscope, and GPS signals."
2. "A crash is only triggered when score, high impact, sudden stop, and rotation/orientation signals line up."
3. "After detection, we run a 10-second no-touch safety countdown."
4. "If there is no response, AI confirms severity and auto-generates an emergency incident."
5. "Expo SMS opens a real emergency text with the user's live Maps link, and the backend can also notify responders when configured."
6. "Dispatch teams and family get a live tracking link instantly."
7. "The dashboard shows active incidents in realtime with a crash heatmap for hotspot analysis."
8. "This can reduce emergency response time when victims cannot call for help themselves."

## Notes

- This is an MVP optimized for hackathon demo speed and realism.
- Backend persistence is currently in-memory for fast setup; swap `store.js` with Firestore/PostgreSQL for production persistence.
- Expo SMS opens the native SMS composer on a real phone. If the device cannot send SMS, the app records a simulated local SMS result instead of crashing.
- Background fetch is OS-scheduled and not a guaranteed continuous accelerometer stream, so Android also uses the existing foreground monitoring service while Expo background location keeps the rescue GPS link active.
