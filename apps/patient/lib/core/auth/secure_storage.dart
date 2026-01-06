import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Wrapper for secure storage of JWT tokens
/// Uses in-memory storage on web/desktop (dev), secure storage on iOS/Android
class SecureStorageService {
  static const _tokenKey = 'auth_token';

  final FlutterSecureStorage? _storage;

  // In-memory fallback for web and desktop development
  static String? _inMemoryToken;

  SecureStorageService()
      : _storage = _shouldUseInMemoryStorage()
            ? null // Skip secure storage on web/desktop for dev
            : const FlutterSecureStorage(
                aOptions: AndroidOptions(encryptedSharedPreferences: true),
                iOptions:
                    IOSOptions(accessibility: KeychainAccessibility.first_unlock),
              );

  static bool _shouldUseInMemoryStorage() {
    // Web doesn't support dart:io Platform
    if (kIsWeb) return true;

    // Desktop platforms use in-memory for development simplicity
    switch (defaultTargetPlatform) {
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
      case TargetPlatform.linux:
        return true;
      case TargetPlatform.iOS:
      case TargetPlatform.android:
      case TargetPlatform.fuchsia:
        return false;
    }
  }

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
