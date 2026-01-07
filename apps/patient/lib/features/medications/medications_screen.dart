import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/models/medication.dart';
import '../../core/widgets/app_bottom_nav.dart';
import '../../routes/router.dart';
import 'medications_provider.dart';

/// Screen showing patient's medication list
class MedicationsScreen extends StatelessWidget {
  const MedicationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) => MedicationsProvider(context.read<ApiClient>())
        ..fetchMedications()
        ..fetchSummary(),
      child: const _MedicationsScreenContent(),
    );
  }
}

class _MedicationsScreenContent extends StatelessWidget {
  const _MedicationsScreenContent();

  @override
  Widget build(BuildContext context) {
    final authProvider = context.read<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Medications'),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) async {
              if (value == 'profile') {
                context.push(Routes.profile);
              } else if (value == 'logout') {
                await authProvider.logout();
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'profile',
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundColor:
                          Theme.of(context).primaryColor.withValues(alpha: 0.1),
                      child: Icon(
                        Icons.person,
                        size: 18,
                        color: Theme.of(context).primaryColor,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            authProvider.user?.name ?? 'Patient',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          Text(
                            authProvider.user?.email ?? '',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, size: 20),
                    SizedBox(width: 8),
                    Text('Log Out'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      bottomNavigationBar: const AppBottomNav(currentIndex: NavIndex.medications),
      body: Consumer<MedicationsProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.error != null && provider.medications.isEmpty) {
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
                    onPressed: () => provider.fetchMedications(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          return Column(
            children: [
              // Adherence summary card
              if (provider.summary != null)
                _AdherenceSummaryCard(summary: provider.summary!),

              // Medications list
              Expanded(
                child: provider.activeMedications.isEmpty
                    ? _buildEmptyState(context)
                    : RefreshIndicator(
                        onRefresh: () async {
                          await provider.fetchMedications();
                          await provider.fetchSummary();
                        },
                        child: ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: provider.activeMedications.length,
                          itemBuilder: (context, index) {
                            final medication = provider.activeMedications[index];
                            return _MedicationCard(
                              medication: medication,
                              onTap: () =>
                                  context.push('/medication/${medication.id}'),
                              onLogAdherence: () =>
                                  _showLogAdherenceDialog(context, medication),
                            );
                          },
                        ),
                      ),
              ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/add-medication'),
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(40),
              ),
              child: Icon(
                Icons.medication_outlined,
                size: 40,
                color: Colors.blue.shade400,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'No medications',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.grey.shade600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Tap + to add your first medication',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey.shade500,
                  ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  void _showLogAdherenceDialog(BuildContext context, Medication medication) {
    showDialog(
      context: context,
      builder: (dialogContext) => _LogAdherenceDialog(
        medication: medication,
        onSubmit: (taken, notes) async {
          final provider = context.read<MedicationsProvider>();
          final result = await provider.logAdherence(
            medication.id,
            taken: taken,
            notes: notes,
          );
          if (result != null && dialogContext.mounted) {
            Navigator.of(dialogContext).pop();
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(taken ? 'Marked as taken' : 'Marked as skipped'),
                backgroundColor: taken ? Colors.green : Colors.orange,
              ),
            );
          }
        },
      ),
    );
  }
}

class _AdherenceSummaryCard extends StatelessWidget {
  final AdherenceSummary summary;

  const _AdherenceSummaryCard({required this.summary});

  @override
  Widget build(BuildContext context) {
    final color = summary.isGoodAdherence
        ? Colors.green
        : summary.needsAttention
            ? Colors.red
            : Colors.orange;

    return Card(
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: color.shade50,
                borderRadius: BorderRadius.circular(32),
              ),
              child: Center(
                child: Text(
                  summary.adherencePercentage,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: color.shade700,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Adherence (${summary.days} days)',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${summary.takenCount} taken, ${summary.skippedCount} skipped',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.grey.shade600,
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

class _MedicationCard extends StatelessWidget {
  final Medication medication;
  final VoidCallback onTap;
  final VoidCallback onLogAdherence;

  const _MedicationCard({
    required this.medication,
    required this.onTap,
    required this.onLogAdherence,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  Icons.medication,
                  color: Colors.blue.shade400,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      medication.name,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    if (medication.dosage != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        medication.dosage!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.grey.shade600,
                            ),
                      ),
                    ],
                    if (medication.frequency != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        medication.frequency!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.grey.shade500,
                            ),
                      ),
                    ],
                  ],
                ),
              ),
              IconButton(
                onPressed: onLogAdherence,
                icon: const Icon(Icons.check_circle_outline),
                tooltip: 'Log adherence',
                color: Colors.green,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LogAdherenceDialog extends StatefulWidget {
  final Medication medication;
  final Future<void> Function(bool taken, String? notes) onSubmit;

  const _LogAdherenceDialog({
    required this.medication,
    required this.onSubmit,
  });

  @override
  State<_LogAdherenceDialog> createState() => _LogAdherenceDialogState();
}

class _LogAdherenceDialogState extends State<_LogAdherenceDialog> {
  final _notesController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Log ${widget.medication.name}'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Did you take this medication?',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _notesController,
            decoration: const InputDecoration(
              labelText: 'Notes (optional)',
              hintText: 'Any notes about this dose',
              border: OutlineInputBorder(),
            ),
            maxLines: 2,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        OutlinedButton(
          onPressed: _isSubmitting ? null : () => _submit(false),
          style: OutlinedButton.styleFrom(foregroundColor: Colors.orange),
          child: _isSubmitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Skipped'),
        ),
        FilledButton(
          onPressed: _isSubmitting ? null : () => _submit(true),
          child: _isSubmitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Taken'),
        ),
      ],
    );
  }

  Future<void> _submit(bool taken) async {
    setState(() => _isSubmitting = true);
    final notes =
        _notesController.text.trim().isEmpty ? null : _notesController.text.trim();
    await widget.onSubmit(taken, notes);
    if (mounted) {
      setState(() => _isSubmitting = false);
    }
  }
}
