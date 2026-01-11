import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/device_connection.dart';

class DevicesProvider with ChangeNotifier {
  final ApiClient _api;

  List<DeviceConnection> _connections = [];
  List<DeviceTypeInfo> _deviceTypes = [];
  bool _isLoading = false;
  bool _isSyncing = false;
  String? _error;
  String? _authUrl;

  DevicesProvider(this._api);

  List<DeviceConnection> get connections => _connections;
  List<DeviceTypeInfo> get deviceTypes => _deviceTypes;
  bool get isLoading => _isLoading;
  bool get isSyncing => _isSyncing;
  String? get error => _error;
  String? get authUrl => _authUrl;

  /// Check if Withings is connected
  bool get hasWithingsConnection =>
      _connections.any((c) => c.vendor == DeviceVendor.withings && c.isConnected);

  /// Get the Withings connection if it exists
  DeviceConnection? get withingsConnection {
    try {
      return _connections.firstWhere((c) => c.vendor == DeviceVendor.withings);
    } catch (_) {
      return null;
    }
  }

  /// Get blood pressure monitor device type
  DeviceTypeInfo? get bloodPressureMonitor {
    try {
      return _deviceTypes.firstWhere((d) => d.isBloodPressureMonitor);
    } catch (_) {
      return null;
    }
  }

  /// Get smart scale device type
  DeviceTypeInfo? get smartScale {
    try {
      return _deviceTypes.firstWhere((d) => d.isSmartScale);
    } catch (_) {
      return null;
    }
  }

  /// Fetch all device connections
  Future<void> fetchDevices() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get(ApiEndpoints.devices);

      // Parse vendor connections
      final connectionsData = response['devices'] as List<dynamic>;
      _connections = connectionsData
          .map((c) => DeviceConnection.fromJson(c as Map<String, dynamic>))
          .toList();

      // Parse device types
      final deviceTypesData = response['deviceTypes'] as List<dynamic>? ?? [];
      _deviceTypes = deviceTypesData
          .map((d) => DeviceTypeInfo.fromJson(d as Map<String, dynamic>))
          .toList();

      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Failed to load device connections';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Get the Withings authorization URL for OAuth flow
  Future<String?> getWithingsAuthUrl() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.post(ApiEndpoints.withingsAuthorize);
      _authUrl = response['authUrl'] as String?;
      _error = null;
      return _authUrl;
    } on ApiException catch (e) {
      _error = e.message;
      return null;
    } catch (e) {
      _error = 'Failed to get authorization URL';
      return null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Handle OAuth callback (called after user returns from Withings OAuth)
  Future<bool> handleWithingsCallback(String code, String state) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _api.get(
        ApiEndpoints.withingsCallback,
        queryParams: {'code': code, 'state': state},
      );
      // Refresh connections list
      await fetchDevices();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Failed to connect Withings device';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Disconnect Withings device
  Future<bool> disconnectWithings() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _api.delete(ApiEndpoints.withingsDevice);
      _connections.removeWhere((c) => c.vendor == DeviceVendor.withings);
      // Clear device types connection status
      _deviceTypes = _deviceTypes.map((d) => DeviceTypeInfo(
        id: d.id,
        name: d.name,
        icon: d.icon,
        connected: false,
        source: null,
        lastSync: null,
      )).toList();
      _error = null;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Failed to disconnect device';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Trigger manual sync for Withings
  Future<DeviceSyncResult?> syncWithings() async {
    _isSyncing = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.post(ApiEndpoints.withingsSync);
      final result = DeviceSyncResult.fromJson(response);
      // Refresh connections to get updated lastSyncAt
      await fetchDevices();
      return result;
    } on ApiException catch (e) {
      _error = e.message;
      return null;
    } catch (e) {
      _error = 'Failed to sync device';
      return null;
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  void clearAuthUrl() {
    _authUrl = null;
  }
}
