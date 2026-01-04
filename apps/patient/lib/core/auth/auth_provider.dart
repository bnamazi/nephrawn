import 'package:flutter/foundation.dart';
import '../api/api_exceptions.dart';
import '../models/user.dart';
import 'auth_service.dart';
import 'secure_storage.dart';

/// Authentication state provider
class AuthProvider extends ChangeNotifier {
  final AuthService _authService;
  final SecureStorageService _storage;

  User? _user;
  bool _isLoading = false;
  bool _isInitialized = false;
  String? _error;

  AuthProvider(this._authService, this._storage);

  /// Current user (null if not logged in)
  User? get user => _user;

  /// Whether user is authenticated
  bool get isAuthenticated => _user != null;

  /// Whether auth is loading
  bool get isLoading => _isLoading;

  /// Whether initial auth check is done
  bool get isInitialized => _isInitialized;

  /// Last error message
  String? get error => _error;

  /// Initialize - check for existing token
  Future<void> initialize() async {
    if (_isInitialized) return;

    _isLoading = true;
    notifyListeners();

    try {
      final hasToken = await _storage.hasToken();
      if (hasToken) {
        // Validate token by calling /patient/me
        _user = await _authService.getMe();
      }
    } on ApiException {
      // Token invalid, clear it
      await _storage.deleteToken();
      _user = null;
    } catch (e) {
      // Network error - keep token but mark as not logged in
      _user = null;
    } finally {
      _isLoading = false;
      _isInitialized = true;
      notifyListeners();
    }
  }

  /// Login with email and password
  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await _authService.login(email, password);
      await _storage.saveToken(result.token);
      _user = result.user;
      _isLoading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Error: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Register new patient
  Future<bool> register({
    required String email,
    required String password,
    required String name,
    required String dateOfBirth,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await _authService.register(
        email: email,
        password: password,
        name: name,
        dateOfBirth: dateOfBirth,
      );
      await _storage.saveToken(result.token);
      _user = result.user;
      _isLoading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'An unexpected error occurred';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Logout - clear token and user
  Future<void> logout() async {
    await _storage.deleteToken();
    _user = null;
    _error = null;
    notifyListeners();
  }

  /// Clear error message
  void clearError() {
    _error = null;
    notifyListeners();
  }

  /// Handle auth failure (called by API client on 401)
  void handleAuthFailure() {
    _storage.deleteToken();
    _user = null;
    _error = 'Session expired. Please log in again.';
    notifyListeners();
  }
}
