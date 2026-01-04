import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app.dart';
import 'core/api/api_client.dart';
import 'core/auth/auth_provider.dart';
import 'core/auth/auth_service.dart';
import 'core/auth/secure_storage.dart';
import 'core/error/error_handler.dart';

void main() {
  // Set up global error handling
  setupErrorHandling();

  // Run app in a zone to catch async errors
  runZonedGuarded(
    () {
      WidgetsFlutterBinding.ensureInitialized();

      // Initialize services
      final secureStorage = SecureStorageService();
      final apiClient = ApiClient(secureStorage);
      final authService = AuthService(apiClient);

      runApp(
        MultiProvider(
          providers: [
            // Auth provider
            ChangeNotifierProvider<AuthProvider>(
              create: (_) {
                final authProvider = AuthProvider(authService, secureStorage);
                // Wire up auth failure callback
                apiClient.onAuthFailure = () => authProvider.handleAuthFailure();
                return authProvider;
              },
            ),
            // API client (for other services to use)
            Provider<ApiClient>.value(value: apiClient),
          ],
          child: const NephrawnApp(),
        ),
      );
    },
    (error, stack) {
      // This catches errors that escape the Flutter framework
      debugPrint('Unhandled error: $error');
      debugPrint('Stack trace: $stack');
    },
  );
}
