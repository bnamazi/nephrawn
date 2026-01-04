// Dashboard response models

/// Latest reading value with timestamp
class LatestReading {
  final double value;
  final DateTime timestamp;

  LatestReading({
    required this.value,
    required this.timestamp,
  });

  factory LatestReading.fromJson(Map<String, dynamic> json) {
    return LatestReading(
      value: _parseDouble(json['value']),
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }

  static double _parseDouble(dynamic value) {
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.parse(value);
    throw FormatException('Cannot parse $value as double');
  }
}

/// Statistics for a measurement type
class MeasurementStats {
  final double min;
  final double max;
  final double avg;
  final int count;

  MeasurementStats({
    required this.min,
    required this.max,
    required this.avg,
    required this.count,
  });

  factory MeasurementStats.fromJson(Map<String, dynamic> json) {
    return MeasurementStats(
      min: LatestReading._parseDouble(json['min']),
      max: LatestReading._parseDouble(json['max']),
      avg: LatestReading._parseDouble(json['avg']),
      count: json['count'] as int,
    );
  }
}

/// Trend direction
enum TrendDirection {
  increasing,
  decreasing,
  stable,
  insufficientData;

  static TrendDirection fromString(String value) {
    switch (value) {
      case 'increasing':
        return TrendDirection.increasing;
      case 'decreasing':
        return TrendDirection.decreasing;
      case 'stable':
        return TrendDirection.stable;
      case 'insufficient_data':
      default:
        return TrendDirection.insufficientData;
    }
  }
}

/// Summary for a single measurement type
class MeasurementSummary {
  final String type;
  final String unit;
  final String displayUnit;
  final LatestReading? latest;
  final MeasurementStats? stats;
  final TrendDirection trend;

  MeasurementSummary({
    required this.type,
    required this.unit,
    required this.displayUnit,
    this.latest,
    this.stats,
    required this.trend,
  });

  factory MeasurementSummary.fromJson(Map<String, dynamic> json) {
    return MeasurementSummary(
      type: json['type'] as String,
      unit: json['unit'] as String,
      displayUnit: json['displayUnit'] as String? ?? json['unit'] as String,
      latest: json['latest'] != null
          ? LatestReading.fromJson(json['latest'] as Map<String, dynamic>)
          : null,
      stats: json['stats'] != null
          ? MeasurementStats.fromJson(json['stats'] as Map<String, dynamic>)
          : null,
      trend: TrendDirection.fromString(json['trend'] as String? ?? 'insufficient_data'),
    );
  }

  /// Get display value (backend already returns in display unit)
  double? get displayValue {
    if (latest == null) return null;
    return latest!.value;
  }
}

/// Blood pressure summary with systolic and diastolic
class BloodPressureSummary {
  final MeasurementSummary systolic;
  final MeasurementSummary diastolic;

  BloodPressureSummary({
    required this.systolic,
    required this.diastolic,
  });

  factory BloodPressureSummary.fromJson(Map<String, dynamic> json) {
    return BloodPressureSummary(
      systolic: MeasurementSummary.fromJson(json['systolic'] as Map<String, dynamic>),
      diastolic: MeasurementSummary.fromJson(json['diastolic'] as Map<String, dynamic>),
    );
  }

  /// Combined trend (use systolic as primary)
  TrendDirection get trend => systolic.trend;

  /// Check if we have data
  bool get hasData => systolic.latest != null && diastolic.latest != null;
}

/// Dashboard metadata
class DashboardMeta {
  final String timezone;
  final DateTime generatedAt;

  DashboardMeta({
    required this.timezone,
    required this.generatedAt,
  });

  factory DashboardMeta.fromJson(Map<String, dynamic> json) {
    return DashboardMeta(
      timezone: json['timezone'] as String? ?? 'UTC',
      generatedAt: DateTime.parse(json['generatedAt'] as String),
    );
  }
}

/// Complete dashboard data
class DashboardData {
  final MeasurementSummary weight;
  final BloodPressureSummary bloodPressure;
  final MeasurementSummary spo2;
  final MeasurementSummary heartRate;
  final DashboardMeta meta;

  DashboardData({
    required this.weight,
    required this.bloodPressure,
    required this.spo2,
    required this.heartRate,
    required this.meta,
  });

  factory DashboardData.fromJson(Map<String, dynamic> json) {
    final dashboard = json['dashboard'] as Map<String, dynamic>;
    return DashboardData(
      weight: MeasurementSummary.fromJson(dashboard['weight'] as Map<String, dynamic>),
      bloodPressure: BloodPressureSummary.fromJson(dashboard['bloodPressure'] as Map<String, dynamic>),
      spo2: MeasurementSummary.fromJson(dashboard['spo2'] as Map<String, dynamic>),
      heartRate: MeasurementSummary.fromJson(dashboard['heartRate'] as Map<String, dynamic>),
      meta: DashboardMeta.fromJson(dashboard['meta'] as Map<String, dynamic>),
    );
  }
}
