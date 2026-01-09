import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/models/lab_report.dart';
import 'labs_provider.dart';

class LabDetailScreen extends StatelessWidget {
  final String labId;

  const LabDetailScreen({super.key, required this.labId});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) =>
          LabsProvider(context.read<ApiClient>())..getLabReport(labId),
      child: _LabDetailContent(labId: labId),
    );
  }
}

class _LabDetailContent extends StatelessWidget {
  final String labId;

  const _LabDetailContent({required this.labId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lab Report'),
        actions: [
          Consumer<LabsProvider>(
            builder: (context, provider, child) {
              if (provider.selectedReport == null) return const SizedBox();
              return PopupMenuButton<String>(
                onSelected: (value) {
                  if (value == 'delete') {
                    _confirmDelete(context);
                  }
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'delete',
                    child: Row(
                      children: [
                        Icon(Icons.delete, color: Colors.red),
                        SizedBox(width: 8),
                        Text('Delete', style: TextStyle(color: Colors.red)),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
      body: Consumer<LabsProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && provider.selectedReport == null) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.error != null && provider.selectedReport == null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline,
                      size: 48, color: Colors.red.shade400),
                  const SizedBox(height: 16),
                  Text(provider.error!),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.getLabReport(labId),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          final report = provider.selectedReport;
          if (report == null) {
            return const Center(child: Text('Lab report not found'));
          }

          return RefreshIndicator(
            onRefresh: () => provider.getLabReport(labId),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _ReportHeader(report: report),
                  const SizedBox(height: 24),
                  _ResultsTable(results: report.results),
                  if (report.notes != null && report.notes!.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    _NotesSection(notes: report.notes!),
                  ],
                ],
              ),
            ),
          );
        },
      ),
      floatingActionButton: Consumer<LabsProvider>(
        builder: (context, provider, child) {
          if (provider.selectedReport == null) return const SizedBox();
          return FloatingActionButton.extended(
            onPressed: () => _showAddResultDialog(context),
            icon: const Icon(Icons.add),
            label: const Text('Add Result'),
          );
        },
      ),
    );
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete Lab Report'),
        content: const Text(
          'Are you sure you want to delete this lab report? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(dialogContext);
              final provider = context.read<LabsProvider>();
              final success = await provider.deleteLabReport(labId);
              if (success && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Lab report deleted')),
                );
                context.pop();
              }
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _showAddResultDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (dialogContext) => _AddResultDialog(
        labId: labId,
        provider: context.read<LabsProvider>(),
      ),
    );
  }
}

class _ReportHeader extends StatelessWidget {
  final LabReport report;

  const _ReportHeader({required this.report});

  @override
  Widget build(BuildContext context) {
    return Card(
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
                    color: Colors.indigo.shade50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.science,
                    color: Colors.indigo.shade400,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        report.displayTitle,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Collected: ${DateFormat.yMMMd().format(report.collectedAt)}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Colors.grey.shade600,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 12),
            _DetailRow(label: 'Source', value: report.source.displayName),
            if (report.orderingProvider != null)
              _DetailRow(
                label: 'Provider',
                value: report.orderingProvider!,
              ),
            if (report.reportedAt != null)
              _DetailRow(
                label: 'Reported',
                value: DateFormat.yMMMd().format(report.reportedAt!),
              ),
            const SizedBox(height: 8),
            if (report.isVerified)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.verified, color: Colors.green.shade600),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Verified by ${report.verifiedBy?.name ?? "Clinician"}',
                            style: TextStyle(
                              fontWeight: FontWeight.w500,
                              color: Colors.green.shade700,
                            ),
                          ),
                          Text(
                            DateFormat.yMMMd()
                                .add_jm()
                                .format(report.verifiedAt!),
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.green.shade600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              )
            else
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.pending, color: Colors.orange.shade600),
                    const SizedBox(width: 8),
                    Text(
                      'Pending verification',
                      style: TextStyle(
                        color: Colors.orange.shade700,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(
              label,
              style: TextStyle(
                color: Colors.grey.shade600,
              ),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}

class _ResultsTable extends StatelessWidget {
  final List<LabResult> results;

  const _ResultsTable({required this.results});

  @override
  Widget build(BuildContext context) {
    if (results.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: Column(
              children: [
                Icon(Icons.science_outlined,
                    size: 48, color: Colors.grey.shade400),
                const SizedBox(height: 8),
                Text(
                  'No results added yet',
                  style: TextStyle(color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              'Results',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          const Divider(height: 1),
          // Table header
          Container(
            color: Colors.grey.shade100,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                const Expanded(flex: 3, child: Text('Test', style: TextStyle(fontWeight: FontWeight.w600))),
                const Expanded(flex: 2, child: Text('Value', style: TextStyle(fontWeight: FontWeight.w600))),
                const Expanded(flex: 2, child: Text('Ref Range', style: TextStyle(fontWeight: FontWeight.w600))),
                const SizedBox(width: 40),
              ],
            ),
          ),
          const Divider(height: 1),
          // Results rows
          ...results.map((result) => _ResultRow(result: result)),
        ],
      ),
    );
  }
}

class _ResultRow extends StatelessWidget {
  final LabResult result;

  const _ResultRow({required this.result});

  @override
  Widget build(BuildContext context) {
    Color? valueColor;
    Color? backgroundColor;

    if (result.isCritical) {
      valueColor = Colors.red.shade700;
      backgroundColor = Colors.red.shade50;
    } else if (result.isAbnormal) {
      valueColor = Colors.orange.shade700;
      backgroundColor = Colors.orange.shade50;
    }

    return Container(
      color: backgroundColor,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              result.analyteName,
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ),
          Expanded(
            flex: 2,
            child: Row(
              children: [
                Text(
                  result.displayValue,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: valueColor,
                  ),
                ),
                if (result.flag != null) ...[
                  const SizedBox(width: 4),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    decoration: BoxDecoration(
                      color: result.isCritical
                          ? Colors.red.shade200
                          : Colors.orange.shade200,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      result.flag!.shortName,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: result.isCritical
                            ? Colors.red.shade900
                            : Colors.orange.shade900,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              result.referenceRange,
              style: TextStyle(
                color: Colors.grey.shade600,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: 40),
        ],
      ),
    );
  }
}

class _NotesSection extends StatelessWidget {
  final String notes;

  const _NotesSection({required this.notes});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Notes',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(notes),
          ],
        ),
      ),
    );
  }
}

