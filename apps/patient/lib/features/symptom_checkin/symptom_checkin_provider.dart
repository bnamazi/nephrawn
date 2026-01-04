import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/symptom_checkin.dart';

/// Provider for fetching and managing symptom check-in history
class SymptomCheckinProvider extends ChangeNotifier {
  final ApiClient _apiClient;

  List<SymptomCheckin> _checkins = [];
  bool _isLoading = false;
  bool _hasLoaded = false;
  String? _error;

  SymptomCheckinProvider(this._apiClient);

  List<SymptomCheckin> get checkins => _checkins;
  bool get isLoading => _isLoading;
  bool get hasLoaded => _hasLoaded;
  String? get error => _error;
  bool get isEmpty => _checkins.isEmpty;

  /// Fetch check-ins from the API
  Future<void> fetchCheckins({bool refresh = false, int limit = 50}) async {
    if (_isLoading) return;

    _isLoading = true;
    if (refresh) {
      _error = null;
    }
    notifyListeners();

    try {
      final response = await _apiClient.get(
        '${ApiEndpoints.checkins}?limit=$limit',
      );

      final checkinsJson = response['checkins'] as List<dynamic>;
      _checkins = checkinsJson
          .map((json) => SymptomCheckin.fromJson(json as Map<String, dynamic>))
          .toList();

      _hasLoaded = true;
      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Failed to load check-ins: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Refresh the check-in list
  Future<void> refresh() async {
    await fetchCheckins(refresh: true);
  }

  /// Refresh specifically for pull-to-refresh
  Future<void> refreshHistory() async {
    await fetchCheckins(refresh: true);
  }
}
