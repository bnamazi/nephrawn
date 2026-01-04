import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/dashboard.dart';

/// Provider for fetching dashboard data
class DashboardProvider extends ChangeNotifier {
  final ApiClient _apiClient;

  DashboardData? _data;
  bool _isLoading = false;
  String? _error;

  DashboardProvider(this._apiClient);

  /// Dashboard data
  DashboardData? get data => _data;

  /// Whether data is loading
  bool get isLoading => _isLoading;

  /// Whether data has been loaded at least once
  bool get hasLoaded => _data != null;

  /// Error message if any
  String? get error => _error;

  /// Fetch dashboard data
  Future<void> fetchDashboard() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _apiClient.get(ApiEndpoints.dashboard);
      _data = DashboardData.fromJson(response);
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to load dashboard';
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Refresh dashboard data
  Future<void> refresh() async {
    await fetchDashboard();
  }
}
