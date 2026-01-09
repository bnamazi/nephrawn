enum LabSource {
  manualPatient,
  manualClinician,
  imported;

  String get displayName {
    switch (this) {
      case LabSource.manualPatient:
        return 'Entered by Patient';
      case LabSource.manualClinician:
        return 'Entered by Clinician';
      case LabSource.imported:
        return 'Imported';
    }
  }

  static LabSource fromString(String value) {
    switch (value) {
      case 'MANUAL_PATIENT':
        return LabSource.manualPatient;
      case 'MANUAL_CLINICIAN':
        return LabSource.manualClinician;
      case 'IMPORTED':
        return LabSource.imported;
      default:
        return LabSource.manualPatient;
    }
  }

  String toApiString() {
    switch (this) {
      case LabSource.manualPatient:
        return 'MANUAL_PATIENT';
      case LabSource.manualClinician:
        return 'MANUAL_CLINICIAN';
      case LabSource.imported:
        return 'IMPORTED';
    }
  }
}

enum LabResultFlag {
  high,
  low,
  critical;

  String get displayName {
    switch (this) {
      case LabResultFlag.high:
        return 'High';
      case LabResultFlag.low:
        return 'Low';
      case LabResultFlag.critical:
        return 'Critical';
    }
  }

  String get shortName {
    switch (this) {
      case LabResultFlag.high:
        return 'H';
      case LabResultFlag.low:
        return 'L';
      case LabResultFlag.critical:
        return 'C';
    }
  }

  static LabResultFlag? fromString(String? value) {
    if (value == null) return null;
    switch (value) {
      case 'H':
        return LabResultFlag.high;
      case 'L':
        return LabResultFlag.low;
      case 'C':
        return LabResultFlag.critical;
      default:
        return null;
    }
  }

  String toApiString() {
    switch (this) {
      case LabResultFlag.high:
        return 'H';
      case LabResultFlag.low:
        return 'L';
      case LabResultFlag.critical:
        return 'C';
    }
  }
}

class LabResult {
  final String id;
  final String analyteName;
  final String? analyteCode;
  final double value;
  final String unit;
  final double? referenceRangeLow;
  final double? referenceRangeHigh;
  final LabResultFlag? flag;
  final DateTime createdAt;
  final DateTime updatedAt;

  LabResult({
    required this.id,
    required this.analyteName,
    this.analyteCode,
    required this.value,
    required this.unit,
    this.referenceRangeLow,
    this.referenceRangeHigh,
    this.flag,
    required this.createdAt,
    required this.updatedAt,
  });

