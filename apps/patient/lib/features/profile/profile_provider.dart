import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/user.dart';

/// Provider for fetching full profile data
class ProfileProvider extends ChangeNotifier {
  final ApiClient _apiClient;

  User? _profile;
  bool _isLoading = false;
  String? _error;

  ProfileProvider(this._apiClient);

  /// Full profile data
  User? get profile => _profile;

  /// Whether profile is loading
  bool get isLoading => _isLoading;

  /// Error message if any
  String? get error => _error;

  /// Fetch full profile from /patient/me
  Future<void> fetchProfile() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiClient.get(ApiEndpoints.me);
      final patientData = response['patient'] as Map<String, dynamic>;
      patientData['role'] = 'patient';
      _profile = User.fromJson(patientData);
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load profile';
      _isLoading = false;
      notifyListeners();
    }
  }
}
