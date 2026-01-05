import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/clinic/clinic_service.dart';
import '../../core/models/clinic.dart';

/// Screen showing the clinics the patient is enrolled in
class ClinicsScreen extends StatefulWidget {
  const ClinicsScreen({super.key});

  @override
  State<ClinicsScreen> createState() => _ClinicsScreenState();
}

class _ClinicsScreenState extends State<ClinicsScreen> {
  late final ClinicService _clinicService;
  List<EnrolledClinic> _clinics = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _clinicService = ClinicService(context.read<ApiClient>());
    _fetchClinics();
  }

  Future<void> _fetchClinics() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final clinics = await _clinicService.getClinics();
      if (mounted) {
        setState(() {
          _clinics = clinics;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _leaveClinic(EnrolledClinic clinic) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Leave Clinic'),
        content: Text(
          'Are you sure you want to leave ${clinic.name}?\n\n'
          'Your clinician will no longer be able to view your health data.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Leave'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await _clinicService.leaveClinic(clinic.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('You have left ${clinic.name}')),
        );
        _fetchClinics();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to leave clinic: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Clinics'),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 48, color: Colors.red.shade400),
            const SizedBox(height: 16),
            Text(_error!),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _fetchClinics,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_clinics.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.local_hospital_outlined, size: 64, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text(
              'No clinics yet',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: Colors.grey.shade600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Ask your healthcare provider for an invite code',
              style: TextStyle(color: Colors.grey.shade500),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchClinics,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _clinics.length,
        itemBuilder: (context, index) {
          final clinic = _clinics[index];
          return _ClinicCard(
            clinic: clinic,
            onLeave: () => _leaveClinic(clinic),
          );
        },
      ),
    );
  }
}

class _ClinicCard extends StatelessWidget {
  final EnrolledClinic clinic;
  final VoidCallback onLeave;

  const _ClinicCard({
    required this.clinic,
    required this.onLeave,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: Theme.of(context).primaryColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    Icons.local_hospital,
                    color: Theme.of(context).primaryColor,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              clinic.name,
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                            ),
                          ),
                          if (clinic.isPrimary)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.blue.shade50,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                'Primary',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.blue.shade700,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Dr. ${clinic.clinician.name}',
                        style: TextStyle(color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.calendar_today_outlined, size: 16, color: Colors.grey.shade500),
                const SizedBox(width: 8),
                Text(
                  'Enrolled ${DateFormat('MMM d, yyyy').format(clinic.enrolledAt)}',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                ),
              ],
            ),
            if (clinic.phone != null || clinic.email != null) ...[
              const SizedBox(height: 8),
              if (clinic.phone != null)
                Row(
                  children: [
                    Icon(Icons.phone_outlined, size: 16, color: Colors.grey.shade500),
                    const SizedBox(width: 8),
                    Text(
                      clinic.phone!,
                      style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              if (clinic.email != null) ...[
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.email_outlined, size: 16, color: Colors.grey.shade500),
                    const SizedBox(width: 8),
                    Text(
                      clinic.email!,
                      style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ],
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: onLeave,
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.red.shade600,
                  side: BorderSide(color: Colors.red.shade300),
                ),
                child: const Text('Leave Clinic'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
