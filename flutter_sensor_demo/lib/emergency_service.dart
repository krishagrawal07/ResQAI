import 'dart:convert';
import 'dart:math' as math;

import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:telephony/telephony.dart';
import 'package:url_launcher/url_launcher.dart';

class EmergencyContact {
  const EmergencyContact({
    required this.name,
    required this.phone,
    this.isPrimary = false,
  });

  final String name;
  final String phone;
  final bool isPrimary;

  EmergencyContact copyWith({
    String? name,
    String? phone,
    bool? isPrimary,
  }) {
    return EmergencyContact(
      name: name ?? this.name,
      phone: phone ?? this.phone,
      isPrimary: isPrimary ?? this.isPrimary,
    );
  }

  Map<String, dynamic> toMap() {
    return <String, dynamic>{
      'name': name,
      'phone': phone,
      'isPrimary': isPrimary,
    };
  }

  factory EmergencyContact.fromMap(Map<String, dynamic> map) {
    return EmergencyContact(
      name: (map['name'] as String?)?.trim().isNotEmpty == true
          ? (map['name'] as String).trim()
          : 'Emergency Contact',
      phone: (map['phone'] as String?)?.trim() ?? '',
      isPrimary: map['isPrimary'] == true,
    );
  }
}

class EmergencyDispatchResult {
  const EmergencyDispatchResult({
    required this.mapsLink,
    required this.smsSummary,
    required this.callSummary,
    required this.latitude,
    required this.longitude,
  });

  final String mapsLink;
  final String smsSummary;
  final String callSummary;
  final double latitude;
  final double longitude;

  Map<String, dynamic> toMap() {
    return <String, dynamic>{
      'mapsLink': mapsLink,
      'smsSummary': smsSummary,
      'callSummary': callSummary,
      'latitude': latitude,
      'longitude': longitude,
    };
  }
}

class EmergencyService {
  static const String _contactsStorageKey = 'resqai_emergency_contacts_v1';
  static const int _maxSmsRetries = 2;
  static const int _maxParallelSmsWorkers = 3;
  final Telephony _telephony = Telephony.instance;

