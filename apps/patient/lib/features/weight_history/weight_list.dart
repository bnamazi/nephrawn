import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/models/measurement.dart';

/// List widget displaying weight measurements
class WeightList extends StatelessWidget {
  final List<Measurement> measurements;
  final Future<void> Function()? onRefresh;

  const WeightList({
    super.key,
    required this.measurements,
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
      itemCount: measurements.length,
      itemBuilder: (context, index) {
        final measurement = measurements[index];
        return _WeightListItem(measurement: measurement);
      },
    );
  }
}

class _WeightListItem extends StatelessWidget {
  final Measurement measurement;

  const _WeightListItem({required this.measurement});

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, yyyy');
    final timeFormat = DateFormat('h:mm a');

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Weight icon
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Theme.of(context).primaryColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.monitor_weight_outlined,
                color: Theme.of(context).primaryColor,
              ),
            ),
            const SizedBox(width: 16),

            // Weight value and date
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${measurement.displayValue.toStringAsFixed(1)} ${measurement.displayUnit}',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${dateFormat.format(measurement.timestamp)} at ${timeFormat.format(measurement.timestamp)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                  ),
                ],
              ),
            ),

            // Source indicator
            if (measurement.source != 'manual')
              Chip(
                label: Text(
                  measurement.source,
                  style: const TextStyle(fontSize: 12),
                ),
                padding: EdgeInsets.zero,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
          ],
        ),
      ),
    );
  }
}

/// Empty state widget for weight list
class WeightListEmpty extends StatelessWidget {
  final VoidCallback? onAddWeight;

  const WeightListEmpty({super.key, this.onAddWeight});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.monitor_weight_outlined,
              size: 64,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 16),
            Text(
              'No measurements yet',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.grey.shade600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Add your first weight measurement to start tracking',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey.shade500,
                  ),
              textAlign: TextAlign.center,
            ),
            if (onAddWeight != null) ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: onAddWeight,
                icon: const Icon(Icons.add),
                label: const Text('Add Weight'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
