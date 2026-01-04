// Symptom check-in models

/// Symptom severity levels (0-3 scale)
enum SymptomSeverity {
  none(0, 'None'),
  mild(1, 'Mild'),
  moderate(2, 'Moderate'),
  severe(3, 'Severe');

  final int value;
  final String label;
  const SymptomSeverity(this.value, this.label);

  static SymptomSeverity fromValue(int value) {
    return SymptomSeverity.values.firstWhere(
      (s) => s.value == value,
      orElse: () => SymptomSeverity.none,
    );
  }
}

/// Appetite levels (same 0-3 scale but different labels)
enum AppetiteLevel {
  normal(0, 'Normal'),
  reduced(1, 'Reduced'),
  poor(2, 'Poor'),
  none(3, 'None');

  final int value;
  final String label;
  const AppetiteLevel(this.value, this.label);

  static AppetiteLevel fromValue(int value) {
    return AppetiteLevel.values.firstWhere(
      (a) => a.value == value,
      orElse: () => AppetiteLevel.normal,
    );
  }
}

/// Symptom types supported by the API
enum SymptomType {
  edema('edema', 'Swelling (Edema)'),
  fatigue('fatigue', 'Fatigue'),
  shortnessOfBreath('shortnessOfBreath', 'Shortness of Breath'),
  nausea('nausea', 'Nausea'),
  appetite('appetite', 'Appetite'),
  pain('pain', 'Pain');

  final String key;
  final String displayName;
  const SymptomType(this.key, this.displayName);
}

/// Individual symptom entry within a check-in
class SymptomEntry {
  final String type;
  final int severity;
  final String? location;
  final bool? atRest;

  SymptomEntry({
    required this.type,
    required this.severity,
    this.location,
    this.atRest,
  });

  factory SymptomEntry.fromJson(String type, Map<String, dynamic> json) {
    // Handle both 'severity' and 'level' (for appetite)
    final severityValue = json['severity'] ?? json['level'] ?? 0;
    return SymptomEntry(
      type: type,
      severity: severityValue is int ? severityValue : int.parse(severityValue.toString()),
      location: json['location'] as String?,
      atRest: json['atRest'] as bool?,
    );
  }

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    if (type == 'appetite') {
      json['level'] = severity;
    } else {
      json['severity'] = severity;
    }
    if (location != null) json['location'] = location;
    if (atRest != null) json['atRest'] = atRest;
    return json;
  }
}

/// A complete symptom check-in
class SymptomCheckin {
  final String id;
  final String patientId;
  final DateTime timestamp;
  final Map<String, SymptomEntry> symptoms;
  final String? notes;
  final DateTime createdAt;

  SymptomCheckin({
    required this.id,
    required this.patientId,
    required this.timestamp,
    required this.symptoms,
    this.notes,
    required this.createdAt,
  });

  factory SymptomCheckin.fromJson(Map<String, dynamic> json) {
    final symptomsJson = json['symptoms'] as Map<String, dynamic>;
    final symptoms = <String, SymptomEntry>{};

    symptomsJson.forEach((key, value) {
      if (value is Map<String, dynamic>) {
        symptoms[key] = SymptomEntry.fromJson(key, value);
      }
    });

    return SymptomCheckin(
      id: json['id'] as String,
      patientId: json['patientId'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      symptoms: symptoms,
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  /// Get all symptoms that have severity > 0
  List<SymptomEntry> get reportedSymptoms =>
      symptoms.values.where((s) => s.severity > 0).toList();

  /// Check if all symptoms are none/normal
  bool get allClear =>
      symptoms.values.every((s) => s.severity == 0);

  /// Get the highest severity reported
  int get maxSeverity =>
      symptoms.values.fold(0, (max, s) => s.severity > max ? s.severity : max);
}
