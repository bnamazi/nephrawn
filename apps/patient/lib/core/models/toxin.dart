/// Risk level for kidney toxins
enum ToxinRiskLevel {
  low,
  moderate,
  high;

  String get label {
    switch (this) {
      case ToxinRiskLevel.low:
        return 'Use with caution';
      case ToxinRiskLevel.moderate:
        return 'Avoid if possible';
      case ToxinRiskLevel.high:
        return 'Avoid completely';
    }
  }

  String get displayName {
    switch (this) {
      case ToxinRiskLevel.low:
        return 'LOW';
      case ToxinRiskLevel.moderate:
        return 'MODERATE';
      case ToxinRiskLevel.high:
        return 'HIGH';
    }
  }

  static ToxinRiskLevel fromString(String? value) {
    switch (value?.toUpperCase()) {
      case 'LOW':
        return ToxinRiskLevel.low;
      case 'MODERATE':
        return ToxinRiskLevel.moderate;
      case 'HIGH':
        return ToxinRiskLevel.high;
      default:
        return ToxinRiskLevel.moderate;
    }
  }
}

/// Toxin category definition (global list)
class KidneyToxinCategory {
  final String id;
  final String name;
  final String? description;
  final String? examples;
  final ToxinRiskLevel riskLevel;
  final bool isActive;
  final int sortOrder;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  KidneyToxinCategory({
    required this.id,
    required this.name,
    this.description,
    this.examples,
    required this.riskLevel,
    this.isActive = true,
    this.sortOrder = 0,
    this.createdAt,
    this.updatedAt,
  });

  factory KidneyToxinCategory.fromJson(Map<String, dynamic> json) {
    return KidneyToxinCategory(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      examples: json['examples'] as String?,
      riskLevel: ToxinRiskLevel.fromString(json['riskLevel'] as String?),
      isActive: json['isActive'] as bool? ?? true,
      sortOrder: json['sortOrder'] as int? ?? 0,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : null,
    );
  }
}

/// Per-patient toxin tracking record
class PatientToxinRecord {
  final String id;
  final String patientId;
  final String toxinCategoryId;
  final bool isEducated;
  final DateTime? educatedAt;
  final String? educatedById;
  final DateTime? lastExposureDate;
  final String? exposureNotes;
  final ToxinRiskLevel? riskOverride;
  final String? notes;
  final DateTime createdAt;
  final DateTime updatedAt;
  final KidneyToxinCategory toxinCategory;

  PatientToxinRecord({
    required this.id,
    required this.patientId,
    required this.toxinCategoryId,
    this.isEducated = false,
    this.educatedAt,
    this.educatedById,
    this.lastExposureDate,
    this.exposureNotes,
    this.riskOverride,
    this.notes,
    required this.createdAt,
    required this.updatedAt,
    required this.toxinCategory,
  });

  /// Effective risk level (override or category default)
  ToxinRiskLevel get effectiveRiskLevel =>
      riskOverride ?? toxinCategory.riskLevel;

  factory PatientToxinRecord.fromJson(Map<String, dynamic> json) {
    return PatientToxinRecord(
      id: json['id'] as String,
      patientId: json['patientId'] as String,
      toxinCategoryId: json['toxinCategoryId'] as String,
      isEducated: json['isEducated'] as bool? ?? false,
      educatedAt: json['educatedAt'] != null
          ? DateTime.parse(json['educatedAt'] as String)
          : null,
      educatedById: json['educatedById'] as String?,
      lastExposureDate: json['lastExposureDate'] != null
          ? DateTime.parse(json['lastExposureDate'] as String)
          : null,
      exposureNotes: json['exposureNotes'] as String?,
      riskOverride: json['riskOverride'] != null
          ? ToxinRiskLevel.fromString(json['riskOverride'] as String)
          : null,
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      toxinCategory: KidneyToxinCategory.fromJson(
          json['toxinCategory'] as Map<String, dynamic>),
    );
  }
}

/// Response from patient toxin endpoints
class PatientToxinsResponse {
  final List<PatientToxinRecord> records;

  PatientToxinsResponse({required this.records});

  factory PatientToxinsResponse.fromJson(Map<String, dynamic> json) {
    return PatientToxinsResponse(
      records: (json['records'] as List<dynamic>?)
              ?.map((e) => PatientToxinRecord.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
