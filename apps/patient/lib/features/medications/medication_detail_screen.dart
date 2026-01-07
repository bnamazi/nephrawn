import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/models/medication.dart';
import 'medications_provider.dart';

/// Screen showing medication details and adherence history
class MedicationDetailScreen extends StatelessWidget {
  final String medicationId;

  const MedicationDetailScreen({super.key, required this.medicationId});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) =>
          MedicationsProvider(context.read<ApiClient>())..fetchMedications(),
      child: _MedicationDetailContent(medicationId: medicationId),
    );
  }
}

class _MedicationDetailContent extends StatefulWidget {
  final String medicationId;

  const _MedicationDetailContent({required this.medicationId});

  @override
  State<_MedicationDetailContent> createState() =>
      _MedicationDetailContentState();
}

class _MedicationDetailContentState extends State<_MedicationDetailContent> {
  List<MedicationLog> _logs = [];
  bool _isLoadingLogs = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadLogs();
    });
  }

  Future<void> _loadLogs() async {
    setState(() => _isLoadingLogs = true);
    final provider = context.read<MedicationsProvider>();
    final logs = await provider.getAdherenceLogs(widget.medicationId);
    if (mounted) {
      setState(() {
        _logs = logs;
        _isLoadingLogs = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<MedicationsProvider>(
      builder: (context, provider, child) {
        if (provider.isLoading) {
          return Scaffold(
            appBar: AppBar(title: const Text('Medication')),
            body: const Center(child: CircularProgressIndicator()),
          );
        }

        final medication = provider.medications
            .where((m) => m.id == widget.medicationId)
            .firstOrNull;

        if (medication == null) {
          return Scaffold(
            appBar: AppBar(title: const Text('Medication')),
            body: const Center(child: Text('Medication not found')),
          );
        }

        return Scaffold(
          appBar: AppBar(
            title: Text(medication.name),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => context.pop(),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.edit),
                onPressed: () => _editMedication(medication),
              ),
              PopupMenuButton<String>(
                onSelected: (value) {
                  if (value == 'delete') {
                    _confirmDelete(medication);
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
              ),
            ],
          ),
          body: RefreshIndicator(
            onRefresh: () async {
              await provider.fetchMedications();
              await _loadLogs();
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Details card
                _DetailsCard(medication: medication),
                const SizedBox(height: 24),

                // Quick log buttons
                _QuickLogSection(
                  onTaken: () => _logAdherence(medication, true),
                  onSkipped: () => _logAdherence(medication, false),
                  isSaving: provider.isSaving,
                ),
                const SizedBox(height: 24),

                // Adherence history
                Text(
                  'Recent History',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),

                if (_isLoadingLogs)
                  const Center(child: CircularProgressIndicator())
                else if (_logs.isEmpty)
                  _buildEmptyHistory()
                else
                  ..._logs.map((log) => _LogHistoryItem(log: log)),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildEmptyHistory() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(Icons.history, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            Text(
              'No adherence history yet',
              style: TextStyle(color: Colors.grey.shade600),
            ),
            const SizedBox(height: 4),
            Text(
              'Log your first dose using the buttons above',
              style: TextStyle(
                color: Colors.grey.shade500,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _logAdherence(Medication medication, bool taken) async {
    final provider = context.read<MedicationsProvider>();
    final result = await provider.logAdherence(medication.id, taken: taken);

    if (result != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(taken ? 'Marked as taken' : 'Marked as skipped'),
          backgroundColor: taken ? Colors.green : Colors.orange,
        ),
      );
      _loadLogs();
    }
  }

  void _editMedication(Medication medication) {
    // Navigate to edit screen - for simplicity, we'll just use the add screen
    // A full implementation would pass the medication to edit
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Edit functionality coming soon')),
    );
  }

  void _confirmDelete(Medication medication) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete Medication'),
        content: Text(
          'Are you sure you want to delete "${medication.name}"? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(dialogContext);
              final provider = context.read<MedicationsProvider>();
              final success = await provider.deleteMedication(medication.id);
              if (success && mounted) {
                context.pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Medication deleted'),
                    backgroundColor: Colors.green,
                  ),
                );
              }
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

class _DetailsCard extends StatelessWidget {
  final Medication medication;

  const _DetailsCard({required this.medication});

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
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.medication, color: Colors.blue.shade400),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        medication.name,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      if (!medication.isActive)
                        Container(
                          margin: const EdgeInsets.only(top: 4),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'Inactive',
                            style: TextStyle(fontSize: 12),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 32),
            if (medication.dosage != null)
              _DetailRow(icon: Icons.scale, label: 'Dosage', value: medication.dosage!),
            if (medication.frequency != null)
              _DetailRow(
                  icon: Icons.schedule, label: 'Frequency', value: medication.frequency!),
            if (medication.instructions != null)
              _DetailRow(
                icon: Icons.info_outline,
                label: 'Instructions',
                value: medication.instructions!,
              ),
            if (medication.startDate != null)
              _DetailRow(
                icon: Icons.calendar_today,
                label: 'Started',
                value: DateFormat.yMMMd().format(medication.startDate!),
              ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: Colors.grey.shade600),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                ),
                Text(value),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickLogSection extends StatelessWidget {
  final VoidCallback onTaken;
  final VoidCallback onSkipped;
  final bool isSaving;

  const _QuickLogSection({
    required this.onTaken,
    required this.onSkipped,
    required this.isSaving,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Quick Log',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: isSaving ? null : onSkipped,
                icon: const Icon(Icons.close),
                label: const Text('Skipped'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.orange,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton.icon(
                onPressed: isSaving ? null : onTaken,
                icon: isSaving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.check),
                label: const Text('Taken'),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.green,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _LogHistoryItem extends StatelessWidget {
  final MedicationLog log;

  const _LogHistoryItem({required this.log});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: log.taken ? Colors.green.shade50 : Colors.orange.shade50,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Icon(
            log.taken ? Icons.check : Icons.close,
            color: log.taken ? Colors.green : Colors.orange,
          ),
        ),
        title: Text(log.taken ? 'Taken' : 'Skipped'),
        subtitle: Text(
          DateFormat.yMMMd().add_jm().format(log.loggedAt),
          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
        ),
        trailing: log.notes != null
            ? IconButton(
                icon: const Icon(Icons.notes),
                onPressed: () => _showNotes(context, log.notes!),
              )
            : null,
      ),
    );
  }

  void _showNotes(BuildContext context, String notes) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Notes'),
        content: Text(notes),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}
