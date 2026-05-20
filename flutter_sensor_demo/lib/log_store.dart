import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class MonitoringLogStore {
  static const String _storageKey = 'resqai_monitoring_logs_v1';
  static const int _maxLogEntries = 300;

  static Future<void> append(
    String message, {
    DateTime? timestamp,
    String level = 'info',
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final entries = await _readEntries(prefs);

    entries.insert(
      0,
      <String, String>{
        'at': (timestamp ?? DateTime.now()).toIso8601String(),
        'level': level,
        'message': message,
      },
    );

    if (entries.length > _maxLogEntries) {
      entries.removeRange(_maxLogEntries, entries.length);
    }

    await prefs.setString(_storageKey, jsonEncode(entries));
  }

  static Future<List<String>> loadFormatted({
    int limit = 80,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final entries = await _readEntries(prefs);

    final capped = entries.take(limit);
    return capped.map(_formatEntry).toList(growable: false);
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storageKey);
  }

  static Future<List<Map<String, String>>> _readEntries(
    SharedPreferences prefs,
  ) async {
    final raw = prefs.getString(_storageKey);
    if (raw == null || raw.isEmpty) {
      return <Map<String, String>>[];
    }

    final decoded = jsonDecode(raw);
    if (decoded is! List) {
      return <Map<String, String>>[];
    }

    final entries = <Map<String, String>>[];
    for (final item in decoded) {
      if (item is! Map) {
        continue;
      }

      final map = item.map((key, value) {
        return MapEntry(key.toString(), value?.toString() ?? '');
      });

      final at = map['at'] ?? '';
      final message = map['message'] ?? '';
      if (at.isEmpty || message.isEmpty) {
        continue;
      }

      entries.add(map);
    }

    return entries;
  }

  static String _formatEntry(Map<String, String> entry) {
    final timestamp = entry['at'] ?? '';
    final level = (entry['level'] ?? 'info').toUpperCase();
    final message = entry['message'] ?? '';
    return '$timestamp [$level] $message';
  }
}
