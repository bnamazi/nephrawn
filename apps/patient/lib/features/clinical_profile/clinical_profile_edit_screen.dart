import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/models/clinical_profile.dart';
import 'clinical_profile_provider.dart';

/// Screen for editing clinical profile
class ClinicalProfileEditScreen extends StatelessWidget {
  const ClinicalProfileEditScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) =>
          ClinicalProfileProvider(context.read<ApiClient>())..fetchProfile(),
      child: const _EditContent(),
    );
  }
}

class _EditContent extends StatefulWidget {
  const _EditContent();

  @override
  State<_EditContent> createState() => _EditContentState();
}

class _EditContentState extends State<_EditContent> {
  final _formKey = GlobalKey<FormState>();

  // Form values
  String? _sex;
  String? _ckdStage;
  String? _primaryEtiology;
  String? _dialysisStatus;
  String? _diabetesType;
  String? _transplantStatus;
  bool _hasHeartFailure = false;
  bool _hasHypertension = false;
  bool _onDiuretics = false;
  bool _onAceArbInhibitor = false;
  bool _onSglt2Inhibitor = false;
  bool _onNsaids = false;
  bool _onMra = false;
  bool _onInsulin = false;

  final _heightController = TextEditingController();
  bool _initialized = false;

  @override
  void dispose() {
    _heightController.dispose();
    super.dispose();
  }

