import 'package:flutter/foundation.dart';
import '../../core/invite/invite_service.dart';
import '../../core/auth/auth_provider.dart';

/// State for the join clinic flow
enum JoinClinicState {
  initial,
  validating,
  validated,
  claiming,
  success,
  error,
}

/// Provider for managing the join clinic flow
class JoinClinicProvider extends ChangeNotifier {
  final InviteService _inviteService;
  final AuthProvider _authProvider;

  JoinClinicState _state = JoinClinicState.initial;
  String? _error;
  String? _inviteCode;
  InviteValidation? _validation;
  ClaimResult? _claimResult;

  JoinClinicProvider(this._inviteService, this._authProvider);

  JoinClinicState get state => _state;
  String? get error => _error;
  String? get inviteCode => _inviteCode;
  InviteValidation? get validation => _validation;
  ClaimResult? get claimResult => _claimResult;
  String? get clinicName => _validation?.clinicName;

  bool get isLoading =>
      _state == JoinClinicState.validating || _state == JoinClinicState.claiming;

  /// Validate an invite code
  Future<bool> validateCode(String code) async {
    _state = JoinClinicState.validating;
    _error = null;
    _inviteCode = code;
    notifyListeners();

    try {
      _validation = await _inviteService.validateInvite(code);

      if (_validation!.valid) {
        _state = JoinClinicState.validated;
        notifyListeners();
        return true;
      } else {
        _state = JoinClinicState.error;
        _error = _validation!.error ?? 'Invalid invite code';
        notifyListeners();
        return false;
      }
    } catch (e) {
      _state = JoinClinicState.error;
      _error = 'Failed to validate invite code';
      notifyListeners();
      return false;
    }
  }

  /// Claim the invite for a new patient
  Future<bool> claimInvite({
    required String dateOfBirth,
    required String email,
    required String password,
    required String name,
  }) async {
    if (_inviteCode == null) {
      _error = 'No invite code set';
      return false;
    }

    _state = JoinClinicState.claiming;
    _error = null;
    notifyListeners();

    try {
      _claimResult = await _inviteService.claimInvite(
        code: _inviteCode!,
        dateOfBirth: dateOfBirth,
        email: email,
        password: password,
        name: name,
      );

      if (_claimResult!.success && _claimResult!.token != null) {
        // Save the token and set up auth
        await _authProvider.setTokenFromClaim(_claimResult!.token!);
        _state = JoinClinicState.success;
        notifyListeners();
        return true;
      } else {
        _state = JoinClinicState.error;
        _error = _claimResult!.error ?? 'Failed to claim invite';
        notifyListeners();
        return false;
      }
    } catch (e) {
      _state = JoinClinicState.error;
      _error = 'Failed to claim invite';
      notifyListeners();
      return false;
    }
  }

  /// Reset the flow
  void reset() {
    _state = JoinClinicState.initial;
    _error = null;
    _inviteCode = null;
    _validation = null;
    _claimResult = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
