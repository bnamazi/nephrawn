import 'dart:io' show Platform;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Wrapper for secure storage of JWT tokens
/// Uses in-memory storage on macOS (dev), secure storage on iOS/Android
class SecureStorageService {
  static const _tokenKey = 'auth_token';

  final FlutterSecureStorage? _storage;

  // In-memory fallback for macOS development
  static String? _inMemoryToken;

  SecureStorageService()
      : _storage = Platform.isMacOS
            ? null  // Skip secure storage on macOS for dev
            : const FlutterSecureStorage(
                aOptions: AndroidOptions(encryptedSharedPreferences: true),
                iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
              );

  /// Save JWT token
  Future<void> saveToken(String token) async {
    if (_storage != null) {
      await _storage.write(key: _tokenKey, value: token);
    } else {
      _inMemoryToken = token;
    }
  }

  /// Get stored JWT token
  Future<String?> getToken() async {
    if (_storage != null) {
      return await _storage.read(key: _tokenKey);
    }
    return _inMemoryToken;
  }

  /// Delete stored JWT token
  Future<void> deleteToken() async {
    if (_storage != null) {
      await _storage.delete(key: _tokenKey);
    } else {
      _inMemoryToken = null;
    }
  }

  /// Check if token exists
  Future<bool> hasToken() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }
}
