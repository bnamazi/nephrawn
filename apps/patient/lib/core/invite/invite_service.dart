import '../api/api_client.dart';
import '../api/api_endpoints.dart';

/// Response from validating an invite code
class InviteValidation {
  final bool valid;
  final String? clinicName;
  final DateTime? expiresAt;
  final String? error;
  final String? reason;

  InviteValidation({
    required this.valid,
    this.clinicName,
    this.expiresAt,
    this.error,
    this.reason,
  });

  factory InviteValidation.fromJson(Map<String, dynamic> json) {
    return InviteValidation(
      valid: json['valid'] as bool? ?? false,
      clinicName: json['clinicName'] as String?,
      expiresAt: json['expiresAt'] != null
          ? DateTime.parse(json['expiresAt'] as String)
          : null,
      error: json['error'] as String?,
      reason: json['reason'] as String?,
    );
  }
}

/// Response from claiming an invite
class ClaimResult {
  final bool success;
  final String? token;
  final String? patientId;
  final String? clinicId;
  final String? clinicName;
  final bool isNewPatient;
  final String? error;
  final String? errorCode;

  ClaimResult({
    required this.success,
    this.token,
    this.patientId,
    this.clinicId,
    this.clinicName,
    this.isNewPatient = false,
    this.error,
    this.errorCode,
  });

  factory ClaimResult.fromJson(Map<String, dynamic> json) {
    return ClaimResult(
      success: json['success'] as bool? ?? false,
      token: json['token'] as String?,
      patientId: (json['patient'] as Map<String, dynamic>?)?['id'] as String?,
      clinicId: (json['clinic'] as Map<String, dynamic>?)?['id'] as String?,
      clinicName: (json['clinic'] as Map<String, dynamic>?)?['name'] as String?,
      isNewPatient: json['isNewPatient'] as bool? ?? false,
      error: json['error'] as String?,
      errorCode: json['code'] as String?,
    );
  }
}

/// Service for invite-related API calls
class InviteService {
  final ApiClient _apiClient;

  InviteService(this._apiClient);

  /// Validate an invite code (public endpoint)
  Future<InviteValidation> validateInvite(String code) async {
    try {
      final response = await _apiClient.get(
        ApiEndpoints.validateInvite(code),
      );
      return InviteValidation.fromJson(response);
    } catch (e) {
      // Handle error responses
      if (e.toString().contains('404')) {
        return InviteValidation(
          valid: false,
          error: 'Invite not found',
        );
      }
      if (e.toString().contains('410')) {
        return InviteValidation(
          valid: false,
          error: 'Invite is no longer valid',
        );
      }
      rethrow;
    }
  }

  /// Claim an invite for a new patient (creates account)
  Future<ClaimResult> claimInvite({
    required String code,
    required String dateOfBirth,
    required String email,
    required String password,
    required String name,
  }) async {
    try {
      final response = await _apiClient.post(
        ApiEndpoints.claimInvite(code),
        data: {
          'dateOfBirth': dateOfBirth,
          'email': email,
          'password': password,
          'name': name,
        },
      );
      return ClaimResult.fromJson(response);
    } catch (e) {
      // Parse error responses
      final errorString = e.toString();
      if (errorString.contains('DOB_MISMATCH')) {
        return ClaimResult(
          success: false,
          error: 'Date of birth does not match the invite',
          errorCode: 'DOB_MISMATCH',
        );
      }
      if (errorString.contains('EMAIL_EXISTS')) {
        return ClaimResult(
          success: false,
          error: 'An account with this email already exists',
          errorCode: 'EMAIL_EXISTS',
        );
      }
      if (errorString.contains('NOT_FOUND')) {
        return ClaimResult(
          success: false,
          error: 'Invite not found',
          errorCode: 'NOT_FOUND',
        );
      }
      rethrow;
    }
  }

  /// Claim an invite for an existing authenticated patient
  Future<ClaimResult> claimExistingPatient({
    required String code,
    required String dateOfBirth,
  }) async {
    final response = await _apiClient.post(
      ApiEndpoints.claimExistingInvite(code),
      data: {
        'dateOfBirth': dateOfBirth,
      },
    );
    return ClaimResult.fromJson(response);
  }
}
