import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/blood_pressure.dart';

/// State provider for blood pressure entry and history
class BPProvider extends ChangeNotifier {
  final ApiClient _apiClient;

  // Entry state
  bool _isSubmitting = false;
  String? _submitError;
  CreateBPResponse? _lastSubmitResult;

  // History state
  BPChartData? _chartData;
  bool _isLoadingHistory = false;
  String? _historyError;
  bool _hasLoadedHistory = false;

  BPProvider(this._apiClient);

  // Entry getters
  bool get isSubmitting => _isSubmitting;
  String? get submitError => _submitError;
  CreateBPResponse? get lastSubmitResult => _lastSubmitResult;
  bool get isDuplicate => _lastSubmitResult?.isDuplicate ?? false;

  // History getters
  BPChartData? get chartData => _chartData;
  List<BloodPressureReading> get readings => _chartData?.points ?? [];
  bool get isLoadingHistory => _isLoadingHistory;
  String? get historyError => _historyError;
  bool get hasLoadedHistory => _hasLoadedHistory;
  bool get isEmpty => readings.isEmpty && _hasLoadedHistory && !_isLoadingHistory;

  /// Submit blood pressure reading
  Future<bool> submitBP(int systolic, int diastolic) async {
    _isSubmitting = true;
    _submitError = null;
    _lastSubmitResult = null;
    notifyListeners();

    try {
      final response = await _apiClient.post(
        ApiEndpoints.bloodPressure,
        data: {
          'systolic': systolic,
          'diastolic': diastolic,
          'unit': 'mmHg',
        },
      );

      _lastSubmitResult = CreateBPResponse.fromJson(response);
      _isSubmitting = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _submitError = e.message;
      _isSubmitting = false;
      notifyListeners();
      return false;
    } catch (e) {
      _submitError = 'Error: $e';
      _isSubmitting = false;
      notifyListeners();
      return false;
    }
  }

  /// Fetch BP history
  Future<void> fetchHistory({bool refresh = false}) async {
    if (_isLoadingHistory) return;
    if (_hasLoadedHistory && !refresh) return;

    _isLoadingHistory = true;
    _historyError = null;
    notifyListeners();

    try {
      final response = await _apiClient.get(
        ApiEndpoints.charts('blood-pressure'),
      );

      // Handle empty data case
      if (response['data'] == null) {
        _chartData = null;
        _hasLoadedHistory = true;
        _isLoadingHistory = false;
        notifyListeners();
        return;
      }

      _chartData = BPChartData.fromJson(response);
      _hasLoadedHistory = true;
      _isLoadingHistory = false;
      notifyListeners();
    } on ApiException catch (e) {
      _historyError = e.message;
      _isLoadingHistory = false;
      notifyListeners();
    } catch (e) {
      _historyError = 'Error: $e';
      _isLoadingHistory = false;
      notifyListeners();
    }
  }

  /// Refresh history
  Future<void> refreshHistory() async {
    await fetchHistory(refresh: true);
  }

  /// Reset entry state
  void resetEntry() {
    _isSubmitting = false;
    _submitError = null;
    _lastSubmitResult = null;
    notifyListeners();
  }
}