  Future<List<EmergencyContact>> loadContacts() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_contactsStorageKey);
    if (raw == null || raw.isEmpty) {
      return <EmergencyContact>[];
    }

    final dynamic decoded = jsonDecode(raw);
    if (decoded is! List) {
      return <EmergencyContact>[];
    }

    final contacts = <EmergencyContact>[];
    for (final item in decoded) {
      if (item is! Map) {
        continue;
      }

      final contact = EmergencyContact.fromMap(
        item.map((key, value) => MapEntry(key.toString(), value)),
      );
      if (contact.phone.isEmpty) {
        continue;
      }
      contacts.add(contact);
    }

    if (contacts.isNotEmpty && !contacts.any((c) => c.isPrimary)) {
      contacts[0] = contacts[0].copyWith(isPrimary: true);
    }

    return contacts;
  }

  Future<void> saveContacts(List<EmergencyContact> contacts) async {
    final prefs = await SharedPreferences.getInstance();
    final encoded = jsonEncode(contacts.map((c) => c.toMap()).toList());
    await prefs.setString(_contactsStorageKey, encoded);
  }

  String buildGoogleMapsLink(double latitude, double longitude) {
    return 'https://maps.google.com/?q='
        '${latitude.toStringAsFixed(6)},${longitude.toStringAsFixed(6)}';
  }

  Future<EmergencyDispatchResult> triggerEmergency({
    required DateTime triggeredAt,
    required double latitude,
    required double longitude,
    required int score,
    required List<EmergencyContact> contacts,
  }) async {
    final resolvedPosition = await _fetchLatestAccurateLocation(
      fallbackLatitude: latitude,
      fallbackLongitude: longitude,
    );

    final resolvedLatitude = resolvedPosition.$1;
    final resolvedLongitude = resolvedPosition.$2;

    final mapsLink = buildGoogleMapsLink(resolvedLatitude, resolvedLongitude);
    final message = _buildEmergencyMessage(
      triggeredAt: triggeredAt,
      score: score,
      mapsLink: mapsLink,
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
    );

    // Start call and SMS pipeline together for faster emergency outreach.
    final smsSummaryFuture = _sendSmsToContactsFast(
      contacts: contacts,
      message: message,
    );
    final callSummaryFuture = _startPhoneCall(contacts);

    final smsSummary = await smsSummaryFuture;
    final callSummary = await callSummaryFuture;

    return EmergencyDispatchResult(
      mapsLink: mapsLink,
      smsSummary: smsSummary,
      callSummary: callSummary,
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
    );
  }

  String _buildEmergencyMessage({
    required DateTime triggeredAt,
    required int score,
    required String mapsLink,
    required double latitude,
    required double longitude,
  }) {
    return <String>[
      '\u{1F6A8} Accident detected!',
      'Location: $mapsLink',
      'Time: ${triggeredAt.toIso8601String()}',
      'Score: $score',
      'Coordinates: ${latitude.toStringAsFixed(6)}, ${longitude.toStringAsFixed(6)}',
    ].join('\n');
  }

  Future<String> _sendSmsToContactsFast({
    required List<EmergencyContact> contacts,
    required String message,
  }) async {
    final uniqueContacts = _normalizeContacts(contacts);
    if (uniqueContacts.isEmpty) {
      return 'No contacts saved. SMS not sent.';
    }

    final permission = await Permission.sms.status;
    if (!permission.isGranted) {
      return 'SMS permission denied. No SMS sent.';
    }

    var sentCount = 0;
    final retryCounts = <String, int>{};
    final failedPhones = <String, String>{};

    var cursor = 0;
    final workerCount = uniqueContacts.length < _maxParallelSmsWorkers
        ? uniqueContacts.length
        : _maxParallelSmsWorkers;

    Future<void> worker() async {
      while (true) {
        if (cursor >= uniqueContacts.length) {
          break;
        }

        final index = cursor;
        cursor += 1;

        final contact = uniqueContacts[index];
        final phone = _sanitizePhone(contact.phone);
        if (phone.isEmpty) {
          continue;
        }

        try {
          final attempts = await _sendSmsWithRetry(
            phone: phone,
            message: message,
            maxRetries: _maxSmsRetries,
          );
          retryCounts[phone] = attempts - 1;
          sentCount += 1;
        } catch (error) {
          failedPhones[phone] = '$error';
        }
      }
    }

    await Future.wait(
      List<Future<void>>.generate(
        workerCount <= 0 ? 1 : workerCount,
        (_) => worker(),
      ),
    );

    if (failedPhones.isEmpty) {
      final retriesUsed = retryCounts.values.fold<int>(
        0,
        (previousValue, element) => previousValue + element,
      );
      return 'SMS sent to $sentCount contact(s) quickly. Retries used: $retriesUsed.';
    }

    final failedSummary = failedPhones.entries
        .map((entry) => '${entry.key} (${entry.value})')
        .join(', ');
    return 'SMS sent to $sentCount contact(s); failed for: $failedSummary.';
  }

  Future<int> _sendSmsWithRetry({
    required String phone,
    required String message,
    required int maxRetries,
  }) async {
    var attempt = 0;
    while (attempt <= maxRetries) {
      attempt += 1;
      try {
        await _telephony.sendSms(
          to: phone,
          message: message,
        );
        return attempt;
      } catch (_) {
        if (attempt > maxRetries) {
          rethrow;
        }
        await Future<void>.delayed(
          Duration(milliseconds: 350 * attempt),
        );
      }
    }

    throw StateError('SMS retry loop ended unexpectedly.');
  }

  Future<String> _startPhoneCall(List<EmergencyContact> contacts) async {
    final primary = _resolvePrimaryContact(contacts);
    if (primary == null) {
      return 'No primary contact available for call.';
    }
    final normalizedPhone = _sanitizePhone(primary.phone);
    if (normalizedPhone.isEmpty) {
      return 'Primary contact phone is invalid. Call not started.';
    }

    final permission = await Permission.phone.status;
    if (!permission.isGranted) {
      return 'CALL_PHONE permission denied. Call not started.';
    }

    try {
      final launchUri = Uri(
        scheme: 'tel',
        path: normalizedPhone,
      );
      final launched = await launchUrl(
        launchUri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        return 'Could not launch phone call for $normalizedPhone.';
      }
      return 'Call started to $normalizedPhone.';
    } catch (error) {
      return 'Call failed: $error';
    }
  }

  Future<(double, double)> _fetchLatestAccurateLocation({
    required double fallbackLatitude,
    required double fallbackLongitude,
  }) async {
    final hasFallbackCoordinates =
        fallbackLatitude.abs() > 0.000001 || fallbackLongitude.abs() > 0.000001;

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return (fallbackLatitude, fallbackLongitude);
      }

      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return (fallbackLatitude, fallbackLongitude);
      }

      final current = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.bestForNavigation,
        timeLimit: const Duration(seconds: 12),
      );

      return (current.latitude, current.longitude);
    } catch (_) {
      try {
        final lastKnown = await Geolocator.getLastKnownPosition();
        if (lastKnown != null) {
          return (lastKnown.latitude, lastKnown.longitude);
        }
      } catch (_) {
        // Ignore and continue to fallback.
      }

      if (hasFallbackCoordinates) {
        return (fallbackLatitude, fallbackLongitude);
      }
    }

    // Keep a deterministic fallback even if everything else fails.
    return (
      math.max(math.min(fallbackLatitude, 90.0), -90.0),
      math.max(math.min(fallbackLongitude, 180.0), -180.0),
    );
  }

  List<EmergencyContact> _normalizeContacts(List<EmergencyContact> contacts) {
    final seen = <String>{};
    final normalized = <EmergencyContact>[];

    for (final contact in contacts) {
      final phone = _sanitizePhone(contact.phone);
      if (phone.isEmpty || seen.contains(phone)) {
        continue;
      }
      seen.add(phone);
      normalized.add(contact.copyWith(phone: phone));
    }

    return normalized;
  }

  String _sanitizePhone(String phone) {
    return phone.replaceAll(RegExp(r'[^0-9+]'), '');
  }

  EmergencyContact? _resolvePrimaryContact(List<EmergencyContact> contacts) {
    for (final contact in contacts) {
      if (contact.isPrimary && contact.phone.isNotEmpty) {
        return contact;
      }
    }

    for (final contact in contacts) {
      if (contact.phone.isNotEmpty) {
        return contact;
      }
    }

    return null;
  }
}
