import 'dart:async';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';

class OmiBleService {
  BluetoothDevice? _device;
  StreamSubscription<List<int>>? _audioSubscription;
  StreamSubscription<BluetoothConnectionState>? _connectionSubscription;

  bool _isConnected = false;
  bool get isConnected => _isConnected;

  BluetoothDevice? get device => _device;

  void Function(List<int> audioBytes)? onAudioData;
  void Function(String status)? onStatusChanged;
  void Function(int batteryLevel)? onBatteryLevel;
  void Function()? onButtonPressed;

  static const String omiServiceUuid = '19b10000-e8f2-537e-4f6c-d104768a1214';
  static const String audioDataStreamUuid = '19b10001-e8f2-537e-4f6c-d104768a1214';
  static const String audioCodecUuid = '19b10002-e8f2-537e-4f6c-d104768a1214';
  static const String batteryServiceUuid = '0000180f-0000-1000-8000-00805f9b34fb';
  static const String batteryLevelUuid = '00002a19-0000-1000-8000-00805f9b34fb';
  static const String buttonServiceUuid = '23ba7924-0000-1000-7450-346eac492e92';
  static const String buttonTriggerUuid = '23ba7925-0000-1000-7450-346eac492e92';

  Stream<List<ScanResult>> startScan() {
    return FlutterBluePlus.scanResults;
  }

  Future<void> startScanning() async {
    onStatusChanged?.call('Scanning...');
    await FlutterBluePlus.startScan(
      timeout: const Duration(seconds: 15),
      androidUsesFineLocation: true,
    );
  }

  Future<void> stopScanning() async {
    await FlutterBluePlus.stopScan();
  }

  Future<bool> connectToDevice(BluetoothDevice device) async {
    _device = device;
    onStatusChanged?.call('Connecting to ${device.remoteId}...');

    try {
      _connectionSubscription = device.connectionState.listen((state) {
        if (state == BluetoothConnectionState.connected) {
          _isConnected = true;
          onStatusChanged?.call('Connected!');
          _discoverServices();
        } else if (state == BluetoothConnectionState.disconnected) {
          _isConnected = false;
          onStatusChanged?.call('Disconnected');
          _audioSubscription?.cancel();
        }
      });

      await device.connect(
        timeout: const Duration(seconds: 15),
        autoConnect: false,
      );
      return true;
    } catch (e) {
      onStatusChanged?.call('Connection failed: $e');
      return false;
    }
  }

  Future<void> _discoverServices() async {
    if (_device == null) return;
    try {
      final services = await _device!.discoverServices();
      onStatusChanged?.call('Services discovered: ${services.length}');

      for (final service in services) {
        if (service.serviceUuid.toString().toLowerCase() ==
            omiServiceUuid.toLowerCase()) {
          onStatusChanged?.call('Found OMI service');
          await _subscribeToAudio(service);
        }
        if (service.serviceUuid.toString().toLowerCase() ==
            batteryServiceUuid.toLowerCase()) {
          await _subscribeToBattery(service);
        }
        if (service.serviceUuid.toString().toLowerCase() ==
            buttonServiceUuid.toLowerCase()) {
          await _subscribeToButton(service);
        }
      }
    } catch (e) {
      onStatusChanged?.call('Service discovery failed: $e');
    }
  }

  Future<void> _subscribeToAudio(BluetoothService service) async {
    for (final char in service.characteristics) {
      if (char.characteristicUuid.toString().toLowerCase() ==
          audioDataStreamUuid.toLowerCase()) {
        if (char.properties.notify) {
          await char.setNotifyValue(true);
          _audioSubscription = char.onValueReceived.listen((value) {
            onAudioData?.call(value);
          });
          onStatusChanged?.call('Audio stream ready');
        }
      }
    }
  }

  Future<void> _subscribeToBattery(BluetoothService service) async {
    for (final char in service.characteristics) {
      if (char.characteristicUuid.toString().toLowerCase() ==
          batteryLevelUuid.toLowerCase()) {
        try {
          final value = await char.read();
          if (value.isNotEmpty) {
            onBatteryLevel?.call(value[0]);
          }
        } catch (_) {}
        if (char.properties.notify) {
          await char.setNotifyValue(true);
          char.onValueReceived.listen((value) {
            if (value.isNotEmpty) onBatteryLevel?.call(value[0]);
          });
        }
      }
    }
  }

  Future<void> _subscribeToButton(BluetoothService service) async {
    for (final char in service.characteristics) {
      if (char.characteristicUuid.toString().toLowerCase() ==
          buttonTriggerUuid.toLowerCase()) {
        if (char.properties.notify) {
          await char.setNotifyValue(true);
          char.onValueReceived.listen((value) {
            if (value.isNotEmpty) onButtonPressed?.call();
          });
        }
      }
    }
  }

  Future<void> disconnect() async {
    _audioSubscription?.cancel();
    _connectionSubscription?.cancel();
    await _device?.disconnect();
    _isConnected = false;
    _device = null;
  }

  void dispose() {
    disconnect();
  }
}
