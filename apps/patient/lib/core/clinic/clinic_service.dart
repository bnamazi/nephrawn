import '../api/api_client.dart';
import '../api/api_endpoints.dart';
import '../models/clinic.dart';

/// Service for clinic-related operations
class ClinicService {
  final ApiClient _apiClient;

  ClinicService(this._apiClient);

  /// Get all clinics the patient is enrolled in
  Future<List<EnrolledClinic>> getClinics() async {
    final response = await _apiClient.get(ApiEndpoints.clinics);
    final clinics = (response['clinics'] as List)
        .map((c) => EnrolledClinic.fromJson(c as Map<String, dynamic>))
        .toList();
    return clinics;
  }

  /// Leave a clinic (self-discharge)
  Future<void> leaveClinic(String clinicId) async {
    await _apiClient.post(ApiEndpoints.leaveClinic(clinicId));
  }
}
