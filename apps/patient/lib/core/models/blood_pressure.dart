import 'measurement.dart';

/// Blood pressure pair (systolic + diastolic)
class BloodPressureReading {
  final DateTime timestamp;
  final int systolic;
  final int diastolic;
  final String source;

  BloodPressureReading({
    required this.timestamp,
    required this.systolic,
    required this.diastolic,
    this.source = 'manual',
  });

  factory BloodPressureReading.fromJson(Map<String, dynamic> json) {
    return BloodPressureReading(
      timestamp: DateTime.parse(json['timestamp'] as String),
      systolic: (json['systolic'] as num).toInt(),
      diastolic: (json['diastolic'] as num).toInt(),
      source: json['source'] as String? ?? 'manual',
    );
  }

  /// Blood pressure category based on AHA guidelines
  /// https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings
  String get category {
    // Check from highest severity to lowest
    if (systolic > 180 || diastolic > 120) return 'Crisis';
    if (systolic >= 140 || diastolic >= 90) return 'High (Stage 2)';
    if (systolic >= 130 || diastolic >= 80) return 'High (Stage 1)';
    if (systolic >= 120 && diastolic < 80) return 'Elevated';
    return 'Normal';
  }

  /// Severity level for color coding (0=normal, 1=elevated, 2=stage1, 3=stage2, 4=crisis)
  int get severityLevel {
    if (systolic > 180 || diastolic > 120) return 4;
    if (systolic >= 140 || diastolic >= 90) return 3;
    if (systolic >= 130 || diastolic >= 80) return 2;
    if (systolic >= 120 && diastolic < 80) return 1;
    return 0;
  }

  /// Whether this reading indicates high blood pressure
  bool get isElevated => systolic >= 130 || diastolic >= 80;
}

/// Response from POST /patient/measurements/blood-pressure
class CreateBPResponse {
  final Measurement systolic;
  final Measurement diastolic;
  final bool isDuplicate;

  CreateBPResponse({
    required this.systolic,
    required this.diastolic,
    this.isDuplicate = false,
  });

  factory CreateBPResponse.fromJson(Map<String, dynamic> json) {
    final measurements = json['measurements'] as Map<String, dynamic>;
    return CreateBPResponse(
      systolic: Measurement.fromJson(measurements['systolic'] as Map<String, dynamic>),
      diastolic: Measurement.fromJson(measurements['diastolic'] as Map<String, dynamic>),
      isDuplicate: json['isDuplicate'] as bool? ?? false,
    );
  }
}

/// Response from GET /patient/charts/blood-pressure
class BPChartData {
  final String unit;
  final List<BloodPressureReading> points;
  final DateTime from;
  final DateTime to;
  final BPChartMeta meta;

  BPChartData({
    required this.unit,
    required this.points,
    required this.from,
    required this.to,
    required this.meta,
  });

  factory BPChartData.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>;
    final range = data['range'] as Map<String, dynamic>;
    final pointsList = data['points'] as List<dynamic>;

    return BPChartData(
      unit: data['unit'] as String,
      points: pointsList
          .map((p) => BloodPressureReading.fromJson(p as Map<String, dynamic>))
          .toList(),
      from: DateTime.parse(range['from'] as String),
      to: DateTime.parse(range['to'] as String),
      meta: BPChartMeta.fromJson(data['meta'] as Map<String, dynamic>),
    );
  }
}

class BPChartMeta {
  final String timezone;
  final int pairedCount;
  final int unpairedSystolicCount;
  final int unpairedDiastolicCount;

  BPChartMeta({
    required this.timezone,
    required this.pairedCount,
    required this.unpairedSystolicCount,
    required this.unpairedDiastolicCount,
  });

  factory BPChartMeta.fromJson(Map<String, dynamic> json) {
    return BPChartMeta(
      timezone: json['timezone'] as String? ?? 'UTC',
      pairedCount: json['pairedCount'] as int? ?? 0,
      unpairedSystolicCount: json['unpairedSystolicCount'] as int? ?? 0,
      unpairedDiastolicCount: json['unpairedDiastolicCount'] as int? ?? 0,
    );
  }
}
