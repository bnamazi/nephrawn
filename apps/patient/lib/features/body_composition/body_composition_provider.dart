import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/body_composition.dart';

/// State provider for body composition data
class BodyCompositionProvider extends ChangeNotifier {
  final ApiClient _apiClient;

  List<BodyCompositionReading> _readings = [];
  bool _isLoading = false;
  String? _error;
  bool _hasLoaded = false;

  BodyCompositionProvider(this._apiClient);

  List<BodyCompositionReading> get readings => _readings;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasLoaded => _hasLoaded;
  bool get isEmpty => _readings.isEmpty && _hasLoaded && !_isLoading;

  /// Get the most recent reading
  BodyCompositionReading? get latestReading =>
      _readings.isNotEmpty ? _readings.first : null;

  /// Fetch body composition data
  Future<void> fetchData({bool refresh = false}) async {
    if (_isLoading) return;
    if (_hasLoaded && !refresh) return;

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiClient.get(
        ApiEndpoints.bodyComposition,
        queryParams: {'limit': 30},
      );

      final data = BodyCompositionData.fromJson(response);
      _readings = data.readings;

      _hasLoaded = true;
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load body composition data';
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Refresh data
  Future<void> refresh() async {
    await fetchData(refresh: true);
  }
}
