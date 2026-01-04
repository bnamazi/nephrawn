import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/measurement.dart';

/// State provider for weight history
class WeightHistoryProvider extends ChangeNotifier {
  final ApiClient _apiClient;

  List<Measurement> _measurements = [];
  bool _isLoading = false;
  String? _error;
  bool _hasLoaded = false;

  WeightHistoryProvider(this._apiClient);

  List<Measurement> get measurements => _measurements;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasLoaded => _hasLoaded;
  bool get isEmpty => _measurements.isEmpty && _hasLoaded && !_isLoading;

  /// Fetch weight measurements
  Future<void> fetchMeasurements({bool refresh = false}) async {
    if (_isLoading) return;
    if (_hasLoaded && !refresh) return;

    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiClient.get(
        ApiEndpoints.measurements,
        queryParams: {
          'type': 'WEIGHT',
          'limit': 50,
        },
      );

      final List<dynamic> measurementsJson =
          response['measurements'] as List<dynamic>;
      _measurements = measurementsJson
          .map((json) => Measurement.fromJson(json as Map<String, dynamic>))
          .toList();

      _hasLoaded = true;
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load measurements';
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Refresh measurements
  Future<void> refresh() async {
    await fetchMeasurements(refresh: true);
  }
}
