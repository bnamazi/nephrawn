/// API endpoint constants for Nephrawn backend
class ApiEndpoints {
  // Base URL - TODO: Make configurable per environment
  static const String baseUrl = 'http://localhost:3000';

  // Auth endpoints
  static const String login = '/auth/patient/login';
  static const String register = '/auth/patient/register';

  // Patient endpoints
  static const String me = '/patient/me';
  static const String measurements = '/patient/measurements';
  static const String bloodPressure = '/patient/measurements/blood-pressure';
  static const String checkins = '/patient/checkins';
  static const String alerts = '/patient/alerts';
  static const String dashboard = '/patient/dashboard';

  /// Get chart data for a specific type
  static String charts(String type) => '/patient/charts/$type';

  /// Get summary for a specific type
  static String summary(String type) => '/patient/summary/$type';

  // Invite endpoints (public)
  /// Validate an invite code
  static String validateInvite(String code) => '/auth/invite/$code';

  /// Claim an invite (new patient registration)
  static String claimInvite(String code) => '/auth/invite/$code/claim';

  /// Claim an invite (existing patient - authenticated)
  static String claimExistingInvite(String code) => '/auth/invite/$code/claim-existing';
}
