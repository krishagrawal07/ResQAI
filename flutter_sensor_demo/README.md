# ResQAI Accident Detection (Flutter + Android)

Production-ready Flutter implementation for automatic accident monitoring in background foreground-service mode.

## Implemented Architecture

`lib/`
- `main.dart`
- `background_service.dart`
- `sensor_service.dart`
- `location_service.dart`
- `crash_logic.dart`
- `sos_service.dart`
- `emergency_service.dart`

## Crash Scoring Rules

- acceleration > 25 => +20
- speed drop > 20 km/h => +15
- abnormal rotation => +15

Decisions:
- score >= 40 => `triggerFullEmergency()`
- score 20-39 => start 10s SOS countdown

Cooldown:
- after each trigger, 30-second cooldown prevents retrigger loops.

## Android Background Behavior

- Uses `flutter_background_service` with foreground mode.
- Persistent notification content: `Monitoring for accidents`.
- Service auto-start enabled at app launch.
- Boot restart enabled through `BootReceiver` and `RECEIVE_BOOT_COMPLETED`.

## Emergency Flow

1. Build Google Maps location URL from latest GPS coordinates.
2. Send SMS to all saved emergency contacts.
3. Call primary contact.
4. If score is moderate, show full-screen 10-second SOS page (`I'm Safe`).
5. If user does not cancel countdown, emergency flow runs automatically.

## Runtime Permissions Required

- Fine location
- Background location
- Foreground service
- Notifications (Android 13+)
- SMS
- Phone call
- Battery optimization exemption (recommended)

## Setup Steps

1. Install Flutter SDK (stable) and Android SDK.
2. Open terminal in `flutter_sensor_demo`.
3. Run:

```bash
flutter clean
flutter pub get
```

4. Connect Android phone with real sensors and SIM capability.
5. Run app:

```bash
flutter run
```

6. On first launch, grant:
- location (Allow all the time)
- SMS
- phone
- notifications

7. Tap `Disable Battery Optimization` in app and allow exemption.
8. Save at least one emergency contact (phone required, one primary).

## Auto-Start On Boot

Already configured via:
- `AndroidManifest.xml` receiver: `id.flutter.flutter_background_service.BootReceiver`
- service config: `autoStartOnBoot: true`

After reboot, Android starts monitoring service automatically.

## Safe Testing Method

Use app simulation buttons:
- `Simulate Score 30` => starts SOS countdown
- `Simulate Score 50` => triggers full emergency flow immediately

For physical sensor testing without unsafe driving:
- keep phone stationary and use simulation buttons
- optional moderate manual shake to observe telemetry only

## Production Notes

- Android may block background behavior if app is force-stopped manually from system settings.
- For reliable operation, keep battery optimization disabled and allow unrestricted background activity.
