import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class IncidentRecord {
  const IncidentRecord({
    required this.id,
    required this.occurredAt,
    required this.type,
    required this.reason,
    required this.score,
    required this.latitude,
    required this.longitude,
    this.mapsLink,
    this.details,
  });

  final String id;
  final DateTime occurredAt;
  final String type;
  final String reason;
  final int score;
  final double latitude;
  final double longitude;
  final String? mapsLink;
  final String? details;

  Map<String, dynamic> toMap() {
    return <String, dynamic>{
      'id': id,
      'occurredAt': occurredAt.toIso8601String(),
      'type': type,
      'reason': reason,
      'score': score,
      'latitude': latitude,
      'longitude': longitude,
      'mapsLink': mapsLink,
      'details': details,
    };
  }

  factory IncidentRecord.fromMap(Map<String, dynamic> map) {
    return IncidentRecord(
      id: (map['id'] as String?)?.trim().isNotEmpty == true
          ? (map['id'] as String)
          : DateTime.now().millisecondsSinceEpoch.toString(),
      occurredAt: DateTime.tryParse((map['occurredAt'] as String?) ?? '') ??
          DateTime.now(),
      type: (map['type'] as String?) ?? 'incident',
      reason: (map['reason'] as String?) ?? 'unspecified',
      score: _asInt(map['score'], fallback: 0),
      latitude: _asDouble(map['latitude'], fallback: 0.0),
      longitude: _asDouble(map['longitude'], fallback: 0.0),
      mapsLink: (map['mapsLink'] as String?)?.trim().isNotEmpty == true
          ? (map['mapsLink'] as String)
          : null,
      details: (map['details'] as String?)?.trim().isNotEmpty == true
          ? (map['details'] as String)
          : null,
    );
  }

  static int _asInt(dynamic value, {required int fallback}) {
    if (value is num) {
      return value.toInt();
    }
    return int.tryParse('$value') ?? fallback;
  }

  static double _asDouble(dynamic value, {required double fallback}) {
    if (value is num) {
      return value.toDouble();
    }
    return double.tryParse('$value') ?? fallback;
  }
}

class IncidentHistoryStore {
  static const String _storageKey = 'resqai_incident_history_v1';
  static const int _maxEntries = 150;

  static Future<List<IncidentRecord>> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_storageKey);

    if (raw == null || raw.isEmpty) {
      return <IncidentRecord>[];
    }

    final dynamic decoded = jsonDecode(raw);
    if (decoded is! List) {
      return <IncidentRecord>[];
    }

    final records = <IncidentRecord>[];
    for (final item in decoded) {
      if (item is! Map) {
        continue;
      }
      records.add(
        IncidentRecord.fromMap(
          item.map((key, value) => MapEntry(key.toString(), value)),
        ),
      );
    }

    records.sort((a, b) => b.occurredAt.compareTo(a.occurredAt));
    return records;
  }

  static Future<void> append(IncidentRecord record) async {
    final existing = await load();
    existing.insert(0, record);

    if (existing.length > _maxEntries) {
      existing.removeRange(_maxEntries, existing.length);
    }

    await _save(existing);
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_storageKey);
  }

  static Future<void> _save(List<IncidentRecord> records) async {
    final prefs = await SharedPreferences.getInstance();
    final encoded = jsonEncode(
      records.map((record) => record.toMap()).toList(growable: false),
    );
    await prefs.setString(_storageKey, encoded);
  }
}
