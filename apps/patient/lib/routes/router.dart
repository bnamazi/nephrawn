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
import '../features/symptom_checkin/symptom_checkin_screen.dart';
import '../features/symptom_checkin/symptom_entry_screen.dart';
import '../features/alerts/alerts_screen.dart';
import '../features/join_clinic/join_clinic_screen.dart';
import '../features/join_clinic/claim_invite_screen.dart';
import '../features/join_clinic/claim_success_screen.dart';
import '../features/clinics/clinics_screen.dart';
import '../features/clinical_profile/clinical_profile_screen.dart';
import '../features/clinical_profile/clinical_profile_edit_screen.dart';

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
  static const String checkins = '/checkins';
  static const String addCheckin = '/add-checkin';
  static const String alerts = '/alerts';
  // Clinics
  static const String clinics = '/clinics';
  // Invite claim flow
  static const String joinClinic = '/join-clinic';
  static const String claimInvite = '/claim-invite';
  static const String claimSuccess = '/claim-success';
  // Health profile
  static const String healthProfile = '/health-profile';
  static const String editHealthProfile = '/edit-health-profile';
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
          state.matchedLocation == Routes.register ||
          state.matchedLocation == Routes.joinClinic ||
          state.matchedLocation == Routes.claimInvite ||
          state.matchedLocation == Routes.claimSuccess;

      // Wait for initialization
      if (!isInitialized) {
        return null;
      }

      // Not logged in and not on auth page -> redirect to login
      if (!isLoggedIn && !isOnAuthPage) {
        return Routes.login;
      }

      // Logged in and on login/register page -> redirect to home
      // (but allow staying on claim success to see the confirmation)
      if (isLoggedIn &&
          (state.matchedLocation == Routes.login ||
              state.matchedLocation == Routes.register)) {
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
      GoRoute(
        path: Routes.checkins,
        builder: (context, state) => const SymptomCheckinScreen(),
      ),
      GoRoute(
        path: Routes.addCheckin,
        builder: (context, state) => const SymptomEntryScreen(),
      ),
      GoRoute(
        path: Routes.alerts,
        builder: (context, state) => const AlertsScreen(),
      ),
      GoRoute(
        path: Routes.clinics,
        builder: (context, state) => const ClinicsScreen(),
      ),
      GoRoute(
        path: Routes.joinClinic,
        builder: (context, state) => const JoinClinicScreen(),
      ),
      GoRoute(
        path: Routes.claimInvite,
        builder: (context, state) => const ClaimInviteScreen(),
      ),
      GoRoute(
        path: Routes.claimSuccess,
        builder: (context, state) => const ClaimSuccessScreen(),
      ),
      GoRoute(
        path: Routes.healthProfile,
        builder: (context, state) => const ClinicalProfileScreen(),
      ),
      GoRoute(
        path: Routes.editHealthProfile,
        builder: (context, state) => const ClinicalProfileEditScreen(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Text('Page not found: ${state.matchedLocation}'),
      ),
    ),
  );
}
