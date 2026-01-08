import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:file_picker/file_picker.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/document.dart';

// Debug flag
const bool _debug = true;

class DocumentsProvider with ChangeNotifier {
  final ApiClient _api;

  List<Document> _documents = [];
  bool _isLoading = false;
  bool _isUploading = false;
  String? _error;

  DocumentsProvider(this._api);

  List<Document> get documents => _documents;
  bool get isLoading => _isLoading;
  bool get isUploading => _isUploading;
  String? get error => _error;

  Future<void> fetchDocuments({DocumentType? type}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final queryParams = <String, dynamic>{};
      if (type != null) {
        queryParams['type'] = type.toApiString();
      }

      final response = await _api.get(
        ApiEndpoints.documents,
        queryParams: queryParams.isNotEmpty ? queryParams : null,
      );

      final docs = response['documents'] as List<dynamic>;
      _documents = docs.map((d) => Document.fromJson(d as Map<String, dynamic>)).toList();
      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Failed to load documents';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> uploadDocument({
    required PlatformFile file,
    String? title,
    String? notes,
    DateTime? documentDate,
    DocumentType type = DocumentType.labResult,
  }) async {
    _isUploading = true;
    _error = null;
    notifyListeners();

    try {
      // Check for supported file type
      final mimeType = _getMimeType(file);
      if (mimeType == null) {
        _error = 'Unsupported file type. Please use PDF, JPG, PNG, or HEIC files.';
        _isUploading = false;
        notifyListeners();
        return false;
      }

      // Step 1: Get signed upload URL from backend
      final requestData = {
        'filename': file.name,
        'mimeType': mimeType,
        'sizeBytes': file.size,
        'type': type.toApiString(),
        if (title != null) 'title': title,
        if (notes != null) 'notes': notes,
        if (documentDate != null) 'documentDate': documentDate.toUtc().toIso8601String(),
      };

      if (_debug) {
        debugPrint('DocumentsProvider: Uploading document with data: $requestData');
        debugPrint('DocumentsProvider: file.name=${file.name}, file.size=${file.size}, file.extension=${file.extension}');
      }

      final uploadResponse = await _api.post(
        ApiEndpoints.documentsUploadUrl,
        data: requestData,
      );

      final uploadUrl = uploadResponse['uploadUrl'] as String;

      // Step 2: Read file bytes
      Uint8List bytes;
      if (kIsWeb) {
        bytes = file.bytes!;
      } else {
        bytes = await File(file.path!).readAsBytes();
      }

      // Step 3: Upload directly to signed URL
      await _api.uploadToSignedUrl(uploadUrl, bytes, mimeType);

      // Step 4: Refresh documents list
      await fetchDocuments();

      return true;
    } on ApiException catch (e) {
      if (_debug) {
        debugPrint('DocumentsProvider: Upload failed with ApiException: ${e.message}');
        debugPrint('DocumentsProvider: Status code: ${e.statusCode}');
        debugPrint('DocumentsProvider: Details: ${e.details}');
      }
      _error = e.message;
      if (e.details != null && e.details!.isNotEmpty) {
        // Show first validation error for better UX
        final firstError = e.details!.first;
        if (firstError is Map && firstError['message'] != null) {
          _error = firstError['message'] as String;
        }
      }
      return false;
    } catch (e) {
      if (_debug) {
        debugPrint('DocumentsProvider: Upload failed with exception: $e');
      }
      _error = 'Upload failed: ${e.toString()}';
      return false;
    } finally {
      _isUploading = false;
      notifyListeners();
    }
  }

  Future<bool> updateDocument(
    String id, {
    String? title,
    String? notes,
    DateTime? documentDate,
    DocumentType? type,
  }) async {
    try {
      await _api.put(
        ApiEndpoints.document(id),
        data: {
          if (title != null) 'title': title,
          if (notes != null) 'notes': notes,
          if (documentDate != null) 'documentDate': documentDate.toUtc().toIso8601String(),
          if (type != null) 'type': type.toApiString(),
        },
      );

      await fetchDocuments();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Update failed';
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteDocument(String id) async {
    try {
      await _api.delete(ApiEndpoints.document(id));
      _documents.removeWhere((d) => d.id == id);
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Delete failed';
      notifyListeners();
      return false;
    }
  }

  Future<String?> getDownloadUrl(String id) async {
    try {
      final response = await _api.get(ApiEndpoints.documentDownloadUrl(id));
      return response['downloadUrl'] as String?;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return null;
    } catch (e) {
      _error = 'Failed to get download URL';
      notifyListeners();
      return null;
    }
  }

  String? _getMimeType(PlatformFile file) {
    final extension = file.extension?.toLowerCase() ?? '';
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'heic':
        return 'image/heic';
      default:
        return null; // Unsupported file type
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
