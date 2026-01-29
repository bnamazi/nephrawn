import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/models/clinical_profile.dart';
import '../../core/models/toxin.dart';
import 'clinical_profile_provider.dart';

/// Screen for viewing and editing clinical profile
class ClinicalProfileScreen extends StatelessWidget {
  const ClinicalProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) =>
          ClinicalProfileProvider(context.read<ApiClient>())..fetchProfile(),
      child: const _ClinicalProfileContent(),
    );
  }
}

class _ClinicalProfileContent extends StatelessWidget {
  const _ClinicalProfileContent();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Health Profile'),
        actions: [
          Consumer<ClinicalProfileProvider>(
            builder: (context, provider, _) {
              if (provider.profile != null) {
                return IconButton(
                  icon: const Icon(Icons.edit),
                  onPressed: () => context.push('/edit-health-profile'),
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
      body: Consumer<ClinicalProfileProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.error != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline, size: 48, color: Colors.red.shade400),
                  const SizedBox(height: 16),
                  Text(provider.error!),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.fetchProfile(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          final profile = provider.profile;
          if (profile == null) {
            return _buildEmptyState(context);
          }

          return _buildProfileContent(context, profile, provider.completeness);
        },
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.medical_information_outlined,
              size: 64, color: Colors.grey.shade400),
          const SizedBox(height: 16),
          Text(
            'No health profile yet',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'Add your health information to help\nyour care team monitor your condition.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey.shade600),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () => context.push('/edit-health-profile'),
            icon: const Icon(Icons.add),
            label: const Text('Add Health Profile'),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileContent(
    BuildContext context,
    ClinicalProfile profile,
    ProfileCompleteness? completeness,
  ) {
    final provider = context.watch<ClinicalProfileProvider>();

    return RefreshIndicator(
      onRefresh: () => context.read<ClinicalProfileProvider>().fetchProfile(),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Completeness banner
            if (completeness != null && completeness.profileScore < 100)
              _buildCompletenessBanner(context, completeness),

            // CKD Status Section
            _buildSection(
              context,
              title: 'Kidney Status',
              icon: Icons.bloodtype_outlined,
              children: [
                _buildInfoRow('CKD Stage', profile.ckdStageEffectiveLabel ?? 'Not set'),
                if (profile.ckdStageSource != null)
                  _buildInfoRow(
                    'Source',
                    profile.ckdStageSource == 'clinician'
                        ? 'Verified by clinician'
                        : 'Self-reported',
                  ),
                _buildInfoRow('Primary Cause',
                    profile.primaryEtiologyLabel ?? 'Not set'),
                _buildInfoRow(
                    'Dialysis', profile.dialysisStatusLabel ?? 'Not set'),
                _buildInfoRow('Transplant',
                    profile.transplantStatus == 'NONE' ? 'None' :
                    profile.transplantStatus == 'LISTED' ? 'Listed' :
                    profile.transplantStatus == 'RECEIVED' ? 'Received' : 'Not set'),
              ],
            ),

            const SizedBox(height: 16),

            // Demographics Section
            _buildSection(
              context,
              title: 'Demographics',
              icon: Icons.person_outline,
              children: [
                _buildInfoRow('Sex', ProfileLabels.sex[profile.sex] ?? 'Not set'),
                _buildInfoRow('Height', profile.heightDisplay ?? 'Not set'),
              ],
            ),

            const SizedBox(height: 16),

            // Comorbidities Section
            _buildSection(
              context,
              title: 'Other Conditions',
              icon: Icons.favorite_outline,
              children: [
                _buildInfoRow(
                  'Heart Failure',
                  profile.hasHeartFailure
                      ? (profile.heartFailureLabel ?? 'Yes')
                      : 'No',
                ),
                _buildInfoRow(
                  'Diabetes',
                  profile.diabetesLabel ?? 'None',
                ),
                _buildInfoRow(
                  'Hypertension',
                  profile.hasHypertension ? 'Yes' : 'No',
                ),
                if (profile.otherConditions.isNotEmpty)
                  _buildInfoRow(
                    'Other',
                    profile.otherConditions.join(', '),
                  ),
              ],
            ),

            const SizedBox(height: 16),

            // Medications Section
            _buildSection(
              context,
              title: 'Current Medications',
              icon: Icons.medication_outlined,
              children: [
                _buildMedicationRow('Diuretics (water pills)',
                    profile.medications.onDiuretics),
                _buildMedicationRow(
                    'ACE/ARB inhibitors', profile.medications.onAceArbInhibitor),
                _buildMedicationRow(
                    'SGLT2 inhibitors', profile.medications.onSglt2Inhibitor),
                _buildMedicationRow('MRA', profile.medications.onMra),
                _buildMedicationRow('Insulin', profile.medications.onInsulin),
                _buildMedicationRow('NSAIDs', profile.medications.onNsaids,
                    warning: profile.medications.onNsaids),
              ],
            ),

            const SizedBox(height: 16),

            // Substances to Limit Section
            _buildToxinsSection(context, provider.toxinRecords, provider.toxinsLoading),

            const SizedBox(height: 24),

            // Edit button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () => context.push('/edit-health-profile'),
                icon: const Icon(Icons.edit),
                label: const Text('Edit Health Profile'),
              ),
            ),

            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildCompletenessBanner(
      BuildContext context, ProfileCompleteness completeness) {
    final actionableFields = _getPatientActionableFields(completeness.missingCritical);
    final hasClinicianOnlyFields = completeness.missingCritical.length > actionableFields.length;

    // Don't show banner if profile is complete from patient's perspective
    if (actionableFields.isEmpty && !hasClinicianOnlyFields) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: actionableFields.isEmpty ? Colors.blue.shade50 : Colors.amber.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: actionableFields.isEmpty ? Colors.blue.shade200 : Colors.amber.shade200,
        ),
      ),
      child: Row(
        children: [
          Icon(
            actionableFields.isEmpty ? Icons.check_circle_outline : Icons.info_outline,
            color: actionableFields.isEmpty ? Colors.blue.shade700 : Colors.amber.shade700,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (actionableFields.isNotEmpty) ...[
                  Text(
                    'Profile ${completeness.profileScore}% complete',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.amber.shade900,
                    ),
                  ),
                  Text(
                    'Please add: ${_formatMissingFields(actionableFields)}',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.amber.shade800,
                    ),
                  ),
                ] else if (hasClinicianOnlyFields) ...[
                  Text(
                    'Your profile is complete',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.blue.shade900,
                    ),
                  ),
                  Text(
                    'Your care team will verify your CKD stage',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.blue.shade700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Get patient-actionable missing fields (exclude clinician-only fields)
  List<String> _getPatientActionableFields(List<String> fields) {
    // Fields that only clinicians can set - don't show these to patients
    const clinicianOnlyFields = {'ckdStageClinician'};
    return fields.where((f) => !clinicianOnlyFields.contains(f)).toList();
  }

  String _formatMissingFields(List<String> fields) {
    final labels = {
      'ckdStageSelfReported': 'CKD Stage',
      'sex': 'Sex',
      'heightCm': 'Height',
      'primaryEtiology': 'Primary Cause',
    };
    return fields.map((f) => labels[f] ?? f).join(', ');
  }

  Widget _buildSection(
    BuildContext context, {
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 20, color: Theme.of(context).primaryColor),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade600)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildMedicationRow(String name, bool isOn, {bool warning = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            isOn ? Icons.check_circle : Icons.cancel_outlined,
            size: 20,
            color: isOn
                ? (warning ? Colors.orange : Colors.green)
                : Colors.grey.shade400,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              name,
              style: TextStyle(
                color: warning && isOn ? Colors.orange.shade700 : null,
                fontWeight: warning && isOn ? FontWeight.w500 : null,
              ),
            ),
          ),
          if (warning && isOn)
            Tooltip(
              message: 'NSAIDs can affect kidney function',
              child: Icon(Icons.warning_amber, size: 16, color: Colors.orange),
            ),
        ],
      ),
    );
  }

  Widget _buildToxinsSection(
      BuildContext context, List<PatientToxinRecord> records, bool isLoading) {
    if (isLoading) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Center(
            child: SizedBox(
              height: 24,
              width: 24,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        ),
      );
    }

    if (records.isEmpty) {
      return const SizedBox.shrink();
    }

    return _buildSection(
      context,
      title: 'Substances to Limit',
      icon: Icons.warning_amber_outlined,
      children: records.map((record) => _buildToxinRow(record)).toList(),
    );
  }

