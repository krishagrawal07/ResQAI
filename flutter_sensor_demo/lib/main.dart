import 'dart:async';
import 'dart:io';

import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';

import 'background_service.dart';
import 'crash_logic.dart';
import 'crash_settings_store.dart';
import 'emergency_service.dart';
import 'incident_history_store.dart';
import 'location_service.dart';
import 'log_store.dart';

enum _BatteryDialogAction {
  disableNow,
  openAppSettings,
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeBackgroundService();
  runApp(const AccidentMonitorApp());
}

class AccidentMonitorApp extends StatelessWidget {
  const AccidentMonitorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'ResQ AI Safety Monitor',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0E7490),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(0xFFF3F6FB),
        useMaterial3: true,
      ),
      home: const AccidentMonitorPage(),
    );
  }
}

class AccidentMonitorPage extends StatefulWidget {
  const AccidentMonitorPage({super.key});

  @override
  State<AccidentMonitorPage> createState() => _AccidentMonitorPageState();
}

class _AccidentMonitorPageState extends State<AccidentMonitorPage>
    with WidgetsBindingObserver {
  static const int _contactSlots = 3;

  final FlutterBackgroundService _service = FlutterBackgroundService();
  final EmergencyService _emergencyService = EmergencyService();
  final ValueNotifier<int> _sosCountdownNotifier = ValueNotifier<int>(10);

  late final List<TextEditingController> _nameControllers;
  late final List<TextEditingController> _phoneControllers;

  final List<StreamSubscription<dynamic>> _subs =
      <StreamSubscription<dynamic>>[];
  final List<String> _logs = <String>[];
  final List<IncidentRecord> _incidents = <IncidentRecord>[];

  bool _isAppVisible = true;
  bool _isServiceRunning = false;
  bool _isPermissionReady = false;
  bool _isBatteryOptimizationDisabled = false;
  bool _isBatteryDialogVisible = false;
  bool _isSosDialogVisible = false;

  bool _monitoringActive = false;
  bool _sosActive = false;
  bool _emergencyFlowActive = false;
  int _serviceUptimeSeconds = 0;
  int? _sensorAgeSeconds;
  int? _locationAgeSeconds;

  double _accel = 0;
  double _gyro = 0;
  double _speed = 0;
  double _speedDrop = 0;
  double? _latitude;
  double? _longitude;
  bool _hasLiveLocation = false;
  int _score = 0;
  String _status = 'Monitoring for accidents';
  String _lastEmergencySummary = '--';
  int _primaryContactIndex = 0;
  GoogleMapController? _mapController;
  LatLng? _lastMapCameraTarget;

  CrashThresholdConfig _thresholds = const CrashThresholdConfig();
  bool _thresholdDirty = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _nameControllers = List<TextEditingController>.generate(
      _contactSlots,
      (_) => TextEditingController(),
    );
    _phoneControllers = List<TextEditingController>.generate(
      _contactSlots,
      (_) => TextEditingController(),
    );
    _bindServiceEvents();
    unawaited(_bootstrap());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _isAppVisible = state == AppLifecycleState.resumed;
    _service.invoke(
      'ui_visibility',
      <String, dynamic>{'visible': _isAppVisible},
    );
  }

  Future<void> _bootstrap() async {
    await _loadPersistedLogs();
    await _loadSavedContacts();
    await _loadThresholds();
    await _loadLocalIncidents();
    await _requestCriticalPermissions();
    await _enforceBatteryOptimizationExemption();
    await _syncContactsToService();
    await _refreshServiceState();
    _service.invoke('ui_visibility', <String, dynamic>{'visible': true});
    _service.invoke('request_state');
    _service.invoke('request_health');
    _service.invoke('request_incident_history');
    _service.invoke('request_thresholds');
  }

  void _bindServiceEvents() {
    _subs.add(
      _service.on('telemetry').listen((event) {
        final map = _asMap(event);
        final rawThresholds = map['thresholds'];
        final hasLocation = map['hasLocation'] == true;
        final latitude = _asDouble(map['latitude'], fallback: _latitude ?? 0);
        final longitude =
            _asDouble(map['longitude'], fallback: _longitude ?? 0);
        if (rawThresholds is Map && !_thresholdDirty) {
          _thresholds = CrashThresholdConfig.fromMap(
            rawThresholds.map((key, value) => MapEntry(key.toString(), value)),
          );
        }

        setState(() {
          _accel = _asDouble(map['accelerationMagnitude'], fallback: 0);
          _gyro = _asDouble(map['rotationMagnitude'], fallback: 0);
          _speed = _asDouble(map['speedKmh'], fallback: 0);
          _speedDrop = _asDouble(map['speedDropKmh'], fallback: 0);
          _score = _asInt(map['score'], fallback: _score);
          _status = (map['status'] as String?) ?? _status;
          _monitoringActive = map['monitoringActive'] == true;
          _hasLiveLocation = hasLocation;
          if (hasLocation) {
            _latitude = latitude;
            _longitude = longitude;
          }
        });

        if (hasLocation) {
          unawaited(_moveMapCameraTo(latitude, longitude));
        }
      }),
    );

    _subs.add(
      _service.on('service_health').listen((event) {
        final map = _asMap(event);
        setState(() {
          _monitoringActive = map['monitoringActive'] == true;
          _sosActive = map['sosActive'] == true;
          _emergencyFlowActive = map['emergencyFlowActive'] == true;
          _serviceUptimeSeconds =
              _asInt(map['uptimeSeconds'], fallback: _serviceUptimeSeconds);
          _sensorAgeSeconds = _asNullableInt(map['sensorAgeSeconds']);
          _locationAgeSeconds = _asNullableInt(map['locationAgeSeconds']);
        });
      }),
    );

    _subs.add(
      _service.on('thresholds_updated').listen((event) {
        setState(() {
          _thresholds = CrashThresholdConfig.fromMap(_asMap(event));
          _thresholdDirty = false;
        });
      }),
    );

    _subs.add(
      _service.on('incident_history').listen((event) {
        final raw = _asMap(event)['incidents'];
        if (raw is! List) {
          return;
        }
        final parsed = <IncidentRecord>[];
        for (final item in raw) {
          if (item is! Map) {
            continue;
          }
          parsed.add(
            IncidentRecord.fromMap(
              item.map((key, value) => MapEntry(key.toString(), value)),
            ),
          );
        }
        parsed.sort((a, b) => b.occurredAt.compareTo(a.occurredAt));
        setState(() {
          _incidents
            ..clear()
            ..addAll(parsed);
        });
      }),
    );

    _subs.add(
      _service.on('service_log').listen((event) {
        final map = _asMap(event);
        final message = (map['message'] as String?)?.trim();
        if (message == null || message.isEmpty) {
          return;
        }
        _appendLog(
          message,
          persist: false,
          level: (map['level'] as String?) ?? 'info',
          at: DateTime.tryParse((map['at'] as String?) ?? ''),
        );
      }),
    );

    _subs.add(
      _service.on('service_status').listen((event) async {
        final map = _asMap(event);
        final reportedRunning = map['running'];
        if (reportedRunning is bool && mounted) {
          setState(() {
            _isServiceRunning = reportedRunning;
            if (!reportedRunning) {
              _monitoringActive = false;
              _status = 'Service stopped';
            }
          });
        }

        final running = await _service.isRunning();
        if (!mounted) {
          return;
        }
        setState(() {
          _isServiceRunning = running;
        });
      }),
    );

    _subs.add(
      _service.on('permission_error').listen((event) {
        final message = (_asMap(event)['message'] as String?) ??
            'A required permission is missing for background monitoring.';
        _appendLog(message, persist: false, level: 'warn');
      }),
    );

    _subs.add(
      _service.on('sos_started').listen((event) {
        final seconds = _asInt(_asMap(event)['remainingSeconds'], fallback: 10);
        _sosCountdownNotifier.value = seconds;
        _appendLog(
          'SOS countdown started for $seconds seconds.',
          persist: false,
          level: 'warn',
        );
        if (_isAppVisible) {
          unawaited(_showSosFullScreenAlert());
        }
      }),
    );

    _subs.add(
      _service.on('sos_countdown').listen((event) {
        _sosCountdownNotifier.value = _asInt(
          _asMap(event)['remainingSeconds'],
          fallback: _sosCountdownNotifier.value,
        );
      }),
    );

    _subs.add(
      _service.on('sos_cancelled').listen((event) {
        _appendLog(
          'SOS cancelled by user confirmation.',
          persist: false,
          level: 'warn',
        );
        _dismissSosDialog();
      }),
    );

    _subs.add(
      _service.on('emergency_triggered').listen((event) {
        final map = _asMap(event);
        final smsSummary =
            (map['smsSummary'] as String?) ?? 'SMS dispatch result unavailable';
        final callSummary =
            (map['callSummary'] as String?) ?? 'Phone call result unavailable';
        final mapsLink = (map['mapsLink'] as String?) ?? 'Location unavailable';
        _dismissSosDialog();
        _appendLog(
          'Emergency flow executed: $smsSummary | $callSummary',
          persist: false,
          level: 'warn',
        );
        setState(() {
          _lastEmergencySummary =
              'SMS: $smsSummary\nCall: $callSummary\nLocation: $mapsLink';
        });
        _service.invoke('request_incident_history');
      }),
    );
  }

  Future<void> _refreshServiceState() async {
    final running = await _service.isRunning();
    if (!mounted) {
      return;
    }
    setState(() {
      _isServiceRunning = running;
    });
  }

  Future<void> _loadPersistedLogs() async {
    final persisted = await MonitoringLogStore.loadFormatted(limit: 80);
    if (!mounted) {
      return;
    }
    setState(() {
      _logs
        ..clear()
        ..addAll(persisted);
    });
  }

  Future<void> _loadLocalIncidents() async {
    final incidents = await IncidentHistoryStore.load();
    if (!mounted) {
      return;
    }
    setState(() {
      _incidents
        ..clear()
        ..addAll(incidents);
    });
  }

  Future<void> _loadThresholds() async {
    final config = await CrashSettingsStore.load();
    if (!mounted) {
      return;
    }
    setState(() {
      _thresholds = config;
      _thresholdDirty = false;
    });
  }

  Future<void> _requestCriticalPermissions() async {
    if (!Platform.isAndroid) {
      setState(() => _isPermissionReady = true);
      return;
    }

    final locationResult =
        await LocationService.ensurePermissions(requestIfNeeded: true);
    if (!locationResult.isGranted) {
      _appendLog(
        locationResult.message ??
            'Location permission is required for background monitoring.',
        level: 'warn',
      );
    }

    await Permission.location.request();
    await Permission.locationAlways.request();
    await Permission.sms.request();
    await Permission.phone.request();
    await Permission.notification.request();

    if (mounted) {
      setState(() => _isPermissionReady = true);
    }
  }

  Future<void> _refreshBatteryOptimizationState() async {
    if (!Platform.isAndroid) {
      if (mounted) {
        setState(() => _isBatteryOptimizationDisabled = true);
      }
      return;
    }
    final permission = await Permission.ignoreBatteryOptimizations.status;
    if (mounted) {
      setState(() => _isBatteryOptimizationDisabled = permission.isGranted);
    }
  }

  Future<bool> _requestDisableBatteryOptimization({
    bool interactive = true,
  }) async {
    if (!Platform.isAndroid) {
      return true;
    }

    final permission = await Permission.ignoreBatteryOptimizations.status;
    if (permission.isGranted) {
      await _refreshBatteryOptimizationState();
      if (interactive) {
        _appendLog('Battery optimization is already disabled for this app.');
      }
      return true;
    }

    final requestResult = await Permission.ignoreBatteryOptimizations.request();
    if (requestResult.isGranted) {
      await _refreshBatteryOptimizationState();
      if (interactive) {
        _appendLog('Battery optimization disabled.');
      }
      return true;
    }

    final packageName = (await PackageInfo.fromPlatform()).packageName;
    final intent = AndroidIntent(
      action: 'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
      data: 'package:$packageName',
    );
    await intent.launch();
    await Future<void>.delayed(const Duration(milliseconds: 800));
    await _refreshBatteryOptimizationState();
    return _isBatteryOptimizationDisabled;
  }

  Future<void> _enforceBatteryOptimizationExemption() async {
    if (!Platform.isAndroid || !mounted) {
      return;
    }

    await _refreshBatteryOptimizationState();
    if (_isBatteryOptimizationDisabled || _isBatteryDialogVisible) {
      return;
    }

    _isBatteryDialogVisible = true;
    while (mounted && !_isBatteryOptimizationDisabled) {
      final action = await showDialog<_BatteryDialogAction>(
        context: context,
        barrierDismissible: false,
        builder: (context) {
          return PopScope(
            canPop: false,
            child: AlertDialog(
              title: const Text('Disable Battery Optimization'),
              content: const Text(
                'ResQ AI must be exempt from battery optimization to monitor crashes while app is minimized or phone is locked.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context)
                      .pop(_BatteryDialogAction.openAppSettings),
                  child: const Text('Open App Settings'),
                ),
                FilledButton(
                  onPressed: () => Navigator.of(context)
                      .pop(_BatteryDialogAction.disableNow),
                  child: const Text('Disable Now'),
                ),
              ],
            ),
          );
        },
      );

      if (!mounted) {
        break;
      }

      if (action == _BatteryDialogAction.openAppSettings) {
        await openAppSettings();
      } else {
        await _requestDisableBatteryOptimization(interactive: false);
      }
      await Future<void>.delayed(const Duration(milliseconds: 800));
      await _refreshBatteryOptimizationState();
    }

    _isBatteryDialogVisible = false;
  }

  Future<void> _toggleService() async {
    if (_isServiceRunning) {
      setState(() {
        _status = 'Stopping service...';
        _monitoringActive = false;
      });
      _service.invoke('stop_service');
      for (var i = 0; i < 8; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 400));
        final running = await _service.isRunning();
        if (!running) {
          break;
        }
        if (i >= 3) {
          _service.invoke('stop_service');
        }
      }
    } else {
      await _service.startService();
      _service.invoke('request_state');
      _service.invoke('request_health');
      _service.invoke('request_incident_history');
    }
    await Future<void>.delayed(const Duration(milliseconds: 500));
    await _refreshServiceState();
  }

  Future<void> _saveThresholds() async {
    await CrashSettingsStore.save(_thresholds);
    _service.invoke('update_thresholds', _thresholds.toMap());
    setState(() => _thresholdDirty = false);
    _appendLog('Crash threshold tuning saved.');
  }

  void _setThresholds(CrashThresholdConfig value) {
    setState(() {
      _thresholds = value;
      _thresholdDirty = true;
    });
  }

  Future<void> _clearIncidentHistory() async {
    _service.invoke('clear_incident_history');
  }

  Future<void> _simulateSos() async {
    _service.invoke('simulate_crash', <String, dynamic>{'score': 30});
  }

  Future<void> _simulateFullEmergency() async {
    _service.invoke('simulate_crash', <String, dynamic>{'score': 50});
  }

  Future<void> _loadSavedContacts() async {
    final contacts = await _emergencyService.loadContacts();
    if (!mounted) {
      return;
    }
    for (var i = 0; i < _contactSlots; i++) {
      final contact = i < contacts.length ? contacts[i] : null;
      _nameControllers[i].text = contact?.name ?? '';
      _phoneControllers[i].text = contact?.phone ?? '';
      if (contact?.isPrimary == true) {
        _primaryContactIndex = i;
      }
    }
    setState(() {});
  }

  Future<void> _saveContacts() async {
    final contacts = <EmergencyContact>[];
    for (var i = 0; i < _contactSlots; i++) {
      final name = _nameControllers[i].text.trim();
      final phone = _phoneControllers[i].text.trim();
      if (name.isEmpty && phone.isEmpty) {
        continue;
      }
      if (phone.isEmpty) {
        _appendLog('Contact ${i + 1} is missing a phone number.');
        return;
      }
      contacts.add(
        EmergencyContact(
          name: name.isEmpty ? 'Emergency Contact ${i + 1}' : name,
          phone: phone,
          isPrimary: i == _primaryContactIndex,
        ),
      );
    }
    if (contacts.isNotEmpty && !contacts.any((c) => c.isPrimary)) {
      contacts[0] = contacts[0].copyWith(isPrimary: true);
    }
    await _emergencyService.saveContacts(contacts);
    await _syncContactsToService();
    _appendLog('Emergency contacts saved.');
  }

  Future<void> _syncContactsToService() async {
    final contacts = await _emergencyService.loadContacts();
    _service.invoke('update_contacts', <String, dynamic>{
      'contacts': contacts.map((e) => e.toMap()).toList(),
    });
  }

  Future<void> _showSosFullScreenAlert() async {
    if (_isSosDialogVisible || !mounted) {
      return;
    }
    _isSosDialogVisible = true;
    await showGeneralDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'SOS',
      pageBuilder: (context, _, __) {
        return Scaffold(
          backgroundColor: const Color(0xFF7F1D1D),
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.warning_amber_rounded,
                    color: Colors.white,
                    size: 96,
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Possible Accident Detected',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 30,
                    ),
                  ),
                  const SizedBox(height: 20),
                  ValueListenableBuilder<int>(
                    valueListenable: _sosCountdownNotifier,
                    builder: (context, seconds, _) {
                      final progress = (seconds / 10).clamp(0.0, 1.0);
                      return Column(
                        children: [
                          Text(
                            '$seconds',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 72,
                            ),
                          ),
                          const SizedBox(height: 10),
                          LinearProgressIndicator(
                            value: progress,
                            minHeight: 10,
                          ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 28),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF7F1D1D),
                        padding: const EdgeInsets.symmetric(vertical: 18),
                      ),
                      onPressed: () {
                        _service.invoke(
                          'cancel_sos',
                          <String, dynamic>{'reason': 'user_confirmed_safe'},
                        );
                        _dismissSosDialog();
                      },
                      child: const Text('I\'m Safe'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
    _isSosDialogVisible = false;
  }

  void _dismissSosDialog() {
    if (!_isSosDialogVisible || !mounted) {
      return;
    }
    Navigator.of(context, rootNavigator: true).pop();
    _isSosDialogVisible = false;
  }

  bool _shouldMoveMapCamera(LatLng nextTarget) {
    final previousTarget = _lastMapCameraTarget;
    if (previousTarget == null) {
      return true;
    }
    final latDiff = (nextTarget.latitude - previousTarget.latitude).abs();
    final lngDiff = (nextTarget.longitude - previousTarget.longitude).abs();
    return latDiff > 0.0002 || lngDiff > 0.0002;
  }

  Future<void> _moveMapCameraTo(
    double latitude,
    double longitude, {
    bool force = false,
  }) async {
    final controller = _mapController;
    if (controller == null) {
      return;
    }

    final nextTarget = LatLng(latitude, longitude);
    if (!force && !_shouldMoveMapCamera(nextTarget)) {
      return;
    }

    _lastMapCameraTarget = nextTarget;
    try {
      await controller.animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(
            target: nextTarget,
            zoom: 16.5,
          ),
        ),
      );
    } catch (_) {
      // Ignore camera animation errors when map is not fully ready.
    }
  }

  Future<void> _openLiveLocationInGoogleMaps() async {
    final latitude = _latitude;
    final longitude = _longitude;
    if (!_hasLiveLocation || latitude == null || longitude == null) {
      return;
    }

    final uri = Uri.parse(
      'https://maps.google.com/?q=$latitude,$longitude',
    );
    final launched = await launchUrl(
      uri,
      mode: LaunchMode.externalApplication,
    );
    if (!launched) {
      _appendLog(
        'Unable to open Google Maps for live location.',
        persist: false,
        level: 'warn',
      );
    }
  }

  void _appendLog(
    String message, {
    bool persist = true,
    String level = 'info',
    DateTime? at,
  }) {
    if (!mounted) {
      return;
    }
    final timestamp = at ?? DateTime.now();
    setState(() {
      _logs.insert(
        0,
        '${timestamp.toIso8601String()} [${level.toUpperCase()}] $message',
      );
      if (_logs.length > 80) {
        _logs.removeLast();
      }
    });
    if (persist) {
      unawaited(
        MonitoringLogStore.append(message, timestamp: timestamp, level: level),
      );
    }
  }

  Map<String, dynamic> _asMap(dynamic event) {
    if (event is Map) {
      return event.map((key, value) => MapEntry(key.toString(), value));
    }
    return <String, dynamic>{};
  }

  int _asInt(dynamic value, {required int fallback}) {
    if (value is num) {
      return value.toInt();
    }
    return int.tryParse('$value') ?? fallback;
  }

  int? _asNullableInt(dynamic value) {
    if (value == null) {
      return null;
    }
    if (value is num) {
      return value.toInt();
    }
    return int.tryParse('$value');
  }

  double _asDouble(dynamic value, {required double fallback}) {
    if (value is num) {
      return value.toDouble();
    }
    return double.tryParse('$value') ?? fallback;
  }

  String _formatAge(int? seconds) {
    if (seconds == null) {
      return 'n/a';
    }
    if (seconds < 2) {
      return 'live';
    }
    return '${seconds}s ago';
  }

  String _formatUptime(int seconds) {
    final d = Duration(seconds: seconds);
    final h = d.inHours.toString().padLeft(2, '0');
    final m = (d.inMinutes % 60).toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$h:$m:$s';
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _service.invoke('ui_visibility', <String, dynamic>{'visible': false});
    for (final sub in _subs) {
      sub.cancel();
    }
    for (final controller in _nameControllers) {
      controller.dispose();
    }
    for (final controller in _phoneControllers) {
      controller.dispose();
    }
    _mapController?.dispose();
    _mapController = null;
    _sosCountdownNotifier.dispose();
    super.dispose();
  }

  Widget _header(String title, {String? subtitle}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _card(Widget child) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: child,
      ),
    );
  }

  Widget _statusChip(String label, bool ok) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        color: ok ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: ok ? const Color(0xFF166534) : const Color(0xFF991B1B),
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _line(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _contactInput(int index) {
    return Column(
      children: [
        TextField(
          controller: _nameControllers[index],
          decoration: InputDecoration(
            labelText: 'Contact ${index + 1} Name',
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _phoneControllers[index],
          keyboardType: TextInputType.phone,
          decoration: InputDecoration(
            labelText: 'Contact ${index + 1} Phone',
            border: const OutlineInputBorder(),
          ),
        ),
        Row(
          children: [
            Checkbox(
              value: _primaryContactIndex == index,
              onChanged: (v) {
                if (v != true) {
                  return;
                }
                setState(() => _primaryContactIndex = index);
              },
            ),
            const Text('Primary call contact'),
          ],
        ),
      ],
    );
  }

  Widget _thresholdSlider({
    required String label,
    required double value,
    required double min,
    required double max,
    required String unit,
    required ValueChanged<double> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(label)),
              Text('${value.toStringAsFixed(1)} $unit'),
            ],
          ),
          Slider(value: value, min: min, max: max, onChanged: onChanged),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('ResQ AI Safety Monitor'),
        actions: [
          IconButton(
            onPressed: () {
              _service.invoke('request_state');
              _service.invoke('request_health');
              _service.invoke('request_incident_history');
            },
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _header(
                  'Live Status',
                  subtitle: 'Monitoring active + service health',
                ),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _statusChip(
                      _monitoringActive
                          ? 'Monitoring Active'
                          : 'Monitoring Off',
                      _monitoringActive,
                    ),
                    _statusChip(
                      _isServiceRunning ? 'Service Running' : 'Stopped',
                      _isServiceRunning,
                    ),
                    _statusChip(
                      _isBatteryOptimizationDisabled
                          ? 'Battery Unrestricted'
                          : 'Battery Restricted',
                      _isBatteryOptimizationDisabled,
                    ),
                    _statusChip(
                        _sosActive ? 'SOS Active' : 'SOS Idle', _sosActive),
                  ],
                ),
                const SizedBox(height: 14),
                const Text(
                  'Status',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 6),
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Text(
                    _status,
                    softWrap: true,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                const SizedBox(height: 8),
                _line('Uptime', _formatUptime(_serviceUptimeSeconds)),
                _line('Sensor heartbeat', _formatAge(_sensorAgeSeconds)),
                _line('Location heartbeat', _formatAge(_locationAgeSeconds)),
                _line(
                  'Emergency pipeline',
                  _emergencyFlowActive ? 'Running' : 'Idle',
                ),
                _line('Permissions ready', _isPermissionReady ? 'Yes' : 'No'),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: _toggleService,
                        child: Text(
                          _isServiceRunning ? 'Stop Service' : 'Start Service',
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          await _requestDisableBatteryOptimization();
                          await _enforceBatteryOptimizationExemption();
                        },
                        child: const Text('Battery Settings'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _header('Live Telemetry'),
                _line('Acceleration', _accel.toStringAsFixed(2)),
                _line('Gyroscope', _gyro.toStringAsFixed(2)),
                _line('Speed', '${_speed.toStringAsFixed(2)} km/h'),
                _line('Speed drop', '${_speedDrop.toStringAsFixed(2)} km/h'),
                _line('Crash score', '$_score'),
                _line(
                  'Latitude',
                  _hasLiveLocation && _latitude != null
                      ? _latitude!.toStringAsFixed(6)
                      : '--',
                ),
                _line(
                  'Longitude',
                  _hasLiveLocation && _longitude != null
                      ? _longitude!.toStringAsFixed(6)
                      : '--',
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _header(
                  'Live Location',
                  subtitle: 'Real-time GPS on Google Maps',
                ),
                if (!_hasLiveLocation ||
                    _latitude == null ||
                    _longitude == null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Text(
                      'Waiting for GPS fix from background service...',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  )
                else ...[
                  SizedBox(
                    height: 240,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: GoogleMap(
                        initialCameraPosition: CameraPosition(
                          target: LatLng(_latitude!, _longitude!),
                          zoom: 16.5,
                        ),
                        markers: <Marker>{
                          Marker(
                            markerId: const MarkerId('live_location'),
                            position: LatLng(_latitude!, _longitude!),
                            infoWindow:
                                const InfoWindow(title: 'Your live location'),
                          ),
                        },
                        myLocationEnabled: true,
                        myLocationButtonEnabled: false,
                        mapToolbarEnabled: true,
                        zoomControlsEnabled: false,
                        compassEnabled: true,
                        onMapCreated: (controller) {
                          _mapController?.dispose();
                          _mapController = controller;
                          unawaited(
                            _moveMapCameraTo(
                              _latitude!,
                              _longitude!,
                              force: true,
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _moveMapCameraTo(
                            _latitude!,
                            _longitude!,
                            force: true,
                          ),
                          icon: const Icon(Icons.my_location_outlined),
                          label: const Text('Recenter'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _openLiveLocationInGoogleMaps,
                          icon: const Icon(Icons.map_outlined),
                          label: const Text('Open in Maps'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'If tiles are blank, configure MAPS_API_KEY in Android build.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _header(
                  'False-Crash Reduction',
                  subtitle: 'Ignore small movement and tune thresholds',
                ),
                _thresholdSlider(
                  label: 'Acceleration trigger',
                  value: _thresholds.accelerationThreshold,
                  min: 18,
                  max: 45,
                  unit: 'm/s²',
                  onChanged: (v) => _setThresholds(
                    _thresholds.copyWith(accelerationThreshold: v),
                  ),
                ),
                _thresholdSlider(
                  label: 'Speed-drop trigger',
                  value: _thresholds.speedDropThresholdKmh,
                  min: 8,
                  max: 45,
                  unit: 'km/h',
                  onChanged: (v) => _setThresholds(
                    _thresholds.copyWith(speedDropThresholdKmh: v),
                  ),
                ),
                _thresholdSlider(
                  label: 'Rotation trigger',
                  value: _thresholds.rotationAbnormalThreshold,
                  min: 2,
                  max: 10,
                  unit: 'rad/s',
                  onChanged: (v) => _setThresholds(
                    _thresholds.copyWith(rotationAbnormalThreshold: v),
                  ),
                ),
                _thresholdSlider(
                  label: 'Ignore accel below',
                  value: _thresholds.minorAccelerationIgnoreThreshold,
                  min: 8,
                  max: 18,
                  unit: 'm/s²',
                  onChanged: (v) => _setThresholds(
                    _thresholds.copyWith(minorAccelerationIgnoreThreshold: v),
                  ),
                ),
                _thresholdSlider(
                  label: 'Ignore speed-drop below',
                  value: _thresholds.minorSpeedDropIgnoreThresholdKmh,
                  min: 1,
                  max: 12,
                  unit: 'km/h',
                  onChanged: (v) => _setThresholds(
                    _thresholds.copyWith(
                      minorSpeedDropIgnoreThresholdKmh: v,
                    ),
                  ),
                ),
                _thresholdSlider(
                  label: 'Ignore rotation below',
                  value: _thresholds.minorRotationIgnoreThreshold,
                  min: 0.5,
                  max: 4.5,
                  unit: 'rad/s',
                  onChanged: (v) => _setThresholds(
                    _thresholds.copyWith(minorRotationIgnoreThreshold: v),
                  ),
                ),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: _thresholdDirty ? _saveThresholds : null,
                        child: const Text('Save Tuning'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () =>
                            _setThresholds(const CrashThresholdConfig()),
                        child: const Text('Reset Defaults'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _header(
                        'Crash History',
                        subtitle: 'All incidents stored locally',
                      ),
                    ),
                    TextButton(
                      onPressed: _clearIncidentHistory,
                      child: const Text('Clear'),
                    ),
                  ],
                ),
                if (_incidents.isEmpty)
                  const Text('No incidents yet.')
                else
                  for (final item in _incidents.take(12)) ...[
                    Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${item.type.toUpperCase()} • Score ${item.score}',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item.occurredAt.toLocal().toIso8601String(),
                            style: const TextStyle(fontSize: 12),
                          ),
                          Text('Reason: ${item.reason}'),
                        ],
                      ),
                    ),
                  ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _header('Emergency Contacts'),
                _contactInput(0),
                _contactInput(1),
                _contactInput(2),
                FilledButton(
                  onPressed: _saveContacts,
                  child: const Text('Save Contacts'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _header('Simulation & Last Emergency'),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _simulateSos,
                        child: const Text('Simulate Score 30'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: _simulateFullEmergency,
                        child: const Text('Simulate Score 50'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(_lastEmergencySummary),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _header('Recent Logs'),
                if (_logs.isEmpty)
                  const Text('No logs yet.')
                else
                  for (final log in _logs.take(20)) ...[
                    Text(log, style: const TextStyle(fontSize: 12.5)),
                    const SizedBox(height: 5),
                  ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
