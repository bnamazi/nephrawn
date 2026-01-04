import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/models/blood_pressure.dart';

/// List widget displaying blood pressure readings
class BPList extends StatelessWidget {
  final List<BloodPressureReading> readings;
  final Future<void> Function()? onRefresh;

  const BPList({
    super.key,
    required this.readings,
    this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    if (onRefresh != null) {
      return RefreshIndicator(
        onRefresh: onRefresh!,
        child: _buildList(context),
      );
    }
    return _buildList(context);
  }

  Widget _buildList(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: readings.length,
      itemBuilder: (context, index) {
        final reading = readings[index];
        return _BPListItem(reading: reading);
      },
    );
  }
}

class _BPListItem extends StatelessWidget {
  final BloodPressureReading reading;

  const _BPListItem({required this.reading});

  Color _getCategoryColor() {
    if (reading.systolic < 120 && reading.diastolic < 80) {
      return Colors.green;
    } else if (reading.systolic < 130 && reading.diastolic < 80) {
      return Colors.amber;
    } else if (reading.systolic < 140 || reading.diastolic < 90) {
      return Colors.orange;
    } else {
      return Colors.red;
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, yyyy');
    final timeFormat = DateFormat('h:mm a');
    final categoryColor = _getCategoryColor();

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // BP icon with category color
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: categoryColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.favorite_outlined,
                color: categoryColor,
              ),
            ),
            const SizedBox(width: 16),

            // BP value and date
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        '${reading.systolic}',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      Text(
                        '/',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              color: Colors.grey,
                            ),
                      ),
                      Text(
                        '${reading.diastolic}',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'mmHg',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.grey.shade600,
                            ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${dateFormat.format(reading.timestamp)} at ${timeFormat.format(reading.timestamp)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                  ),
                ],
              ),
            ),

            // Category chip
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: categoryColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                reading.category,
                style: TextStyle(
                  fontSize: 12,
                  color: categoryColor,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Empty state widget for BP list
class BPListEmpty extends StatelessWidget {
  final VoidCallback? onAddBP;

  const BPListEmpty({super.key, this.onAddBP});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.favorite_outline,
              size: 64,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 16),
            Text(
              'No blood pressure readings yet',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.grey.shade600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Add your first reading to start tracking',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey.shade500,
                  ),
              textAlign: TextAlign.center,
            ),
            if (onAddBP != null) ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: onAddBP,
                icon: const Icon(Icons.add),
                label: const Text('Add Blood Pressure'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
