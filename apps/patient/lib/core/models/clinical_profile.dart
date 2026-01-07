/// Clinical profile model for patient health information
class ClinicalProfile {
  final String id;
  final String patientId;
  final String? sex;
  final int? heightCm;
  final String? heightDisplay;
  final String? ckdStageSelfReported;
  final String? ckdStageClinician;
  final String? ckdStageEffective;
  final String? ckdStageEffectiveLabel;
  final String? ckdStageSource;
  final String? primaryEtiology;
  final String? primaryEtiologyLabel;
  final String? dialysisStatus;
  final String? dialysisStatusLabel;
  final DateTime? dialysisStartDate;
  final String? transplantStatus;
  final DateTime? transplantDate;
  final bool hasHeartFailure;
  final String? heartFailureClass;
  final String? heartFailureLabel;
  final String? diabetesType;
  final String? diabetesLabel;
  final bool hasHypertension;
  final List<String> otherConditions;
  final ProfileMedications medications;
  final DateTime? updatedAt;

  ClinicalProfile({
    required this.id,
    required this.patientId,
    this.sex,
    this.heightCm,
    this.heightDisplay,
    this.ckdStageSelfReported,
    this.ckdStageClinician,
    this.ckdStageEffective,
    this.ckdStageEffectiveLabel,
    this.ckdStageSource,
    this.primaryEtiology,
    this.primaryEtiologyLabel,
    this.dialysisStatus,
    this.dialysisStatusLabel,
    this.dialysisStartDate,
    this.transplantStatus,
    this.transplantDate,
    this.hasHeartFailure = false,
    this.heartFailureClass,
    this.heartFailureLabel,
    this.diabetesType,
    this.diabetesLabel,
    this.hasHypertension = false,
    this.otherConditions = const [],
    required this.medications,
    this.updatedAt,
  });

