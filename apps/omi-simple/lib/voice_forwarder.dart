import 'dart:async';
import 'dart:typed_data';
import 'package:http/http.dart' as http;

class AudioForwarder {
  static const String serverUrl = String.fromEnvironment(
    'VOICE_DIARY_URL',
    defaultValue: 'http://192.168.252.151:8010/api/conversation/voice-diary',
  );

  final List<int> _buffer = [];
  Timer? _flushTimer;
  String? _sessionId;

  final void Function(int totalBytes)? onDataReceived;
  final void Function(String status)? onStatusChanged;

  AudioForwarder({this.onDataReceived, this.onStatusChanged});

  void startSession() {
    _sessionId = DateTime.now().millisecondsSinceEpoch.toRadixString(36);
    _buffer.clear();
    _startFlushTimer();
  }

  void _startFlushTimer() {
    _flushTimer?.cancel();
    _flushTimer = Timer.periodic(const Duration(seconds: 5), (_) => _flushBuffer());
  }

  void addAudioBytes(List<int> bytes) {
    _buffer.addAll(bytes);
    onDataReceived?.call(_buffer.length);
  }

  Future<void> _flushBuffer() async {
    if (_buffer.isEmpty || _sessionId == null) return;
    final data = Uint8List.fromList(_buffer);
    _buffer.clear();
    await _sendToServer(data);
  }

  Future<void> flushNow() async {
    _flushTimer?.cancel();
    await _flushBuffer();
    _startFlushTimer();
  }

  Future<void> _sendToServer(Uint8List audioData) async {
    try {
      onStatusChanged?.call('Sending ${audioData.length} bytes...');
      final response = await http.post(
        Uri.parse(serverUrl),
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Session-Id': _sessionId ?? '',
          'X-Audio-Format': 'opus',
          'X-Timestamp': DateTime.now().toIso8601String(),
          'X-Source': 'omi_simple',
        },
        body: audioData,
      ).timeout(const Duration(seconds: 15));
      if (response.statusCode == 200) {
        onStatusChanged?.call('Sent ${audioData.length} bytes OK');
      } else {
        onStatusChanged?.call('Server $response.statusCode');
      }
    } catch (e) {
      onStatusChanged?.call('Send failed: $e');
    }
  }

  void dispose() {
    _flushTimer?.cancel();
    flushNow();
  }
}
