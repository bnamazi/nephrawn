import 'package:flutter/material.dart';
import '../../../core/models/dashboard.dart';
import 'trend_indicator.dart';

/// Card displaying a single health metric summary
class MetricCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final String? value;
  final String unit;
  final TrendDirection trend;
  final VoidCallback? onTap;
  final Color? iconColor;

  const MetricCard({
    super.key,
    required this.title,
    required this.icon,
    this.value,
    required this.unit,
    required this.trend,
    this.onTap,
    this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    final hasData = value != null;
    final color = iconColor ?? Theme.of(context).primaryColor;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon and title row
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(icon, color: color, size: 20),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                  ),
                ],
              ),
              const Spacer(),

              // Value
              if (hasData)
                Text(
                  '$value $unit',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                )
              else
                Text(
                  '-- $unit',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: Colors.grey.shade400,
                      ),
                ),
              const SizedBox(height: 4),

              // Trend
              if (hasData)
                TrendIndicator(trend: trend)
              else
                Text(
                  'No data yet',
                  style: TextStyle(
                    color: Colors.grey.shade500,
                    fontSize: 12,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Card for blood pressure (shows systolic/diastolic)
class BloodPressureCard extends StatelessWidget {
  final BloodPressureSummary? summary;
  final VoidCallback? onTap;

  const BloodPressureCard({
    super.key,
    this.summary,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final hasData = summary?.hasData ?? false;
    final systolic = summary?.systolic.latest?.value.round();
    final diastolic = summary?.diastolic.latest?.value.round();
    final trend = summary?.trend ?? TrendDirection.insufficientData;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon and title row
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.favorite, color: Colors.red.shade400, size: 20),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Blood Pressure',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                  ),
                ],
              ),
              const Spacer(),

              // Value
              if (hasData)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      '$systolic/$diastolic',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
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
                )
              else
                Text(
                  '--/-- mmHg',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: Colors.grey.shade400,
                      ),
                ),
              const SizedBox(height: 4),

              // Trend
              if (hasData)
                TrendIndicator(trend: trend)
              else
                Text(
                  'No data yet',
                  style: TextStyle(
                    color: Colors.grey.shade500,
                    fontSize: 12,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
