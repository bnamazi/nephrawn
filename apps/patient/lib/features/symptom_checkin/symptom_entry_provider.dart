import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/symptom_checkin.dart';

/// Provider for submitting symptom check-ins
class SymptomEntryProvider extends ChangeNotifier {
  final ApiClient _apiClient;

  bool _isLoading = false;
  String? _error;
  bool _isSuccess = false;
  SymptomCheckin? _lastCheckin;

  SymptomEntryProvider(this._apiClient);

  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isSuccess => _isSuccess;
  SymptomCheckin? get lastCheckin => _lastCheckin;

  /// Submit a symptom check-in
  Future<bool> submitCheckin({
    required Map<String, Map<String, dynamic>> symptoms,
    String? notes,
  }) async {
    _isLoading = true;
    _error = null;
    _isSuccess = false;
    notifyListeners();

    try {
      final body = <String, dynamic>{
        'symptoms': symptoms,
      };
      if (notes != null && notes.isNotEmpty) {
        body['notes'] = notes;
      }

      final response = await _apiClient.post(ApiEndpoints.checkins, data: body);

      if (response['checkin'] != null) {
        _lastCheckin = SymptomCheckin.fromJson(
          response['checkin'] as Map<String, dynamic>,
        );
        _isSuccess = true;
      }

      _isLoading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Failed to submit check-in: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Reset the provider state
  void reset() {
    _isLoading = false;
    _error = null;
    _isSuccess = false;
    _lastCheckin = null;
    notifyListeners();
  }
}
