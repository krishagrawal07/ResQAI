import 'dart:async';
import 'dart:collection';
import 'dart:math' as math;

import 'package:sensors_plus/sensors_plus.dart';

class SensorTelemetry {
  const SensorTelemetry({
    required this.accelerationMagnitude,
    required this.rotationMagnitude,
    required this.timestamp,
  });

  final double accelerationMagnitude;
  final double rotationMagnitude;
  final DateTime timestamp;
}

class SensorService {
  SensorService({
    this.smoothingWindow = 4,
  });

  final int smoothingWindow;

  StreamSubscription<AccelerometerEvent>? _accelerometerSubscription;
  StreamSubscription<GyroscopeEvent>? _gyroscopeSubscription;

  final ListQueue<double> _accelerationSamples = ListQueue<double>();
  final ListQueue<double> _rotationSamples = ListQueue<double>();

  double _latestAccelerationMagnitude = 0.0;
  double _latestRotationMagnitude = 0.0;

  Future<void> start({
    required void Function(SensorTelemetry telemetry) onUpdate,
    required void Function(String message) onError,
  }) async {
    _accelerometerSubscription = accelerometerEventStream(
      samplingPeriod: const Duration(milliseconds: 100),
    ).listen(
      (event) {
        final magnitude = _vectorMagnitude(event.x, event.y, event.z);
        _latestAccelerationMagnitude =
            _averageWithRollingWindow(_accelerationSamples, magnitude);
        onUpdate(
          SensorTelemetry(
            accelerationMagnitude: _latestAccelerationMagnitude,
            rotationMagnitude: _latestRotationMagnitude,
            timestamp: DateTime.now(),
          ),
        );
      },
      onError: (Object error) {
        onError('Accelerometer stream failed: $error');
      },
      cancelOnError: false,
    );

    _gyroscopeSubscription = gyroscopeEventStream(
      samplingPeriod: const Duration(milliseconds: 100),
    ).listen(
      (event) {
        final magnitude = _vectorMagnitude(event.x, event.y, event.z);
        _latestRotationMagnitude =
            _averageWithRollingWindow(_rotationSamples, magnitude);
        onUpdate(
          SensorTelemetry(
            accelerationMagnitude: _latestAccelerationMagnitude,
            rotationMagnitude: _latestRotationMagnitude,
            timestamp: DateTime.now(),
          ),
        );
      },
      onError: (Object error) {
        onError('Gyroscope stream failed: $error');
      },
      cancelOnError: false,
    );
  }

  Future<void> stop() async {
    await _accelerometerSubscription?.cancel();
    await _gyroscopeSubscription?.cancel();
    _accelerometerSubscription = null;
    _gyroscopeSubscription = null;
    _accelerationSamples.clear();
    _rotationSamples.clear();
  }

  double _vectorMagnitude(double x, double y, double z) {
    return math.sqrt((x * x) + (y * y) + (z * z));
  }

  double _averageWithRollingWindow(ListQueue<double> window, double value) {
    window.addLast(value);
    while (window.length > smoothingWindow) {
      window.removeFirst();
    }

    if (window.isEmpty) {
      return value;
    }

    var sum = 0.0;
    for (final sample in window) {
      sum += sample;
    }
    return sum / window.length;
  }
}
