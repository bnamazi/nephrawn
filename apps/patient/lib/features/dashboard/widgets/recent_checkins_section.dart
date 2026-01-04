import 'package:flutter/material.dart';
import '../../../core/models/symptom_checkin.dart';

/// Section showing recent check-ins on the dashboard
class RecentCheckinsSection extends StatelessWidget {
  final List<SymptomCheckin> checkins;
  final VoidCallback? onViewAll;
  final VoidCallback? onAddCheckin;

  const RecentCheckinsSection({
    super.key,
    required this.checkins,
    this.onViewAll,
    this.onAddCheckin,
  });

  String _formatTime(DateTime date) {
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
      dayLabel = '${date.month}/${date.day}';
    }

    final hour = date.hour > 12 ? date.hour - 12 : (date.hour == 0 ? 12 : date.hour);
    final period = date.hour >= 12 ? 'PM' : 'AM';
    final minute = date.minute.toString().padLeft(2, '0');

    return '$dayLabel at $hour:$minute $period';
  }

  Color _getSeverityColor(int severity) {
    switch (severity) {
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Recent Activity',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            if (checkins.isNotEmpty && onViewAll != null)
              TextButton(
                onPressed: onViewAll,
                child: const Text('View All'),
              ),
          ],
        ),
        const SizedBox(height: 8),

        // Content
        if (checkins.isEmpty)
          _buildNoActivityCard(context)
        else
          ...checkins.take(3).map((checkin) => _buildCheckinCard(context, checkin)),
      ],
    );
  }

  Widget _buildNoActivityCard(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onAddCheckin,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.add_circle_outline,
                  color: Colors.grey.shade500,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'No activity yet',
                    style: TextStyle(
                      color: Colors.grey.shade600,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Text(
                    'Tap to add your first check-in',
                    style: TextStyle(
                      color: Colors.grey.shade500,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCheckinCard(BuildContext context, SymptomCheckin checkin) {
    final maxSeverity = checkin.maxSeverity;
    final color = _getSeverityColor(maxSeverity);
    final reported = checkin.reportedSymptoms;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onViewAll,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  checkin.allClear
                      ? Icons.check_circle_outline
                      : Icons.medical_information_outlined,
                  color: color,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      checkin.allClear
                          ? 'All clear'
                          : '${reported.length} symptom${reported.length == 1 ? '' : 's'} reported',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: color,
                        fontSize: 13,
                      ),
                    ),
                    Text(
                      _formatTime(checkin.timestamp),
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (!checkin.allClear)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    maxSeverity == 3
                        ? 'Severe'
                        : maxSeverity == 2
                            ? 'Moderate'
                            : 'Mild',
                    style: TextStyle(
                      color: color,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
