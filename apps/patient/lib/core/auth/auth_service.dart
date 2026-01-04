import '../api/api_client.dart';
import '../api/api_endpoints.dart';
import '../models/user.dart';

/// Service for authentication API calls
class AuthService {
  final ApiClient _apiClient;

  AuthService(this._apiClient);

  /// Login with email and password
  Future<AuthResponse> login(String email, String password) async {
    final response = await _apiClient.post(
      ApiEndpoints.login,
      data: {
        'email': email,
        'password': password,
      },
    );
    return AuthResponse.fromJson(response);
  }

  /// Register new patient
  Future<AuthResponse> register({
    required String email,
    required String password,
    required String name,
    required String dateOfBirth,
  }) async {
    final response = await _apiClient.post(
      ApiEndpoints.register,
      data: {
        'email': email,
        'password': password,
        'name': name,
        'dateOfBirth': dateOfBirth,
      },
    );
    return AuthResponse.fromJson(response);
  }

  /// Get current user profile (validates token)
  Future<User> getMe() async {
    final response = await _apiClient.get(ApiEndpoints.me);
    final patientData = response['patient'] as Map<String, dynamic>;
    // Add role since /patient/me doesn't return it
    patientData['role'] = 'patient';
    return User.fromJson(patientData);
  }
}
