import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/auth/auth_provider.dart';
import '../features/login/login_screen.dart';
import '../features/registration/registration_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/weight_history/weight_history_screen.dart';
import '../features/weight_entry/weight_entry_screen.dart';
import '../features/blood_pressure/bp_history_screen.dart';
import '../features/blood_pressure/bp_entry_screen.dart';

/// Route paths
class Routes {
  static const String login = '/login';
  static const String register = '/register';
  static const String home = '/';
  static const String profile = '/profile';
  static const String weight = '/weight';
  static const String addWeight = '/add-weight';
  static const String bp = '/bp';
  static const String addBP = '/add-bp';
}

/// Create app router with auth guards
GoRouter createRouter(AuthProvider authProvider) {
  return GoRouter(
    refreshListenable: authProvider,
    initialLocation: Routes.home,
    redirect: (context, state) {
      final isLoggedIn = authProvider.isAuthenticated;
      final isInitialized = authProvider.isInitialized;
      final isOnAuthPage = state.matchedLocation == Routes.login ||
          state.matchedLocation == Routes.register;

      // Wait for initialization
      if (!isInitialized) {
        return null;
      }

      // Not logged in and not on auth page -> redirect to login
      if (!isLoggedIn && !isOnAuthPage) {
        return Routes.login;
      }

      // Logged in and on auth page -> redirect to home
      if (isLoggedIn && isOnAuthPage) {
        return Routes.home;
      }

      return null;
    },
    routes: [
      GoRoute(
        path: Routes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: Routes.register,
        builder: (context, state) => const RegistrationScreen(),
      ),
      GoRoute(
        path: Routes.home,
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: Routes.profile,
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: Routes.weight,
        builder: (context, state) => const WeightHistoryScreen(),
      ),
      GoRoute(
        path: Routes.bp,
        builder: (context, state) => const BPHistoryScreen(),
      ),
      GoRoute(
        path: Routes.addWeight,
        builder: (context, state) => const WeightEntryScreen(),
      ),
      GoRoute(
        path: Routes.addBP,
        builder: (context, state) => const BPEntryScreen(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Text('Page not found: ${state.matchedLocation}'),
      ),
    ),
  );
}
