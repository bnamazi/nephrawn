import 'package:flutter/material.dart';
import '../../../core/models/dashboard.dart';

/// Widget showing trend direction with icon and label
class TrendIndicator extends StatelessWidget {
  final TrendDirection trend;
  final bool showLabel;

  const TrendIndicator({
    super.key,
    required this.trend,
    this.showLabel = true,
  });

  @override
  Widget build(BuildContext context) {
    final (icon, color, label) = _getTrendDisplay();

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: color, size: 16),
        if (showLabel) ...[
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ],
    );
  }

  (IconData, Color, String) _getTrendDisplay() {
    switch (trend) {
      case TrendDirection.increasing:
        return (Icons.trending_up, Colors.amber.shade700, 'Increasing');
      case TrendDirection.decreasing:
        return (Icons.trending_down, Colors.amber.shade700, 'Decreasing');
      case TrendDirection.stable:
        return (Icons.trending_flat, Colors.green.shade600, 'Stable');
      case TrendDirection.insufficientData:
        return (Icons.remove, Colors.grey.shade500, 'No trend data');
    }
  }
}
