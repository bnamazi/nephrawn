/// API endpoint constants for Nephrawn backend
class ApiEndpoints {
  // Base URL - TODO: Make configurable per environment
  static const String baseUrl = 'http://localhost:3000';

  // Auth endpoints
  static const String login = '/auth/patient/login';
  static const String register = '/auth/patient/register';

  // Patient endpoints
  static const String me = '/patient/me';
  static const String clinics = '/patient/clinics';
  static const String measurements = '/patient/measurements';
  static const String bloodPressure = '/patient/measurements/blood-pressure';
  static const String checkins = '/patient/checkins';
  static const String alerts = '/patient/alerts';
  static const String dashboard = '/patient/dashboard';

  // Clinical profile endpoints
  static const String clinicalProfile = '/patient/profile';
  static const String clinicalProfileHistory = '/patient/profile/history';

  // Medication endpoints
  static const String medications = '/patient/medications';
  static const String medicationsSummary = '/patient/medications/summary';

  /// Get a specific medication
  static String medication(String id) => '/patient/medications/$id';

  /// Log adherence for a medication
  static String medicationLog(String id) => '/patient/medications/$id/log';

  /// Get adherence logs for a medication
  static String medicationLogs(String id) => '/patient/medications/$id/logs';

  // Document endpoints
  static const String documents = '/patient/documents';
  static const String documentsUploadUrl = '/patient/documents/upload-url';

  /// Get a specific document
  static String document(String id) => '/patient/documents/$id';

  /// Get download URL for a document
  static String documentDownloadUrl(String id) => '/patient/documents/$id/download-url';

  // Lab endpoints
  static const String labs = '/patient/labs';

  /// Get a specific lab report
  static String lab(String id) => '/patient/labs/$id';

  /// Get lab results for a report
  static String labResults(String id) => '/patient/labs/$id/results';

  /// Get/update/delete a specific lab result
  static String labResult(String labId, String resultId) =>
      '/patient/labs/$labId/results/$resultId';

  /// Leave a clinic
  static String leaveClinic(String clinicId) => '/patient/clinics/$clinicId/leave';

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

  // Device endpoints
  static const String devices = '/patient/devices';
  static const String withingsDevice = '/patient/devices/withings';
  static const String withingsAuthorize = '/patient/devices/withings/authorize';
  static const String withingsCallback = '/patient/devices/withings/callback';
  static const String withingsSync = '/patient/devices/withings/sync';

  // Body composition
  static const String bodyComposition = '/patient/body-composition';
}
