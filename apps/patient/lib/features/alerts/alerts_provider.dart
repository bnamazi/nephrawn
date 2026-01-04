import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/alert.dart';

/// Provider for fetching patient alerts
class AlertsProvider extends ChangeNotifier {
  final ApiClient _apiClient;

  List<Alert> _alerts = [];
  bool _isLoading = false;
  bool _hasLoaded = false;
  String? _error;
  AlertStatus? _statusFilter;

  AlertsProvider(this._apiClient);

  List<Alert> get alerts => _statusFilter == null
      ? _alerts
      : _alerts.where((a) => a.status == _statusFilter).toList();

  List<Alert> get allAlerts => _alerts;
  bool get isLoading => _isLoading;
  bool get hasLoaded => _hasLoaded;
  String? get error => _error;
  bool get isEmpty => alerts.isEmpty;
  AlertStatus? get statusFilter => _statusFilter;

  /// Get count of open alerts
  int get openCount => _alerts.where((a) => a.isOpen).length;

  /// Fetch alerts from the API
  Future<void> fetchAlerts({int limit = 50, bool refresh = false}) async {
    if (_isLoading) return;

    _isLoading = true;
    if (refresh) {
      _error = null;
    }
    notifyListeners();

    try {
      final response = await _apiClient.get(
        '${ApiEndpoints.alerts}?limit=$limit',
      );

      final alertsJson = response['alerts'] as List<dynamic>;
      _alerts = alertsJson
          .map((json) => Alert.fromJson(json as Map<String, dynamic>))
          .toList();

      // Sort by severity (critical first) then by date (newest first)
      _alerts.sort((a, b) {
        if (a.severity != b.severity) {
          return a.severity.index - b.severity.index;
        }
        return b.triggeredAt.compareTo(a.triggeredAt);
      });

      _hasLoaded = true;
      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Failed to load alerts: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Set status filter
  void setStatusFilter(AlertStatus? status) {
    _statusFilter = status;
    notifyListeners();
  }

  /// Refresh alerts
  Future<void> refresh() async {
    await fetchAlerts(refresh: true);
  }
}
