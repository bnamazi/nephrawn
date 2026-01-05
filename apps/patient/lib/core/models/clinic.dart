/// Model representing a clinic the patient is enrolled in
class EnrolledClinic {
  final String id;
  final String name;
  final String? phone;
  final String? email;
  final DateTime enrolledAt;
  final bool isPrimary;
  final ClinicClinician clinician;

  EnrolledClinic({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    required this.enrolledAt,
    required this.isPrimary,
    required this.clinician,
  });

  factory EnrolledClinic.fromJson(Map<String, dynamic> json) {
    return EnrolledClinic(
      id: json['id'] as String,
      name: json['name'] as String,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      enrolledAt: DateTime.parse(json['enrolledAt'] as String),
      isPrimary: json['isPrimary'] as bool,
      clinician: ClinicClinician.fromJson(json['clinician'] as Map<String, dynamic>),
    );
  }
}

/// Clinician information associated with an enrollment
class ClinicClinician {
  final String id;
  final String name;

  ClinicClinician({
    required this.id,
    required this.name,
  });

  factory ClinicClinician.fromJson(Map<String, dynamic> json) {
    return ClinicClinician(
      id: json['id'] as String,
      name: json['name'] as String,
    );
  }
}
