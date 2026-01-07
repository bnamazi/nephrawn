import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/models/medication.dart';
import 'medications_provider.dart';

/// Screen for adding or editing a medication
class MedicationEntryScreen extends StatelessWidget {
  final Medication? medication; // null for add, non-null for edit

  const MedicationEntryScreen({super.key, this.medication});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) => MedicationsProvider(context.read<ApiClient>()),
      child: _MedicationEntryContent(medication: medication),
    );
  }
}

class _MedicationEntryContent extends StatefulWidget {
  final Medication? medication;

  const _MedicationEntryContent({this.medication});

  @override
  State<_MedicationEntryContent> createState() => _MedicationEntryContentState();
}

class _MedicationEntryContentState extends State<_MedicationEntryContent> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _dosageController;
  late final TextEditingController _frequencyController;
  late final TextEditingController _instructionsController;

  bool get isEditing => widget.medication != null;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.medication?.name ?? '');
    _dosageController =
        TextEditingController(text: widget.medication?.dosage ?? '');
    _frequencyController =
        TextEditingController(text: widget.medication?.frequency ?? '');
    _instructionsController =
        TextEditingController(text: widget.medication?.instructions ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _dosageController.dispose();
    _frequencyController.dispose();
    _instructionsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(isEditing ? 'Edit Medication' : 'Add Medication'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: Consumer<MedicationsProvider>(
        builder: (context, provider, child) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Name field (required)
                  TextFormField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: 'Medication Name *',
                      hintText: 'e.g., Lisinopril',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.medication),
                    ),
                    textCapitalization: TextCapitalization.words,
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter the medication name';
                      }
                      if (value.trim().length > 200) {
                        return 'Name is too long';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Dosage field
                  TextFormField(
                    controller: _dosageController,
                    decoration: const InputDecoration(
                      labelText: 'Dosage',
                      hintText: 'e.g., 10mg',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.scale),
                    ),
                    validator: (value) {
                      if (value != null && value.length > 100) {
                        return 'Dosage is too long';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Frequency field
                  TextFormField(
                    controller: _frequencyController,
                    decoration: const InputDecoration(
                      labelText: 'Frequency',
                      hintText: 'e.g., Once daily, Twice daily',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.schedule),
                    ),
                    validator: (value) {
                      if (value != null && value.length > 100) {
                        return 'Frequency is too long';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),

                  // Instructions field
                  TextFormField(
                    controller: _instructionsController,
                    decoration: const InputDecoration(
                      labelText: 'Instructions',
                      hintText: 'e.g., Take with food',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.info_outline),
                    ),
                    maxLines: 3,
                    validator: (value) {
                      if (value != null && value.length > 500) {
                        return 'Instructions are too long';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),

                  // Error message
                  if (provider.error != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline, color: Colors.red.shade700),
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
                    const SizedBox(height: 16),
                  ],

                  // Submit button
                  FilledButton(
                    onPressed: provider.isSaving ? null : _submit,
                    child: provider.isSaving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(isEditing ? 'Save Changes' : 'Add Medication'),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final provider = context.read<MedicationsProvider>();
    final name = _nameController.text.trim();
    final dosage =
        _dosageController.text.trim().isEmpty ? null : _dosageController.text.trim();
    final frequency = _frequencyController.text.trim().isEmpty
        ? null
        : _frequencyController.text.trim();
    final instructions = _instructionsController.text.trim().isEmpty
        ? null
        : _instructionsController.text.trim();

    final result = isEditing
        ? await provider.updateMedication(
            widget.medication!.id,
            name: name,
            dosage: dosage,
            frequency: frequency,
            instructions: instructions,
          )
        : await provider.createMedication(
            name: name,
            dosage: dosage,
            frequency: frequency,
            instructions: instructions,
          );

    if (result != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(isEditing ? 'Medication updated' : 'Medication added'),
          backgroundColor: Colors.green,
        ),
      );
      context.pop(true); // Return true to indicate success
    }
  }
}
