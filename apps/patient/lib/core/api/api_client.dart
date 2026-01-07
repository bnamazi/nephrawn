import 'package:dio/dio.dart';
import 'api_endpoints.dart';
import 'api_exceptions.dart';
import '../auth/secure_storage.dart';

/// HTTP client with JWT auth interceptor
class ApiClient {
  late final Dio _dio;
  final SecureStorageService _storage;

  /// Callback to trigger when auth fails (401)
  void Function()? onAuthFailure;

  ApiClient(this._storage) {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    _dio.interceptors.add(_AuthInterceptor(_storage, () => onAuthFailure?.call()));
  }

  /// POST request
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? data,
  }) async {
    try {
      final response = await _dio.post(path, data: data);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  /// GET request
  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? queryParams,
  }) async {
    try {
      final response = await _dio.get(path, queryParameters: queryParams);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  /// PUT request
  Future<Map<String, dynamic>> put(
    String path, {
    Map<String, dynamic>? data,
  }) async {
    try {
      final response = await _dio.put(path, data: data);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

/// Interceptor to attach JWT token to requests
/// Uses QueuedInterceptor to properly handle async token fetching
/// This prevents race conditions where requests could be sent before token is attached
class _AuthInterceptor extends QueuedInterceptor {
  final SecureStorageService _storage;
  final void Function() _onAuthFailure;

  _AuthInterceptor(this._storage, this._onAuthFailure);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Skip auth header for login/register endpoints
    if (options.path.contains('/auth/')) {
      handler.next(options);
      return;
    }

    try {
      final token = await _storage.getToken();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    } catch (e) {
      // If token fetch fails, proceed without auth header
      // The request will fail with 401 if auth is required
      handler.next(options);
    }
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // Token expired or invalid
      _onAuthFailure();
    }
    handler.next(err);
  }
}
