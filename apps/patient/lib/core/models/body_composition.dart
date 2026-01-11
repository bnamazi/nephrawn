/// Body composition measurement data from a single reading session
class BodyCompositionReading {
  final DateTime timestamp;
  final String source;
  final double? fatFreeKg;      // Lean mass in kg
  final double? fatRatio;       // Body fat percentage
  final double? fatMassKg;      // Fat mass in kg
  final double? muscleMassKg;   // Muscle mass in kg
  final double? hydrationKg;    // Body water in kg
  final double? boneMassKg;     // Bone mass in kg
  final double? pulseWaveVelocity; // Vascular age indicator in m/s

  BodyCompositionReading({
    required this.timestamp,
    required this.source,
    this.fatFreeKg,
    this.fatRatio,
    this.fatMassKg,
    this.muscleMassKg,
    this.hydrationKg,
    this.boneMassKg,
    this.pulseWaveVelocity,
  });

  factory BodyCompositionReading.fromJson(Map<String, dynamic> json) {
    return BodyCompositionReading(
      timestamp: DateTime.parse(json['timestamp'] as String),
      source: json['source'] as String? ?? 'manual',
      fatFreeKg: _parseValue(json['fat_free_mass']),
      fatRatio: _parseValue(json['fat_ratio']),
      fatMassKg: _parseValue(json['fat_mass']),
      muscleMassKg: _parseValue(json['muscle_mass']),
      hydrationKg: _parseValue(json['hydration']),
      boneMassKg: _parseValue(json['bone_mass']),
      pulseWaveVelocity: _parseValue(json['pulse_wave_velocity']),
    );
  }

  static double? _parseValue(dynamic data) {
    if (data == null) return null;
    if (data is Map) {
      final value = data['value'];
      if (value is num) return value.toDouble();
    }
    return null;
  }

  /// Whether this reading has any body composition data
  bool get hasData =>
      fatFreeKg != null ||
      fatRatio != null ||
      fatMassKg != null ||
      muscleMassKg != null ||
      hydrationKg != null ||
      boneMassKg != null ||
      pulseWaveVelocity != null;

  /// Count of available metrics in this reading
  int get availableMetricsCount {
    int count = 0;
    if (fatFreeKg != null) count++;
    if (fatRatio != null) count++;
    if (fatMassKg != null) count++;
    if (muscleMassKg != null) count++;
    if (hydrationKg != null) count++;
    if (boneMassKg != null) count++;
    if (pulseWaveVelocity != null) count++;
    return count;
  }

  /// Convert kg to lbs for display
  double kgToLbs(double kg) => kg / 0.453592;
}

/// Response from GET /patient/body-composition
class BodyCompositionData {
  final List<BodyCompositionReading> readings;
  final int count;
  final DateTime from;
  final DateTime to;

  BodyCompositionData({
    required this.readings,
    required this.count,
    required this.from,
    required this.to,
  });

  factory BodyCompositionData.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>;
    final range = data['range'] as Map<String, dynamic>;
    final readingsList = data['readings'] as List<dynamic>;

    return BodyCompositionData(
      readings: readingsList
          .map((r) => BodyCompositionReading.fromJson(r as Map<String, dynamic>))
          .toList(),
      count: data['count'] as int,
      from: DateTime.parse(range['from'] as String),
      to: DateTime.parse(range['to'] as String),
    );
  }

  bool get isEmpty => readings.isEmpty;
  bool get isNotEmpty => readings.isNotEmpty;
}