  factory LabResult.fromJson(Map<String, dynamic> json) {
    return LabResult(
      id: json['id'] as String,
      analyteName: json['analyteName'] as String,
      analyteCode: json['analyteCode'] as String?,
      value: (json['value'] is String
          ? double.parse(json['value'] as String)
          : (json['value'] as num).toDouble()),
      unit: json['unit'] as String,
      referenceRangeLow: json['referenceRangeLow'] != null
          ? (json['referenceRangeLow'] is String
              ? double.parse(json['referenceRangeLow'] as String)
              : (json['referenceRangeLow'] as num).toDouble())
          : null,
      referenceRangeHigh: json['referenceRangeHigh'] != null
          ? (json['referenceRangeHigh'] is String
              ? double.parse(json['referenceRangeHigh'] as String)
              : (json['referenceRangeHigh'] as num).toDouble())
          : null,
      flag: LabResultFlag.fromString(json['flag'] as String?),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'analyteName': analyteName,
      'analyteCode': analyteCode,
      'value': value,
      'unit': unit,
      'referenceRangeLow': referenceRangeLow,
      'referenceRangeHigh': referenceRangeHigh,
      'flag': flag?.toApiString(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  bool get isHigh => flag == LabResultFlag.high;
  bool get isLow => flag == LabResultFlag.low;
  bool get isCritical => flag == LabResultFlag.critical;
  bool get isAbnormal => flag != null;

  String get displayValue => '$value $unit';

  String get referenceRange {
    if (referenceRangeLow != null && referenceRangeHigh != null) {
      return '$referenceRangeLow - $referenceRangeHigh';
    } else if (referenceRangeLow != null) {
      return '>= $referenceRangeLow';
    } else if (referenceRangeHigh != null) {
      return '<= $referenceRangeHigh';
    }
    return '-';
  }
}

class VerifiedBy {
  final String id;
  final String name;

  VerifiedBy({
    required this.id,
    required this.name,
  });

  factory VerifiedBy.fromJson(Map<String, dynamic> json) {
    return VerifiedBy(
      id: json['id'] as String,
      name: json['name'] as String,
    );
  }
}

class LabReport {
  final String id;
  final String patientId;
  final String? documentId;
  final DateTime collectedAt;
  final DateTime? reportedAt;
  final String? labName;
  final String? orderingProvider;
  final String? notes;
  final LabSource source;
  final DateTime? verifiedAt;
  final VerifiedBy? verifiedBy;
  final List<LabResult> results;
  final DateTime createdAt;
  final DateTime updatedAt;

  LabReport({
    required this.id,
    required this.patientId,
    this.documentId,
    required this.collectedAt,
    this.reportedAt,
    this.labName,
    this.orderingProvider,
    this.notes,
    required this.source,
    this.verifiedAt,
    this.verifiedBy,
    required this.results,
    required this.createdAt,
    required this.updatedAt,
  });

  factory LabReport.fromJson(Map<String, dynamic> json) {
    return LabReport(
      id: json['id'] as String,
      patientId: json['patientId'] as String,
      documentId: json['documentId'] as String?,
      collectedAt: DateTime.parse(json['collectedAt'] as String),
      reportedAt: json['reportedAt'] != null
          ? DateTime.parse(json['reportedAt'] as String)
          : null,
      labName: json['labName'] as String?,
      orderingProvider: json['orderingProvider'] as String?,
      notes: json['notes'] as String?,
      source: LabSource.fromString(json['source'] as String),
      verifiedAt: json['verifiedAt'] != null
          ? DateTime.parse(json['verifiedAt'] as String)
          : null,
      verifiedBy: json['verifiedBy'] != null
          ? VerifiedBy.fromJson(json['verifiedBy'] as Map<String, dynamic>)
          : null,
      results: (json['results'] as List<dynamic>?)
              ?.map((r) => LabResult.fromJson(r as Map<String, dynamic>))
              .toList() ??
          [],
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'patientId': patientId,
      'documentId': documentId,
      'collectedAt': collectedAt.toIso8601String(),
      'reportedAt': reportedAt?.toIso8601String(),
      'labName': labName,
      'orderingProvider': orderingProvider,
      'notes': notes,
      'source': source.toApiString(),
      'verifiedAt': verifiedAt?.toIso8601String(),
      'results': results.map((r) => r.toJson()).toList(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  bool get isVerified => verifiedAt != null;

  String get displayTitle {
    if (labName != null) {
      return labName!;
    }
    return 'Lab Report';
  }

  int get abnormalResultsCount => results.where((r) => r.isAbnormal).length;
  int get criticalResultsCount => results.where((r) => r.isCritical).length;
}

// Common CKD analytes for quick-pick
class CkdAnalyte {
  final String name;
  final String unit;
  final String? code;

  const CkdAnalyte({
    required this.name,
    required this.unit,
    this.code,
  });
}

const List<CkdAnalyte> ckdAnalytes = [
  CkdAnalyte(name: 'Creatinine', unit: 'mg/dL', code: '2160-0'),
  CkdAnalyte(name: 'eGFR', unit: 'mL/min/1.73m2', code: '33914-3'),
  CkdAnalyte(name: 'BUN', unit: 'mg/dL', code: '3094-0'),
  CkdAnalyte(name: 'Potassium', unit: 'mEq/L', code: '2823-3'),
  CkdAnalyte(name: 'Sodium', unit: 'mEq/L', code: '2951-2'),
  CkdAnalyte(name: 'CO2/Bicarbonate', unit: 'mEq/L', code: '1963-8'),
  CkdAnalyte(name: 'Albumin', unit: 'g/dL', code: '1751-7'),
  CkdAnalyte(name: 'Hemoglobin', unit: 'g/dL', code: '718-7'),
  CkdAnalyte(name: 'Phosphorus', unit: 'mg/dL', code: '2777-1'),
  CkdAnalyte(name: 'Calcium', unit: 'mg/dL', code: '17861-6'),
  CkdAnalyte(name: 'PTH', unit: 'pg/mL', code: '2731-8'),
  CkdAnalyte(name: 'ACR', unit: 'mg/g', code: '13705-9'),
];
