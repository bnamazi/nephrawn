import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/models/symptom_checkin.dart';
import '../../routes/router.dart';
import 'symptom_entry_provider.dart';
import 'widgets/symptom_selector.dart';

/// Screen for entering a symptom check-in
class SymptomEntryScreen extends StatelessWidget {
  const SymptomEntryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) => SymptomEntryProvider(context.read<ApiClient>()),
      child: const _SymptomEntryScreenContent(),
    );
  }
}

class _SymptomEntryScreenContent extends StatefulWidget {
  const _SymptomEntryScreenContent();

  @override
  State<_SymptomEntryScreenContent> createState() =>
      _SymptomEntryScreenContentState();
}

class _SymptomEntryScreenContentState
    extends State<_SymptomEntryScreenContent> {
  // Symptom values (0-3 scale)
  int _edema = 0;
  int _fatigue = 0;
  int _shortnessOfBreath = 0;
  int _nausea = 0;
  int _appetite = 0;
  int _pain = 0;

  final _notesController = TextEditingController();

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Map<String, Map<String, dynamic>> _buildSymptomsPayload() {
    return {
      'edema': {'severity': _edema},
      'fatigue': {'severity': _fatigue},
      'shortnessOfBreath': {'severity': _shortnessOfBreath},
      'nausea': {'severity': _nausea},
      'appetite': {'level': _appetite},
      'pain': {'severity': _pain},
    };
  }

  Future<void> _submitCheckin() async {
    final provider = context.read<SymptomEntryProvider>();

    final success = await provider.submitCheckin(
      symptoms: _buildSymptomsPayload(),
      notes: _notesController.text.isNotEmpty ? _notesController.text : null,
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Check-in submitted successfully'),
          backgroundColor: Colors.green,
        ),
      );

      // Navigate back
      if (context.canPop()) {
        context.pop();
      } else {
        context.go(Routes.checkins);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Symptom Check-in'),
      ),
      body: Consumer<SymptomEntryProvider>(
        builder: (context, provider, child) {
          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'How are you feeling today?',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Rate each symptom from None to Severe',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                  ),
                  const SizedBox(height: 24),

                  // Edema
                  SymptomSelector(
                    label: SymptomType.edema.displayName,
                    value: _edema,
                    onChanged: (v) => setState(() => _edema = v),
                  ),
                  const SizedBox(height: 20),

                  // Fatigue
                  SymptomSelector(
                    label: SymptomType.fatigue.displayName,
                    value: _fatigue,
                    onChanged: (v) => setState(() => _fatigue = v),
                  ),
                  const SizedBox(height: 20),

                  // Shortness of Breath
                  SymptomSelector(
                    label: SymptomType.shortnessOfBreath.displayName,
                    value: _shortnessOfBreath,
                    onChanged: (v) => setState(() => _shortnessOfBreath = v),
                  ),
                  const SizedBox(height: 20),

                  // Nausea
                  SymptomSelector(
                    label: SymptomType.nausea.displayName,
                    value: _nausea,
                    onChanged: (v) => setState(() => _nausea = v),
                  ),
                  const SizedBox(height: 20),

                  // Appetite (custom labels)
                  SymptomSelector.appetite(
                    value: _appetite,
                    onChanged: (v) => setState(() => _appetite = v),
                  ),
                  const SizedBox(height: 20),

                  // Pain
                  SymptomSelector(
                    label: SymptomType.pain.displayName,
                    value: _pain,
                    onChanged: (v) => setState(() => _pain = v),
                  ),
                  const SizedBox(height: 24),

                  // Notes field
                  Text(
                    'Notes (optional)',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _notesController,
                    decoration: const InputDecoration(
                      hintText: 'Any additional details...',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 3,
                    maxLength: 500,
                  ),
                  const SizedBox(height: 16),

                  // Error message
                  if (provider.error != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.red.shade200),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline,
                              color: Colors.red.shade600, size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              provider.error!,
                              style: TextStyle(color: Colors.red.shade700),
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (provider.error != null) const SizedBox(height: 16),

                  // Submit button
                  FilledButton(
                    onPressed: provider.isLoading ? null : _submitCheckin,
                    child: provider.isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Submit Check-in'),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
