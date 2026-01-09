import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/models/lab_report.dart';
import 'labs_provider.dart';

class LabEntryScreen extends StatelessWidget {
  const LabEntryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) => LabsProvider(context.read<ApiClient>()),
      child: const _LabEntryContent(),
    );
  }
}

class _LabEntryContent extends StatefulWidget {
  const _LabEntryContent();

  @override
  State<_LabEntryContent> createState() => _LabEntryContentState();
}

class _LabEntryContentState extends State<_LabEntryContent> {
  final _formKey = GlobalKey<FormState>();
  DateTime _collectedAt = DateTime.now();
  DateTime? _reportedAt;
  final _labNameController = TextEditingController();
  final _providerController = TextEditingController();
  final _notesController = TextEditingController();
  final List<_LabResultEntry> _results = [];

  @override
  void dispose() {
    _labNameController.dispose();
    _providerController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add Lab Report'),
      ),
      body: Consumer<LabsProvider>(
        builder: (context, provider, child) {
          return Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Collection date
                _DateField(
                  label: 'Collection Date *',
                  value: _collectedAt,
                  onChanged: (date) => setState(() => _collectedAt = date),
                ),
                const SizedBox(height: 16),

                // Lab name
                TextFormField(
                  controller: _labNameController,
                  decoration: const InputDecoration(
                    labelText: 'Lab Name',
                    hintText: 'e.g., Quest Diagnostics',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),

                // Ordering provider
                TextFormField(
                  controller: _providerController,
                  decoration: const InputDecoration(
                    labelText: 'Ordering Provider',
                    hintText: 'e.g., Dr. Smith',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),

                // Notes
                TextFormField(
                  controller: _notesController,
                  decoration: const InputDecoration(
                    labelText: 'Notes',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),
                const SizedBox(height: 24),

                // Results section
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Results',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    TextButton.icon(
                      onPressed: _showAddResultDialog,
                      icon: const Icon(Icons.add),
                      label: const Text('Add Result'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Quick add common CKD analytes
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: ckdAnalytes.take(6).map((analyte) {
                    final hasResult = _results.any(
                      (r) => r.analyteName == analyte.name,
                    );
                    return ActionChip(
                      label: Text(analyte.name),
                      avatar: hasResult
                          ? const Icon(Icons.check, size: 16)
                          : const Icon(Icons.add, size: 16),
                      backgroundColor:
                          hasResult ? Colors.green.shade50 : null,
                      onPressed: hasResult
                          ? null
                          : () => _showAddResultDialog(
                                preselectedAnalyte: analyte,
                              ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),

                // Results list
                if (_results.isEmpty)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        children: [
                          Icon(
                            Icons.science_outlined,
                            size: 48,
                            color: Colors.grey.shade400,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'No results added yet',
                            style: TextStyle(color: Colors.grey.shade600),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Tap the chips above or "Add Result" to add lab values',
                            style: TextStyle(
                              color: Colors.grey.shade500,
                              fontSize: 12,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  ...List.generate(_results.length, (index) {
                    final result = _results[index];
                    return _ResultCard(
                      result: result,
                      onEdit: () => _showEditResultDialog(index),
                      onDelete: () => setState(() => _results.removeAt(index)),
                    );
                  }),
                const SizedBox(height: 32),

                // Error message
                if (provider.error != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error, color: Colors.red.shade700),
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
                      : const Text('Save Lab Report'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showAddResultDialog({CkdAnalyte? preselectedAnalyte}) {
    showDialog(
      context: context,
      builder: (dialogContext) => _AddResultDialog(
        preselectedAnalyte: preselectedAnalyte,
        existingAnalytes: _results.map((r) => r.analyteName).toSet(),
        onAdd: (result) {
          setState(() => _results.add(result));
        },
      ),
    );
  }

  void _showEditResultDialog(int index) {
    showDialog(
      context: context,
      builder: (dialogContext) => _AddResultDialog(
        existingResult: _results[index],
        existingAnalytes: _results
            .asMap()
            .entries
            .where((e) => e.key != index)
            .map((e) => e.value.analyteName)
            .toSet(),
        onAdd: (result) {
          setState(() => _results[index] = result);
        },
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final provider = context.read<LabsProvider>();

    final resultsData = _results.map((r) {
      return {
        'analyteName': r.analyteName,
        if (r.analyteCode != null) 'analyteCode': r.analyteCode,
        'value': r.value,
        'unit': r.unit,
        if (r.referenceRangeLow != null)
          'referenceRangeLow': r.referenceRangeLow,
        if (r.referenceRangeHigh != null)
          'referenceRangeHigh': r.referenceRangeHigh,
        if (r.flag != null) 'flag': r.flag!.toApiString(),
      };
    }).toList();

    final success = await provider.createLabReport(
      collectedAt: _collectedAt,
      reportedAt: _reportedAt,
      labName: _labNameController.text.isEmpty ? null : _labNameController.text,
      orderingProvider:
          _providerController.text.isEmpty ? null : _providerController.text,
      notes: _notesController.text.isEmpty ? null : _notesController.text,
      results: resultsData.isNotEmpty ? resultsData : null,
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Lab report saved'),
          backgroundColor: Colors.green,
        ),
      );
      context.pop();
    }
  }
}

class _DateField extends StatelessWidget {
  final String label;
  final DateTime value;
  final ValueChanged<DateTime> onChanged;

  const _DateField({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () async {
        final date = await showDatePicker(
          context: context,
          initialDate: value,
          firstDate: DateTime(2000),
          lastDate: DateTime.now(),
        );
        if (date != null) {
          onChanged(date);
        }
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
          suffixIcon: const Icon(Icons.calendar_today),
        ),
        child: Text(DateFormat.yMMMd().format(value)),
      ),
    );
  }
}

class _LabResultEntry {
  final String analyteName;
  final String? analyteCode;
  final double value;
  final String unit;
  final double? referenceRangeLow;
  final double? referenceRangeHigh;
  final LabResultFlag? flag;

  _LabResultEntry({
    required this.analyteName,
    this.analyteCode,
    required this.value,
    required this.unit,
    this.referenceRangeLow,
    this.referenceRangeHigh,
    this.flag,
  });
}

class _ResultCard extends StatelessWidget {
  final _LabResultEntry result;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _ResultCard({
    required this.result,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    Color flagColor = Colors.grey;
    if (result.flag == LabResultFlag.critical) {
      flagColor = Colors.red;
    } else if (result.flag != null) {
      flagColor = Colors.orange;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(result.analyteName),
        subtitle: Text('${result.value} ${result.unit}'),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (result.flag != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: flagColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  result.flag!.shortName,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: flagColor,
                  ),
                ),
              ),
            IconButton(
              icon: const Icon(Icons.edit, size: 20),
              onPressed: onEdit,
            ),
            IconButton(
              icon: const Icon(Icons.delete, size: 20),
              onPressed: onDelete,
            ),
          ],
        ),
      ),
    );
  }
}

class _AddResultDialog extends StatefulWidget {
  final CkdAnalyte? preselectedAnalyte;
  final _LabResultEntry? existingResult;
  final Set<String> existingAnalytes;
  final ValueChanged<_LabResultEntry> onAdd;

  const _AddResultDialog({
    this.preselectedAnalyte,
    this.existingResult,
    required this.existingAnalytes,
    required this.onAdd,
  });

  @override
  State<_AddResultDialog> createState() => _AddResultDialogState();
}

class _AddResultDialogState extends State<_AddResultDialog> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameController;
  late TextEditingController _valueController;
  late TextEditingController _unitController;
  late TextEditingController _refLowController;
  late TextEditingController _refHighController;
  LabResultFlag? _flag;
  String? _selectedAnalyteCode;

  @override
  void initState() {
    super.initState();
    final existing = widget.existingResult;
    final preset = widget.preselectedAnalyte;

    _nameController = TextEditingController(
      text: existing?.analyteName ?? preset?.name ?? '',
    );
    _valueController = TextEditingController(
      text: existing?.value.toString() ?? '',
    );
    _unitController = TextEditingController(
      text: existing?.unit ?? preset?.unit ?? '',
    );
    _refLowController = TextEditingController(
      text: existing?.referenceRangeLow?.toString() ?? '',
    );
    _refHighController = TextEditingController(
      text: existing?.referenceRangeHigh?.toString() ?? '',
    );
    _flag = existing?.flag;
    _selectedAnalyteCode = existing?.analyteCode ?? preset?.code;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _valueController.dispose();
    _unitController.dispose();
    _refLowController.dispose();
    _refHighController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(
        widget.existingResult != null ? 'Edit Result' : 'Add Result',
      ),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Analyte name with autocomplete
              Autocomplete<CkdAnalyte>(
                initialValue: TextEditingValue(text: _nameController.text),
                optionsBuilder: (textEditingValue) {
                  if (textEditingValue.text.isEmpty) {
                    return ckdAnalytes.where(
                      (a) => !widget.existingAnalytes.contains(a.name),
                    );
                  }
                  return ckdAnalytes.where((analyte) =>
                      analyte.name
                          .toLowerCase()
                          .contains(textEditingValue.text.toLowerCase()) &&
                      !widget.existingAnalytes.contains(analyte.name));
                },
                displayStringForOption: (analyte) => analyte.name,
                fieldViewBuilder:
                    (context, controller, focusNode, onFieldSubmitted) {
                  _nameController = controller;
                  return TextFormField(
                    controller: controller,
                    focusNode: focusNode,
                    decoration: const InputDecoration(
                      labelText: 'Analyte Name *',
                      hintText: 'e.g., Creatinine',
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Required';
                      }
                      return null;
                    },
                  );
                },
                onSelected: (analyte) {
                  _nameController.text = analyte.name;
                  _unitController.text = analyte.unit;
                  _selectedAnalyteCode = analyte.code;
                },
              ),
              const SizedBox(height: 16),

              // Value and unit row
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 2,
                    child: TextFormField(
                      controller: _valueController,
                      decoration: const InputDecoration(
                        labelText: 'Value *',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Required';
                        }
                        if (double.tryParse(value) == null) {
                          return 'Invalid number';
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _unitController,
                      decoration: const InputDecoration(
                        labelText: 'Unit *',
                        border: OutlineInputBorder(),
                      ),
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return 'Required';
                        }
                        return null;
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Reference range
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _refLowController,
                      decoration: const InputDecoration(
                        labelText: 'Ref. Low',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _refHighController,
                      decoration: const InputDecoration(
                        labelText: 'Ref. High',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Flag dropdown
              DropdownButtonFormField<LabResultFlag?>(
                initialValue: _flag,
                decoration: const InputDecoration(
                  labelText: 'Flag',
                  border: OutlineInputBorder(),
                ),
                items: [
                  const DropdownMenuItem(
                    value: null,
                    child: Text('Normal'),
                  ),
                  ...LabResultFlag.values.map((flag) {
                    return DropdownMenuItem(
                      value: flag,
                      child: Text(flag.displayName),
                    );
                  }),
                ],
                onChanged: (value) => setState(() => _flag = value),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _submit,
          child: Text(widget.existingResult != null ? 'Update' : 'Add'),
        ),
      ],
    );
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;

    widget.onAdd(_LabResultEntry(
      analyteName: _nameController.text,
      analyteCode: _selectedAnalyteCode,
      value: double.parse(_valueController.text),
      unit: _unitController.text,
      referenceRangeLow: _refLowController.text.isNotEmpty
          ? double.tryParse(_refLowController.text)
          : null,
      referenceRangeHigh: _refHighController.text.isNotEmpty
          ? double.tryParse(_refHighController.text)
          : null,
      flag: _flag,
    ));
    Navigator.pop(context);
  }
}
