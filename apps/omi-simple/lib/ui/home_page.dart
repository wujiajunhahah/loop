import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import '../omi_ble_service.dart';
import '../voice_forwarder.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final OmiBleService _ble = OmiBleService();
  late final AudioForwarder _forwarder;

  String _status = 'Ready';
  int _totalBytes = 0;
  bool _bleConnected = false;
  int _batteryLevel = -1;
  List<ScanResult> _scanResults = [];
  bool _isScanning = false;
  StreamSubscription? _scanSub;

  @override
  void initState() {
    super.initState();
    _setupCallbacks();
    _requestPermissions();
  }

  void _setupCallbacks() {
    _ble.onStatusChanged = (s) => setState(() => _status = s);
    _ble.onAudioData = _onAudioData;
    _ble.onBatteryLevel = (b) => setState(() => _batteryLevel = b);
    _ble.onButtonPressed = () {};

    _forwarder = AudioForwarder(
      onDataReceived: (n) => setState(() => _totalBytes = n),
      onStatusChanged: (s) => setState(() => _status = s),
    );
  }

  void _onAudioData(List<int> bytes) {
    _forwarder.addAudioBytes(bytes);
  }

  Future<void> _requestPermissions() async {
    await [
      Permission.bluetooth,
      Permission.bluetoothScan,
      Permission.bluetoothConnect,
      Permission.location,
    ].request();
  }

  Future<void> _startScan() async {
    setState(() {
      _isScanning = true;
      _scanResults = [];
    });
    _scanSub = FlutterBluePlus.scanResults.listen((results) {
      setState(() => _scanResults = results);
    });
    await _ble.startScanning();
  }

  Future<void> _stopScan() async {
    setState(() => _isScanning = false);
    _scanSub?.cancel();
    await _ble.stopScanning();
  }

  Future<void> _connectToDevice(BluetoothDevice device) async {
    _stopScan();
    final ok = await _ble.connectToDevice(device);
    setState(() => _bleConnected = ok);
    if (ok) {
      _totalBytes = 0;
      _forwarder.startSession();
    }
  }

  @override
  void dispose() {
    _scanSub?.cancel();
    _ble.dispose();
    _forwarder.dispose();
    super.dispose();
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('OMI Simple'),
        actions: [
          if (_batteryLevel >= 0)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Chip(
                avatar: const Icon(Icons.battery_full, size: 18),
                label: Text('$_batteryLevel%'),
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          _buildStatusBar(),
          if (!_bleConnected) _buildBleSection(),
          if (_bleConnected) _buildAudioSection(),
        ],
      ),
    );
  }

  Widget _buildStatusBar() {
    Color color;
    IconData icon;
    if (_bleConnected) {
      color = Colors.green;
      icon = Icons.bluetooth_connected;
    } else if (_isScanning) {
      color = Colors.orange;
      icon = Icons.bluetooth_searching;
    } else {
      color = Colors.grey;
      icon = Icons.bluetooth_disabled;
    }
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: color.withAlpha(40),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _status,
              style: TextStyle(color: color, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBleSection() {
    return Expanded(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                ElevatedButton.icon(
                  onPressed: _isScanning ? _stopScan : _startScan,
                  icon: Icon(_isScanning ? Icons.stop : Icons.search),
                  label: Text(_isScanning ? 'Stop' : 'Scan OMI'),
                ),
                const SizedBox(width: 12),
                if (_isScanning)
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: _scanResults.length,
              itemBuilder: (context, i) {
                final r = _scanResults[i];
                final name = r.device.advName.isNotEmpty
                    ? r.device.advName
                    : r.device.remoteId.str;
                final isOmi = r.advertisementData.serviceUuids
                    .any((u) => u.toString().toLowerCase() ==
                        '19b10000-e8f2-537e-4f6c-d104768a1214');
                return ListTile(
                  leading: Icon(
                    isOmi ? Icons.headset_mic : Icons.devices,
                    color: isOmi ? Colors.green : Colors.grey,
                  ),
                  title: Row(
                    children: [
                      Text(name),
                      if (isOmi) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.green,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text('OMI',
                              style: TextStyle(fontSize: 10, color: Colors.white)),
                        ),
                      ],
                    ],
                  ),
                  subtitle: Text('${r.device.remoteId.str}  RSSI: ${r.rssi}'),
                  trailing: ElevatedButton(
                    onPressed: () => _connectToDevice(r.device),
                    child: const Text('Connect'),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAudioSection() {
    return Expanded(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.bluetooth_connected, size: 64, color: Colors.green),
            const SizedBox(height: 16),
            const Text(
              'OMI Connected',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'Audio data received: ${_formatBytes(_totalBytes)}',
              style: const TextStyle(fontSize: 16),
            ),
            const SizedBox(height: 4),
            Text(
              _status,
              style: TextStyle(fontSize: 13, color: Colors.white.withAlpha(150)),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: 64,
              height: 64,
              child: FloatingActionButton(
                heroTag: 'disconnect',
                onPressed: () {
                  _ble.disconnect();
                  setState(() {
                    _bleConnected = false;
                    _totalBytes = 0;
                  });
                },
                backgroundColor: Colors.red.withAlpha(150),
                child: const Icon(Icons.bluetooth_disabled, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}