  factory ClinicalProfile.fromJson(Map<String, dynamic> json) {
    return ClinicalProfile(
      id: json['id'] as String,
      patientId: json['patientId'] as String,
      sex: json['sex'] as String?,
      heightCm: json['heightCm'] as int?,
      heightDisplay: json['heightDisplay'] as String?,
      ckdStageSelfReported: json['ckdStageSelfReported'] as String?,
      ckdStageClinician: json['ckdStageClinician'] as String?,
      ckdStageEffective: json['ckdStageEffective'] as String?,
      ckdStageEffectiveLabel: json['ckdStageEffectiveLabel'] as String?,
      ckdStageSource: json['ckdStageSource'] as String?,
      primaryEtiology: json['primaryEtiology'] as String?,
      primaryEtiologyLabel: json['primaryEtiologyLabel'] as String?,
      dialysisStatus: json['dialysisStatus'] as String?,
      dialysisStatusLabel: json['dialysisStatusLabel'] as String?,
      dialysisStartDate: json['dialysisStartDate'] != null
          ? DateTime.parse(json['dialysisStartDate'] as String)
          : null,
      transplantStatus: json['transplantStatus'] as String?,
      transplantDate: json['transplantDate'] != null
          ? DateTime.parse(json['transplantDate'] as String)
          : null,
      hasHeartFailure: json['hasHeartFailure'] as bool? ?? false,
      heartFailureClass: json['heartFailureClass'] as String?,
      heartFailureLabel: json['heartFailureLabel'] as String?,
      diabetesType: json['diabetesType'] as String?,
      diabetesLabel: json['diabetesLabel'] as String?,
      hasHypertension: json['hasHypertension'] as bool? ?? false,
      otherConditions: (json['otherConditions'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      medications: ProfileMedications.fromJson(
          json['medications'] as Map<String, dynamic>? ?? {}),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : null,
    );
  }
}

class ProfileMedications {
  final bool onDiuretics;
  final bool onAceArbInhibitor;
  final bool onSglt2Inhibitor;
  final bool onNsaids;
  final bool onMra;
  final bool onInsulin;

  ProfileMedications({
    this.onDiuretics = false,
    this.onAceArbInhibitor = false,
    this.onSglt2Inhibitor = false,
    this.onNsaids = false,
    this.onMra = false,
    this.onInsulin = false,
  });

  factory ProfileMedications.fromJson(Map<String, dynamic> json) {
    return ProfileMedications(
      onDiuretics: json['onDiuretics'] as bool? ?? false,
      onAceArbInhibitor: json['onAceArbInhibitor'] as bool? ?? false,
      onSglt2Inhibitor: json['onSglt2Inhibitor'] as bool? ?? false,
      onNsaids: json['onNsaids'] as bool? ?? false,
      onMra: json['onMra'] as bool? ?? false,
      onInsulin: json['onInsulin'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'onDiuretics': onDiuretics,
      'onAceArbInhibitor': onAceArbInhibitor,
      'onSglt2Inhibitor': onSglt2Inhibitor,
      'onNsaids': onNsaids,
      'onMra': onMra,
      'onInsulin': onInsulin,
    };
  }
}

class ProfileCompleteness {
  final int profileScore;
  final List<String> missingCritical;
  final List<String> missingRecommended;
  final bool showProfileBanner;

  ProfileCompleteness({
    required this.profileScore,
    this.missingCritical = const [],
    this.missingRecommended = const [],
    this.showProfileBanner = false,
  });

  factory ProfileCompleteness.fromJson(Map<String, dynamic> json) {
    return ProfileCompleteness(
      profileScore: json['profileScore'] as int? ?? 0,
      missingCritical: (json['missingCritical'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      missingRecommended: (json['missingRecommended'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      showProfileBanner: json['showProfileBanner'] as bool? ?? false,
    );
  }
}

/// Response from GET /patient/profile
class ClinicalProfileResponse {
  final ClinicalProfile? profile;
  final ProfileCompleteness completeness;

  ClinicalProfileResponse({
    this.profile,
    required this.completeness,
  });

  factory ClinicalProfileResponse.fromJson(Map<String, dynamic> json) {
    return ClinicalProfileResponse(
      profile: json['profile'] != null
          ? ClinicalProfile.fromJson(json['profile'] as Map<String, dynamic>)
          : null,
      completeness: ProfileCompleteness.fromJson(
          json['completeness'] as Map<String, dynamic>? ?? {}),
    );
  }
}

/// Enum labels for display
class ProfileLabels {
  static const Map<String, String> ckdStage = {
    'STAGE_1': 'Stage 1',
    'STAGE_2': 'Stage 2',
    'STAGE_3A': 'Stage 3a',
    'STAGE_3B': 'Stage 3b',
    'STAGE_4': 'Stage 4',
    'STAGE_5': 'Stage 5',
    'STAGE_5D': 'Stage 5D',
    'TRANSPLANT': 'Transplant',
    'UNKNOWN': 'Unknown',
  };

  static const Map<String, String> sex = {
    'MALE': 'Male',
    'FEMALE': 'Female',
    'OTHER': 'Other',
    'UNSPECIFIED': 'Prefer not to say',
  };

  static const Map<String, String> dialysisStatus = {
    'NONE': 'Not on dialysis',
    'HEMODIALYSIS': 'Hemodialysis',
    'PERITONEAL_DIALYSIS': 'Peritoneal Dialysis',
  };

  static const Map<String, String> diabetesType = {
    'NONE': 'None',
    'TYPE_1': 'Type 1',
    'TYPE_2': 'Type 2',
  };

  static const Map<String, String> transplantStatus = {
    'NONE': 'None',
    'LISTED': 'Listed for transplant',
    'RECEIVED': 'Received transplant',
  };

  static const Map<String, String> etiology = {
    'DIABETES': 'Diabetic Nephropathy',
    'HYPERTENSION': 'Hypertensive Nephrosclerosis',
    'GLOMERULONEPHRITIS': 'Glomerulonephritis',
    'POLYCYSTIC': 'Polycystic Kidney Disease',
    'OTHER': 'Other',
    'UNKNOWN': 'Unknown',
  };
}
