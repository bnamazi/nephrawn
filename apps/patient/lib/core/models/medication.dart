/// A medication prescribed to or used by the patient
class Medication {
  final String id;
  final String patientId;
  final String name;
  final String? dosage;
  final String? frequency;
  final String? instructions;
  final DateTime? startDate;
  final DateTime? endDate;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<MedicationLog> logs;

  Medication({
    required this.id,
    required this.patientId,
    required this.name,
    this.dosage,
    this.frequency,
    this.instructions,
    this.startDate,
    this.endDate,
    this.isActive = true,
    required this.createdAt,
    required this.updatedAt,
    this.logs = const [],
  });

  factory Medication.fromJson(Map<String, dynamic> json) {
    return Medication(
      id: json['id'] as String,
      patientId: json['patientId'] as String,
      name: json['name'] as String,
      dosage: json['dosage'] as String?,
      frequency: json['frequency'] as String?,
      instructions: json['instructions'] as String?,
      startDate: json['startDate'] != null
          ? DateTime.parse(json['startDate'] as String)
          : null,
      endDate: json['endDate'] != null
          ? DateTime.parse(json['endDate'] as String)
          : null,
      isActive: json['isActive'] as bool? ?? true,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      logs: (json['logs'] as List<dynamic>?)
              ?.map((l) => MedicationLog.fromJson(l as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      if (dosage != null) 'dosage': dosage,
      if (frequency != null) 'frequency': frequency,
      if (instructions != null) 'instructions': instructions,
      if (startDate != null) 'startDate': startDate!.toIso8601String(),
      if (endDate != null) 'endDate': endDate!.toIso8601String(),
    };
  }

  /// Create a copy with updated fields
  Medication copyWith({
    String? name,
    String? dosage,
    String? frequency,
    String? instructions,
    DateTime? startDate,
    DateTime? endDate,
    bool? isActive,
  }) {
    return Medication(
      id: id,
      patientId: patientId,
      name: name ?? this.name,
      dosage: dosage ?? this.dosage,
      frequency: frequency ?? this.frequency,
      instructions: instructions ?? this.instructions,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt,
      updatedAt: DateTime.now(),
      logs: logs,
    );
  }

  /// Check if medication has recent adherence log
  MedicationLog? get lastLog => logs.isNotEmpty ? logs.first : null;
}

/// A log entry for medication adherence
class MedicationLog {
  final String id;
  final String medicationId;
  final DateTime loggedAt;
  final DateTime? scheduledFor;
  final bool taken;
  final String? notes;
  final DateTime createdAt;

  MedicationLog({
    required this.id,
    required this.medicationId,
    required this.loggedAt,
    this.scheduledFor,
    required this.taken,
    this.notes,
    required this.createdAt,
  });

  factory MedicationLog.fromJson(Map<String, dynamic> json) {
    return MedicationLog(
      id: json['id'] as String,
      medicationId: json['medicationId'] as String,
      loggedAt: DateTime.parse(json['loggedAt'] as String),
      scheduledFor: json['scheduledFor'] != null
          ? DateTime.parse(json['scheduledFor'] as String)
          : null,
      taken: json['taken'] as bool,
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// Summary of adherence for a patient's medications
class AdherenceSummary {
  final int totalMedications;
  final int totalLogs;
  final int takenCount;
  final int skippedCount;
  final double adherenceRate;
  final int days;
  final List<MedicationAdherenceSummary> medications;

  AdherenceSummary({
    required this.totalMedications,
    required this.totalLogs,
    required this.takenCount,
    required this.skippedCount,
    required this.adherenceRate,
    required this.days,
    required this.medications,
  });

  factory AdherenceSummary.fromJson(Map<String, dynamic> json) {
    return AdherenceSummary(
      totalMedications: json['totalMedications'] as int,
      totalLogs: json['totalLogs'] as int,
      takenCount: json['takenCount'] as int,
      skippedCount: json['skippedCount'] as int,
      adherenceRate: (json['adherenceRate'] as num).toDouble(),
      days: json['days'] as int,
      medications: (json['medications'] as List<dynamic>)
          .map((m) =>
              MedicationAdherenceSummary.fromJson(m as Map<String, dynamic>))
          .toList(),
    );
  }

  /// Get adherence rate as percentage string
  String get adherencePercentage =>
      '${(adherenceRate * 100).toStringAsFixed(0)}%';

  /// Check if adherence is good (>=80%)
  bool get isGoodAdherence => adherenceRate >= 0.8;

  /// Check if adherence needs attention (<60%)
  bool get needsAttention => adherenceRate < 0.6;
}

/// Per-medication adherence summary
class MedicationAdherenceSummary {
  final String id;
  final String name;
  final String? dosage;
  final String? frequency;
  final int logsCount;
  final int takenCount;
  final int skippedCount;
  final MedicationLog? lastLog;

  MedicationAdherenceSummary({
    required this.id,
    required this.name,
    this.dosage,
    this.frequency,
    required this.logsCount,
    required this.takenCount,
    required this.skippedCount,
    this.lastLog,
  });

  factory MedicationAdherenceSummary.fromJson(Map<String, dynamic> json) {
    return MedicationAdherenceSummary(
      id: json['id'] as String,
      name: json['name'] as String,
      dosage: json['dosage'] as String?,
      frequency: json['frequency'] as String?,
      logsCount: json['logsCount'] as int,
      takenCount: json['takenCount'] as int,
      skippedCount: json['skippedCount'] as int,
      lastLog: json['lastLog'] != null
          ? MedicationLog.fromJson(json['lastLog'] as Map<String, dynamic>)
          : null,
    );
  }

  /// Calculate adherence rate for this medication
  double get adherenceRate => logsCount > 0 ? takenCount / logsCount : 0;

  /// Get adherence rate as percentage string
  String get adherencePercentage =>
      '${(adherenceRate * 100).toStringAsFixed(0)}%';
}