class _AddResultDialog extends StatefulWidget {
  final String labId;
  final LabsProvider provider;

  const _AddResultDialog({
    required this.labId,
    required this.provider,
  });

  @override
  State<_AddResultDialog> createState() => _AddResultDialogState();
}

class _AddResultDialogState extends State<_AddResultDialog> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _valueController = TextEditingController();
  final _unitController = TextEditingController();
  final _refLowController = TextEditingController();
  final _refHighController = TextEditingController();
  LabResultFlag? _flag;
  String? _analyteCode;
  bool _isSaving = false;

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
      title: const Text('Add Result'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Analyte dropdown/autocomplete
              Autocomplete<CkdAnalyte>(
                optionsBuilder: (textEditingValue) {
                  if (textEditingValue.text.isEmpty) {
                    return ckdAnalytes;
                  }
                  return ckdAnalytes.where((analyte) => analyte.name
                      .toLowerCase()
                      .contains(textEditingValue.text.toLowerCase()));
                },
                displayStringForOption: (analyte) => analyte.name,
                fieldViewBuilder:
                    (context, controller, focusNode, onFieldSubmitted) {
                  return TextFormField(
                    controller: controller,
                    focusNode: focusNode,
                    decoration: const InputDecoration(
                      labelText: 'Test Name *',
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) return 'Required';
                      return null;
                    },
                    onChanged: (value) => _nameController.text = value,
                  );
                },
                onSelected: (analyte) {
                  _nameController.text = analyte.name;
                  _unitController.text = analyte.unit;
                  _analyteCode = analyte.code;
                  setState(() {});
                },
              ),
              const SizedBox(height: 16),
              Row(
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
                        if (value == null || value.isEmpty) return 'Required';
                        if (double.tryParse(value) == null) return 'Invalid';
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
                        if (value == null || value.isEmpty) return 'Required';
                        return null;
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<LabResultFlag?>(
                initialValue: _flag,
                decoration: const InputDecoration(
                  labelText: 'Flag',
                  border: OutlineInputBorder(),
                ),
                items: [
                  const DropdownMenuItem(value: null, child: Text('Normal')),
                  ...LabResultFlag.values.map((f) => DropdownMenuItem(
                        value: f,
                        child: Text(f.displayName),
                      )),
                ],
                onChanged: (value) => setState(() => _flag = value),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSaving ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _isSaving ? null : _submit,
          child: _isSaving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Add'),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    final success = await widget.provider.addLabResult(
      widget.labId,
      analyteName: _nameController.text,
      analyteCode: _analyteCode,
      value: double.parse(_valueController.text),
      unit: _unitController.text,
      referenceRangeLow: _refLowController.text.isNotEmpty
          ? double.tryParse(_refLowController.text)
          : null,
      referenceRangeHigh: _refHighController.text.isNotEmpty
          ? double.tryParse(_refHighController.text)
          : null,
      flag: _flag,
    );

    if (mounted) {
      Navigator.pop(context);
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Result added')),
        );
      }
    }
  }
}
