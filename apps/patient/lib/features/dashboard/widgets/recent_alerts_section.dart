import 'package:flutter/material.dart';
import '../../../core/models/alert.dart';
import 'alert_card.dart';

/// Section showing recent alerts on the dashboard
class RecentAlertsSection extends StatelessWidget {
  final List<Alert> alerts;
  final VoidCallback? onViewAll;

  const RecentAlertsSection({
    super.key,
    required this.alerts,
    this.onViewAll,
  });

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
              'Recent Alerts',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            if (alerts.isNotEmpty && onViewAll != null)
              TextButton(
                onPressed: onViewAll,
                child: const Text('View All'),
              ),
          ],
        ),
        const SizedBox(height: 8),

        // Content
        if (alerts.isEmpty)
          _buildAllClearCard(context)
        else
          ...alerts.take(3).map(
                (alert) => AlertCard(
                  alert: alert,
                  compact: true,
                  onTap: onViewAll,
                ),
              ),
      ],
    );
  }

  Widget _buildAllClearCard(BuildContext context) {
    return Card(
      color: Colors.green.shade50,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.green.shade100,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(
                Icons.check_circle,
                color: Colors.green.shade600,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            Text(
              'All clear! No active alerts.',
              style: TextStyle(
                color: Colors.green.shade700,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
