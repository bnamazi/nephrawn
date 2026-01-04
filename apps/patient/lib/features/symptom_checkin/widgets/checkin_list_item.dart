import 'package:flutter/material.dart';
import '../../../core/models/symptom_checkin.dart';
import 'symptom_selector.dart';

/// List item widget for displaying a symptom check-in
class CheckinListItem extends StatelessWidget {
  final SymptomCheckin checkin;

  const CheckinListItem({super.key, required this.checkin});

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final checkinDate = DateTime(date.year, date.month, date.day);

    String dayLabel;
    if (checkinDate == today) {
      dayLabel = 'Today';
    } else if (checkinDate == yesterday) {
      dayLabel = 'Yesterday';
    } else {
      dayLabel = '${date.month}/${date.day}/${date.year}';
    }

    final hour = date.hour > 12 ? date.hour - 12 : (date.hour == 0 ? 12 : date.hour);
    final period = date.hour >= 12 ? 'PM' : 'AM';
    final minute = date.minute.toString().padLeft(2, '0');

    return '$dayLabel at $hour:$minute $period';
  }

  String _getSymptomDisplayName(String key) {
    switch (key) {
      case 'edema':
        return 'Edema';
      case 'fatigue':
        return 'Fatigue';
      case 'shortnessOfBreath':
        return 'SOB';
      case 'nausea':
        return 'Nausea';
      case 'appetite':
        return 'Appetite';
      case 'pain':
        return 'Pain';
      default:
        return key;
    }
  }

  Color _getMaxSeverityColor() {
    final max = checkin.maxSeverity;
    switch (max) {
      case 0:
        return Colors.green;
      case 1:
        return Colors.green;
      case 2:
        return Colors.amber.shade700;
      case 3:
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final reportedSymptoms = checkin.reportedSymptoms;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row with time and status
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: _getMaxSeverityColor().withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    checkin.allClear
                        ? Icons.check_circle_outline
                        : Icons.medical_information_outlined,
                    color: _getMaxSeverityColor(),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _formatDate(checkin.timestamp),
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        checkin.allClear
                            ? 'All symptoms: None'
                            : '${reportedSymptoms.length} symptom${reportedSymptoms.length == 1 ? '' : 's'} reported',
                        style: TextStyle(
                          color: Colors.grey.shade600,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // Symptom badges
            if (reportedSymptoms.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: reportedSymptoms.map((symptom) {
                  return SeverityBadge(
                    symptomName: _getSymptomDisplayName(symptom.type),
                    severity: symptom.severity,
                  );
                }).toList(),
              ),
            ],

            // Notes preview
            if (checkin.notes != null && checkin.notes!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.notes, size: 16, color: Colors.grey.shade500),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        checkin.notes!,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade700,
                          fontStyle: FontStyle.italic,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Empty state widget for check-in list
class CheckinListEmpty extends StatelessWidget {
  final VoidCallback? onAddCheckin;

  const CheckinListEmpty({super.key, this.onAddCheckin});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.medical_information_outlined,
              size: 64,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 16),
            Text(
              'No check-ins yet',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.grey.shade600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Track how you\'re feeling by adding your first symptom check-in',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey.shade500,
                  ),
              textAlign: TextAlign.center,
            ),
            if (onAddCheckin != null) ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: onAddCheckin,
                icon: const Icon(Icons.add),
                label: const Text('Add Check-in'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
