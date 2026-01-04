import 'package:dio/dio.dart';

/// Custom exception for API errors
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final List<dynamic>? details;

  ApiException({
    required this.message,
    this.statusCode,
    this.details,
  });

  /// Create from Dio error response
  factory ApiException.fromDioException(DioException error) {
    final response = error.response;

    if (response?.data is Map<String, dynamic>) {
      final data = response!.data as Map<String, dynamic>;
      return ApiException(
        message: data['error'] as String? ?? 'An error occurred',
        statusCode: response.statusCode,
        details: data['details'] as List<dynamic>?,
      );
    }

    // Network or other errors
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException(
          message: 'Connection timed out. Please try again.',
          statusCode: null,
        );
      case DioExceptionType.connectionError:
        return ApiException(
          message: 'Unable to connect to server. Check your connection.',
          statusCode: null,
        );
      default:
        return ApiException(
          message: error.message ?? 'An unexpected error occurred',
          statusCode: response?.statusCode,
        );
    }
  }

  @override
  String toString() => 'ApiException: $message (status: $statusCode)';
}