  Widget _buildToxinRow(PatientToxinRecord record) {
    final category = record.toxinCategory;
    final riskLevel = record.effectiveRiskLevel;

    Color riskColor;
    switch (riskLevel) {
      case ToxinRiskLevel.high:
        riskColor = Colors.red;
        break;
      case ToxinRiskLevel.moderate:
        riskColor = Colors.orange;
        break;
      case ToxinRiskLevel.low:
        riskColor = Colors.yellow.shade700;
        break;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: riskColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: riskColor.withOpacity(0.5)),
                ),
                child: Text(
                  riskLevel.displayName,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: riskColor,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  category.name,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
              ),
              if (record.isEducated)
                Icon(Icons.check_circle, size: 18, color: Colors.green),
            ],
          ),
          if (category.description != null) ...[
            const SizedBox(height: 4),
            Text(
              category.description!,
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade600,
              ),
            ),
          ],
          if (category.examples != null) ...[
            const SizedBox(height: 2),
            Text(
              'Examples: ${category.examples}',
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey.shade500,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
          if (record.isEducated && record.educatedAt != null) ...[
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.school_outlined, size: 14, color: Colors.green.shade600),
                const SizedBox(width: 4),
                Text(
                  'Educated on ${_formatDate(record.educatedAt!)}',
                  style: TextStyle(fontSize: 11, color: Colors.green.shade700),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.month}/${date.day}/${date.year}';
  }
}
