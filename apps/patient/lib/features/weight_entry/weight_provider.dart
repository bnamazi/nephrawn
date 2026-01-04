import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/measurement.dart';

/// State provider for weight entry
class WeightEntryProvider extends ChangeNotifier {
  final ApiClient _apiClient;

  bool _isLoading = false;
  String? _error;
  CreateMeasurementResponse? _lastResult;

  WeightEntryProvider(this._apiClient);

  bool get isLoading => _isLoading;
  String? get error => _error;
  CreateMeasurementResponse? get lastResult => _lastResult;
  bool get isDuplicate => _lastResult?.isDuplicate ?? false;

  /// Submit weight measurement
  Future<bool> submitWeight(double weightInLbs) async {
    _isLoading = true;
    _error = null;
    _lastResult = null;
    notifyListeners();

    try {
      final response = await _apiClient.post(
        ApiEndpoints.measurements,
        data: {
          'type': 'WEIGHT',
          'value': weightInLbs,
          'unit': 'lbs',
        },
      );

      _lastResult = CreateMeasurementResponse.fromJson(response);
      _isLoading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Failed to save measurement';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Clear state
  void reset() {
    _isLoading = false;
    _error = null;
    _lastResult = null;
    notifyListeners();
  }
}
