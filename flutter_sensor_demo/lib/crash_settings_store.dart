import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'crash_logic.dart';

class CrashSettingsStore {
  static const String _storageKey = 'resqai_crash_thresholds_v1';

  static Future<CrashThresholdConfig> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);
    if (raw == null || raw.isEmpty) {
      return const CrashThresholdConfig();
    }

    final dynamic decoded = jsonDecode(raw);
    if (decoded is! Map) {
      return const CrashThresholdConfig();
    }

    return CrashThresholdConfig.fromMap(
      decoded.map((key, value) => MapEntry(key.toString(), value)),
    );
  }

  static Future<void> save(CrashThresholdConfig config) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _storageKey,
      jsonEncode(config.toMap()),
    );
  }
}
