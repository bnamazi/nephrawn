import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/medication.dart';

/// Provider for managing patient medications
class MedicationsProvider extends ChangeNotifier {
  final ApiClient _apiClient;

  List<Medication> _medications = [];
  AdherenceSummary? _summary;
  bool _isLoading = false;
  bool _isSaving = false;
  String? _error;

  MedicationsProvider(this._apiClient);

  /// List of medications
  List<Medication> get medications => _medications;

  /// Active medications only
  List<Medication> get activeMedications =>
      _medications.where((m) => m.isActive).toList();

  /// Adherence summary
  AdherenceSummary? get summary => _summary;

  /// Whether data is loading
  bool get isLoading => _isLoading;

  /// Whether saving
  bool get isSaving => _isSaving;

  /// Error message if any
  String? get error => _error;

  /// Fetch all medications
  Future<void> fetchMedications({bool includeInactive = false}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final queryParams =
          includeInactive ? '?includeInactive=true' : '';
      final response =
          await _apiClient.get('${ApiEndpoints.medications}$queryParams');
      final List<dynamic> medicationsJson = response['medications'] ?? [];
      _medications = medicationsJson
          .map((m) => Medication.fromJson(m as Map<String, dynamic>))
          .toList();
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load medications';
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetch adherence summary
  Future<void> fetchSummary({int days = 30}) async {
    try {
      final response =
          await _apiClient.get('${ApiEndpoints.medicationsSummary}?days=$days');
      _summary = AdherenceSummary.fromJson(
          response['summary'] as Map<String, dynamic>);
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
    } catch (e) {
      // Summary is optional, don't fail if it fails
    }
  }

  /// Create a new medication
  Future<Medication?> createMedication({
    required String name,
    String? dosage,
    String? frequency,
    String? instructions,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      final data = {
        'name': name,
        if (dosage != null) 'dosage': dosage,
        if (frequency != null) 'frequency': frequency,
        if (instructions != null) 'instructions': instructions,
        if (startDate != null) 'startDate': startDate.toIso8601String(),
        if (endDate != null) 'endDate': endDate.toIso8601String(),
      };

      final response = await _apiClient.post(
        ApiEndpoints.medications,
        data: data,
      );
      final medication =
          Medication.fromJson(response['medication'] as Map<String, dynamic>);

      // Add to local list
      _medications.insert(0, medication);
      _isSaving = false;
      notifyListeners();
      return medication;
    } on ApiException catch (e) {
      _error = e.message;
      _isSaving = false;
      notifyListeners();
      return null;
    } catch (e) {
      _error = 'Failed to create medication';
      _isSaving = false;
      notifyListeners();
      return null;
    }
  }

  /// Update an existing medication
  Future<Medication?> updateMedication(
    String id, {
    String? name,
    String? dosage,
    String? frequency,
    String? instructions,
    DateTime? startDate,
    DateTime? endDate,
    bool? isActive,
  }) async {
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      final data = {
        if (name != null) 'name': name,
        if (dosage != null) 'dosage': dosage,
        if (frequency != null) 'frequency': frequency,
        if (instructions != null) 'instructions': instructions,
        if (startDate != null) 'startDate': startDate.toIso8601String(),
        if (endDate != null) 'endDate': endDate.toIso8601String(),
        if (isActive != null) 'isActive': isActive,
      };

      final response = await _apiClient.put(
        ApiEndpoints.medication(id),
        data: data,
      );
      final medication =
          Medication.fromJson(response['medication'] as Map<String, dynamic>);

      // Update local list
      final index = _medications.indexWhere((m) => m.id == id);
      if (index != -1) {
        _medications[index] = medication;
      }

      _isSaving = false;
      notifyListeners();
      return medication;
    } on ApiException catch (e) {
      _error = e.message;
      _isSaving = false;
      notifyListeners();
      return null;
    } catch (e) {
      _error = 'Failed to update medication';
      _isSaving = false;
      notifyListeners();
      return null;
    }
  }

  /// Delete (soft delete) a medication
  Future<bool> deleteMedication(String id) async {
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      await _apiClient.delete(ApiEndpoints.medication(id));

      // Remove from local list or mark inactive
      _medications.removeWhere((m) => m.id == id);

      _isSaving = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isSaving = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Failed to delete medication';
      _isSaving = false;
      notifyListeners();
      return false;
    }
  }

  /// Log adherence for a medication
  Future<MedicationLog?> logAdherence(
    String medicationId, {
    required bool taken,
    String? notes,
    DateTime? scheduledFor,
  }) async {
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      final data = {
        'taken': taken,
        if (notes != null) 'notes': notes,
        if (scheduledFor != null) 'scheduledFor': scheduledFor.toIso8601String(),
      };

      final response = await _apiClient.post(
        ApiEndpoints.medicationLog(medicationId),
        data: data,
      );
      final log =
          MedicationLog.fromJson(response['log'] as Map<String, dynamic>);

      _isSaving = false;
      notifyListeners();

      // Optionally refresh medications to get updated lastLog
      await fetchMedications();

      return log;
    } on ApiException catch (e) {
      _error = e.message;
      _isSaving = false;
      notifyListeners();
      return null;
    } catch (e) {
      _error = 'Failed to log adherence';
      _isSaving = false;
      notifyListeners();
      return null;
    }
  }

  /// Get adherence logs for a medication
  Future<List<MedicationLog>> getAdherenceLogs(
    String medicationId, {
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final response = await _apiClient.get(
        '${ApiEndpoints.medicationLogs(medicationId)}?limit=$limit&offset=$offset',
      );
      final List<dynamic> logsJson = response['logs'] ?? [];
      return logsJson
          .map((l) => MedicationLog.fromJson(l as Map<String, dynamic>))
          .toList();
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return [];
    } catch (e) {
      return [];
    }
  }

  /// Clear any error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}
