/// Measurement model
class Measurement {
  final String id;
  final String patientId;
  final DateTime timestamp;
  final String type;
  final double value;
  final String unit;
  final String? inputUnit;
  final String source;
  final DateTime createdAt;

  Measurement({
    required this.id,
    required this.patientId,
    required this.timestamp,
    required this.type,
    required this.value,
    required this.unit,
    this.inputUnit,
    required this.source,
    required this.createdAt,
  });

  factory Measurement.fromJson(Map<String, dynamic> json) {
    return Measurement(
      id: json['id'] as String,
      patientId: json['patientId'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      type: json['type'] as String,
      value: _parseDouble(json['value']),
      unit: json['unit'] as String,
      inputUnit: json['inputUnit'] as String?,
      source: json['source'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  /// Parse value as double (backend may return string or number)
  static double _parseDouble(dynamic value) {
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.parse(value);
    throw FormatException('Cannot parse $value as double');
  }

  /// Display value in lbs (for weight)
  double get displayValue {
    if (type == 'WEIGHT' && unit == 'kg') {
      // Convert kg to lbs for display
      return value / 0.453592;
    }
    return value;
  }

  /// Display unit string
  String get displayUnit {
    if (type == 'WEIGHT') return 'lbs';
    return unit;
  }
}

/// Response when creating a measurement
class CreateMeasurementResponse {
  final Measurement measurement;
  final String? convertedFrom;
  final bool isDuplicate;

  CreateMeasurementResponse({
    required this.measurement,
    this.convertedFrom,
    this.isDuplicate = false,
  });

  factory CreateMeasurementResponse.fromJson(Map<String, dynamic> json) {
    return CreateMeasurementResponse(
      measurement: Measurement.fromJson(json['measurement'] as Map<String, dynamic>),
      convertedFrom: json['convertedFrom'] as String?,
      isDuplicate: json['isDuplicate'] as bool? ?? false,
    );
  }
}