  void _initializeFromProfile(ClinicalProfile? profile) {
    if (_initialized || profile == null) return;
    _initialized = true;

    _sex = profile.sex;
    _ckdStage = profile.ckdStageSelfReported;
    _primaryEtiology = profile.primaryEtiology;
    _dialysisStatus = profile.dialysisStatus;
    _diabetesType = profile.diabetesType;
    _transplantStatus = profile.transplantStatus;
    _hasHeartFailure = profile.hasHeartFailure;
    _hasHypertension = profile.hasHypertension;
    _onDiuretics = profile.medications.onDiuretics;
    _onAceArbInhibitor = profile.medications.onAceArbInhibitor;
    _onSglt2Inhibitor = profile.medications.onSglt2Inhibitor;
    _onNsaids = profile.medications.onNsaids;
    _onMra = profile.medications.onMra;
    _onInsulin = profile.medications.onInsulin;

    if (profile.heightCm != null) {
      _heightController.text = profile.heightCm.toString();
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    final provider = context.read<ClinicalProfileProvider>();

    final data = <String, dynamic>{};

    if (_sex != null) data['sex'] = _sex;
    if (_ckdStage != null) data['ckdStageSelfReported'] = _ckdStage;
    if (_primaryEtiology != null) data['primaryEtiology'] = _primaryEtiology;
    if (_dialysisStatus != null) data['dialysisStatus'] = _dialysisStatus;
    if (_diabetesType != null) data['diabetesType'] = _diabetesType;
    if (_transplantStatus != null) data['transplantStatus'] = _transplantStatus;
    data['hasHeartFailure'] = _hasHeartFailure;
    data['hasHypertension'] = _hasHypertension;
    data['onDiuretics'] = _onDiuretics;
    data['onAceArbInhibitor'] = _onAceArbInhibitor;
    data['onSglt2Inhibitor'] = _onSglt2Inhibitor;
    data['onNsaids'] = _onNsaids;
    data['onMra'] = _onMra;
    data['onInsulin'] = _onInsulin;

    if (_heightController.text.isNotEmpty) {
      data['heightCm'] = int.tryParse(_heightController.text);
    }

    final success = await provider.updateProfile(data);

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated successfully')),
      );
      context.pop();
    } else if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.error ?? 'Failed to save'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Health Profile'),
      ),
      body: Consumer<ClinicalProfileProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          // Initialize form from existing profile
          _initializeFromProfile(provider.profile);

          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // CKD Stage Section
                _buildSectionHeader('Kidney Status'),
                _buildDropdown(
                  label: 'CKD Stage',
                  value: _ckdStage,
                  items: ProfileLabels.ckdStage,
                  onChanged: (v) => setState(() => _ckdStage = v),
                ),
                const SizedBox(height: 12),
                _buildDropdown(
                  label: 'Primary Cause',
                  value: _primaryEtiology,
                  items: ProfileLabels.etiology,
                  onChanged: (v) => setState(() => _primaryEtiology = v),
                ),
                const SizedBox(height: 12),
                _buildDropdown(
                  label: 'Dialysis Status',
                  value: _dialysisStatus,
                  items: ProfileLabels.dialysisStatus,
                  onChanged: (v) => setState(() => _dialysisStatus = v),
                ),
                const SizedBox(height: 12),
                _buildDropdown(
                  label: 'Transplant Status',
                  value: _transplantStatus,
                  items: ProfileLabels.transplantStatus,
                  onChanged: (v) => setState(() => _transplantStatus = v),
                ),

                const SizedBox(height: 24),

                // Demographics Section
                _buildSectionHeader('Demographics'),
                _buildDropdown(
                  label: 'Sex',
                  value: _sex,
                  items: ProfileLabels.sex,
                  onChanged: (v) => setState(() => _sex = v),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _heightController,
                  decoration: const InputDecoration(
                    labelText: 'Height (cm)',
                    hintText: 'e.g., 170',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.number,
                  validator: (v) {
                    if (v == null || v.isEmpty) return null;
                    final h = int.tryParse(v);
                    if (h == null || h < 50 || h > 300) {
                      return 'Enter a valid height (50-300 cm)';
                    }
                    return null;
                  },
                ),

                const SizedBox(height: 24),

                // Comorbidities Section
                _buildSectionHeader('Other Conditions'),
                _buildSwitch(
                  label: 'Heart Failure',
                  value: _hasHeartFailure,
                  onChanged: (v) => setState(() => _hasHeartFailure = v),
                ),
                _buildSwitch(
                  label: 'Hypertension',
                  value: _hasHypertension,
                  onChanged: (v) => setState(() => _hasHypertension = v),
                ),
                const SizedBox(height: 12),
                _buildDropdown(
                  label: 'Diabetes',
                  value: _diabetesType,
                  items: ProfileLabels.diabetesType,
                  onChanged: (v) => setState(() => _diabetesType = v),
                ),

                const SizedBox(height: 24),

                // Medications Section
                _buildSectionHeader('Current Medications'),
                _buildSwitch(
                  label: 'Diuretics (water pills)',
                  value: _onDiuretics,
                  onChanged: (v) => setState(() => _onDiuretics = v),
                ),
                _buildSwitch(
                  label: 'ACE/ARB inhibitors',
                  value: _onAceArbInhibitor,
                  onChanged: (v) => setState(() => _onAceArbInhibitor = v),
                ),
                _buildSwitch(
                  label: 'SGLT2 inhibitors',
                  value: _onSglt2Inhibitor,
                  onChanged: (v) => setState(() => _onSglt2Inhibitor = v),
                ),
                _buildSwitch(
                  label: 'MRA (e.g., Spironolactone)',
                  value: _onMra,
                  onChanged: (v) => setState(() => _onMra = v),
                ),
                _buildSwitch(
                  label: 'Insulin',
                  value: _onInsulin,
                  onChanged: (v) => setState(() => _onInsulin = v),
                ),
                _buildSwitch(
                  label: 'NSAIDs (e.g., Ibuprofen)',
                  value: _onNsaids,
                  onChanged: (v) => setState(() => _onNsaids = v),
                  warning: _onNsaids,
                ),
                if (_onNsaids)
                  Padding(
                    padding: const EdgeInsets.only(left: 16, bottom: 8),
                    child: Text(
                      'NSAIDs can affect kidney function. Discuss with your doctor.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.orange.shade700,
                      ),
                    ),
                  ),

                const SizedBox(height: 32),

                // Save button
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: provider.isSaving ? null : _saveProfile,
                    child: provider.isSaving
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Save Changes'),
                  ),
                ),

                const SizedBox(height: 16),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: Theme.of(context).primaryColor,
            ),
      ),
    );
  }

  Widget _buildDropdown({
    required String label,
    required String? value,
    required Map<String, String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
      items: [
        const DropdownMenuItem(value: null, child: Text('Not set')),
        ...items.entries.map(
          (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
        ),
      ],
      onChanged: onChanged,
    );
  }

  Widget _buildSwitch({
    required String label,
    required bool value,
    required ValueChanged<bool> onChanged,
    bool warning = false,
  }) {
    return SwitchListTile(
      title: Text(
        label,
        style: TextStyle(
          color: warning ? Colors.orange.shade700 : null,
        ),
      ),
      value: value,
      onChanged: onChanged,
      contentPadding: EdgeInsets.zero,
      activeThumbColor: warning ? Colors.orange : null,
    );
  }
}
