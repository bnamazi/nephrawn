import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_endpoints.dart';
import '../../core/api/api_exceptions.dart';
import '../../core/models/lab_report.dart';

class LabsProvider with ChangeNotifier {
  final ApiClient _api;

  List<LabReport> _reports = [];
  LabReport? _selectedReport;
  bool _isLoading = false;
  bool _isSaving = false;
  String? _error;

  LabsProvider(this._api);

  List<LabReport> get reports => _reports;
  LabReport? get selectedReport => _selectedReport;
  bool get isLoading => _isLoading;
  bool get isSaving => _isSaving;
  String? get error => _error;

  Future<void> fetchLabReports() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get(ApiEndpoints.labs);
      final data = response['labReports'] as List<dynamic>;
      _reports = data
          .map((r) => LabReport.fromJson(r as Map<String, dynamic>))
          .toList();
      _error = null;
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Failed to load lab reports';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<LabReport?> getLabReport(String id) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get(ApiEndpoints.lab(id));
      final report =
          LabReport.fromJson(response['labReport'] as Map<String, dynamic>);
      _selectedReport = report;
      _error = null;
      return report;
    } on ApiException catch (e) {
      _error = e.message;
      return null;
    } catch (e) {
      _error = 'Failed to load lab report';
      return null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> createLabReport({
    required DateTime collectedAt,
    DateTime? reportedAt,
    String? labName,
    String? orderingProvider,
    String? notes,
    String? documentId,
    List<Map<String, dynamic>>? results,
  }) async {
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      final data = {
        'collectedAt': collectedAt.toUtc().toIso8601String(),
        if (reportedAt != null)
          'reportedAt': reportedAt.toUtc().toIso8601String(),
        if (labName != null) 'labName': labName,
        if (orderingProvider != null) 'orderingProvider': orderingProvider,
        if (notes != null) 'notes': notes,
        if (documentId != null) 'documentId': documentId,
        if (results != null) 'results': results,
      };

      await _api.post(ApiEndpoints.labs, data: data);

      // Refresh the list
      await fetchLabReports();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      if (e.details != null && e.details!.isNotEmpty) {
        final firstError = e.details!.first;
        if (firstError is Map && firstError['message'] != null) {
          _error = firstError['message'] as String;
        }
      }
      return false;
    } catch (e) {
      _error = 'Failed to create lab report';
      return false;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  Future<bool> updateLabReport(
    String id, {
    DateTime? collectedAt,
    DateTime? reportedAt,
    String? labName,
    String? orderingProvider,
    String? notes,
  }) async {
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      final data = {
        if (collectedAt != null)
          'collectedAt': collectedAt.toUtc().toIso8601String(),
        if (reportedAt != null)
          'reportedAt': reportedAt.toUtc().toIso8601String(),
        if (labName != null) 'labName': labName,
        if (orderingProvider != null) 'orderingProvider': orderingProvider,
        if (notes != null) 'notes': notes,
      };

      await _api.put(ApiEndpoints.lab(id), data: data);

      // Refresh the list
      await fetchLabReports();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Failed to update lab report';
      return false;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  Future<bool> deleteLabReport(String id) async {
    try {
      await _api.delete(ApiEndpoints.lab(id));
      _reports.removeWhere((r) => r.id == id);
      if (_selectedReport?.id == id) {
        _selectedReport = null;
      }
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Failed to delete lab report';
      notifyListeners();
      return false;
    }
  }

  Future<bool> addLabResult(
    String reportId, {
    required String analyteName,
    String? analyteCode,
    required double value,
    required String unit,
    double? referenceRangeLow,
    double? referenceRangeHigh,
    LabResultFlag? flag,
  }) async {
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      final data = {
        'analyteName': analyteName,
        if (analyteCode != null) 'analyteCode': analyteCode,
        'value': value,
        'unit': unit,
        if (referenceRangeLow != null) 'referenceRangeLow': referenceRangeLow,
        if (referenceRangeHigh != null)
          'referenceRangeHigh': referenceRangeHigh,
        if (flag != null) 'flag': flag.toApiString(),
      };

      await _api.post(ApiEndpoints.labResults(reportId), data: data);

      // Refresh the selected report
      if (_selectedReport?.id == reportId) {
        await getLabReport(reportId);
      }
      // Refresh the list
      await fetchLabReports();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      if (e.details != null && e.details!.isNotEmpty) {
        final firstError = e.details!.first;
        if (firstError is Map && firstError['message'] != null) {
          _error = firstError['message'] as String;
        }
      }
      return false;
    } catch (e) {
      _error = 'Failed to add lab result';
      return false;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  Future<bool> updateLabResult(
    String reportId,
    String resultId, {
    String? analyteName,
    String? analyteCode,
    double? value,
    String? unit,
    double? referenceRangeLow,
    double? referenceRangeHigh,
    LabResultFlag? flag,
  }) async {
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      final data = {
        if (analyteName != null) 'analyteName': analyteName,
        if (analyteCode != null) 'analyteCode': analyteCode,
        if (value != null) 'value': value,
        if (unit != null) 'unit': unit,
        if (referenceRangeLow != null) 'referenceRangeLow': referenceRangeLow,
        if (referenceRangeHigh != null)
          'referenceRangeHigh': referenceRangeHigh,
        if (flag != null) 'flag': flag.toApiString(),
      };

      await _api.put(
        ApiEndpoints.labResult(reportId, resultId),
        data: data,
      );

      // Refresh the selected report
      if (_selectedReport?.id == reportId) {
        await getLabReport(reportId);
      }
      // Refresh the list
      await fetchLabReports();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      return false;
    } catch (e) {
      _error = 'Failed to update lab result';
      return false;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  Future<bool> deleteLabResult(String reportId, String resultId) async {
    try {
      await _api.delete(ApiEndpoints.labResult(reportId, resultId));

      // Refresh the selected report
      if (_selectedReport?.id == reportId) {
        await getLabReport(reportId);
      }
      // Refresh the list
      await fetchLabReports();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Failed to delete lab result';
      notifyListeners();
      return false;
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  void clearSelectedReport() {
    _selectedReport = null;
  }
}
