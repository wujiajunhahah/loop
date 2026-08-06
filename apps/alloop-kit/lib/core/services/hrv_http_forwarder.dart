import 'dart:convert';

import 'package:alloop_blue_lite/alloop_blue_lite.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;

class HrvForwardResult {
  const HrvForwardResult({
    required this.accepted,
    required this.statusCode,
    required this.message,
  });

  final bool accepted;
  final int statusCode;
  final String message;
}

/// Sends the latest valid HRV measurement from the official Alloop SDK to the
/// stable Pigeon backend contract. It never infers emotion and never substitutes
/// heart rate for HRV.
class HrvHttpForwarder {
  HrvHttpForwarder({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  String get endpoint => dotenv.env['PIGEON_HRV_URL']?.trim() ?? '';
  String get backendDeviceId =>
      dotenv.env['PIGEON_HRV_DEVICE_ID']?.trim() ?? 'alloop-demo-001';
  String get deviceToken =>
      dotenv.env['PIGEON_HRV_DEVICE_TOKEN']?.trim() ?? '';

  bool get isConfigured => endpoint.isNotEmpty && deviceToken.isNotEmpty;

  Future<HrvForwardResult> sendLatest({
    required String ringDeviceId,
    required MeasurementRecord record,
  }) async {
    if (!isConfigured) {
      return const HrvForwardResult(
        accepted: false,
        statusCode: 0,
        message: 'PIGEON_HRV_URL or PIGEON_HRV_DEVICE_TOKEN is missing',
      );
    }
    if (record.hrv <= 0 || !record.hrSuccess) {
      return const HrvForwardResult(
        accepted: false,
        statusCode: 0,
        message: 'The latest Alloop measurement does not contain valid HRV',
      );
    }

    final normalizedRingId = ringDeviceId.replaceAll(
      RegExp(r'[^a-zA-Z0-9_-]'),
      '-',
    );
    final safeRingId = normalizedRingId.length > 72
        ? normalizedRingId.substring(0, 72)
        : normalizedRingId;
    final payload = <String, Object>{
      'reading_id': 'alloop-$safeRingId-${record.unixSec}',
      'device_id': backendDeviceId,
      'measured_at': DateTime.fromMillisecondsSinceEpoch(
        record.unixSec * 1000,
        isUtc: true,
      ).toIso8601String(),
      'value': record.hrv,
      'quality': 1.0,
    };

    Object? lastError;
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        final response = await _client
            .post(
              Uri.parse(endpoint),
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'X-Device-Token': deviceToken,
              },
              body: jsonEncode(payload),
            )
            .timeout(const Duration(seconds: 10));
        if (response.statusCode >= 200 && response.statusCode < 300) {
          return HrvForwardResult(
            accepted: true,
            statusCode: response.statusCode,
            message: response.body,
          );
        }
        lastError = 'HTTP ${response.statusCode}: ${response.body}';
      } catch (error) {
        lastError = error;
      }
      if (attempt == 0) {
        await Future<void>.delayed(const Duration(milliseconds: 800));
      }
    }

    return HrvForwardResult(
      accepted: false,
      statusCode: 0,
      message: lastError?.toString() ?? 'Unknown HRV forwarding error',
    );
  }

  void close() => _client.close();
}
