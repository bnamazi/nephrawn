import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/clinical_profile.dart';

/// Provider for managing clinical profile data
class ClinicalProfileProvider extends ChangeNotifier {
  final ApiClient _apiClient;

  ClinicalProfileResponse? _profileResponse;
  bool _isLoading = false;
  bool _isSaving = false;
  String? _error;

  ClinicalProfileProvider(this._apiClient);

  /// Profile response with completeness info
  ClinicalProfileResponse? get profileResponse => _profileResponse;

  /// Clinical profile data
  ClinicalProfile? get profile => _profileResponse?.profile;

  /// Completeness info
  ProfileCompleteness? get completeness => _profileResponse?.completeness;

  /// Whether profile is loading
  bool get isLoading => _isLoading;

  /// Whether profile is saving
  bool get isSaving => _isSaving;

  /// Error message if any
  String? get error => _error;

  /// Fetch clinical profile from /patient/profile
  Future<void> fetchProfile() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiClient.get(ApiEndpoints.clinicalProfile);
      _profileResponse = ClinicalProfileResponse.fromJson(response);
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load clinical profile';
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Update clinical profile
  Future<bool> updateProfile(Map<String, dynamic> data) async {
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiClient.put(
        ApiEndpoints.clinicalProfile,
        data: data,
      );
      _profileResponse = ClinicalProfileResponse.fromJson(response);
      _isSaving = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isSaving = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Failed to update profile';
      _isSaving = false;
      notifyListeners();
      return false;
    }
  }
}
