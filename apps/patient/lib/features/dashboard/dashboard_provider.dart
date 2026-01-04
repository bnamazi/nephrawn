import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/dashboard.dart';
import '../../core/models/alert.dart';
import '../../core/models/symptom_checkin.dart';

/// Provider for fetching dashboard data including alerts and check-ins
class DashboardProvider extends ChangeNotifier {
  final ApiClient _apiClient;

  DashboardData? _data;
  List<Alert> _recentAlerts = [];
  List<SymptomCheckin> _recentCheckins = [];
  bool _isLoading = false;
  String? _error;

  DashboardProvider(this._apiClient);

  /// Dashboard data
  DashboardData? get data => _data;

  /// Recent alerts (up to 5)
  List<Alert> get recentAlerts => _recentAlerts;

  /// Recent check-ins (up to 3)
  List<SymptomCheckin> get recentCheckins => _recentCheckins;

  /// Whether data is loading
  bool get isLoading => _isLoading;

  /// Whether data has been loaded at least once
  bool get hasLoaded => _data != null;

  /// Error message if any
  String? get error => _error;

  /// Count of open alerts
  int get openAlertCount => _recentAlerts.where((a) => a.isOpen).length;

  /// Fetch all dashboard data in parallel
  Future<void> fetchDashboard() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      // Fetch dashboard, alerts, and check-ins in parallel
      final results = await Future.wait([
        _apiClient.get(ApiEndpoints.dashboard),
        _apiClient.get('${ApiEndpoints.alerts}?limit=5'),
        _apiClient.get('${ApiEndpoints.checkins}?limit=3'),
      ]);

      // Parse dashboard
      _data = DashboardData.fromJson(results[0]);

      // Parse alerts
      final alertsJson = results[1]['alerts'] as List<dynamic>;
      _recentAlerts = alertsJson
          .map((json) => Alert.fromJson(json as Map<String, dynamic>))
          .toList();
      // Sort by severity (critical first)
      _recentAlerts.sort((a, b) {
        if (a.severity != b.severity) {
          return a.severity.index - b.severity.index;
        }
        return b.triggeredAt.compareTo(a.triggeredAt);
      });

      // Parse check-ins
      final checkinsJson = results[2]['checkins'] as List<dynamic>;
      _recentCheckins = checkinsJson
          .map((json) => SymptomCheckin.fromJson(json as Map<String, dynamic>))
          .toList();

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
