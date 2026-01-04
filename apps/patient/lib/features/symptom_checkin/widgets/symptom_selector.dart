import 'package:flutter/material.dart';

/// Widget for selecting symptom severity (0-3 scale)
class SymptomSelector extends StatelessWidget {
  final String label;
  final int value;
  final ValueChanged<int> onChanged;
  final List<String> options;

  const SymptomSelector({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.options = const ['None', 'Mild', 'Moderate', 'Severe'],
  });

  /// Factory for appetite selector with custom labels
  factory SymptomSelector.appetite({
    Key? key,
    required int value,
    required ValueChanged<int> onChanged,
  }) {
    return SymptomSelector(
      key: key,
      label: 'Appetite',
      value: value,
      onChanged: onChanged,
      options: const ['Normal', 'Reduced', 'Poor', 'None'],
    );
  }

  Color _getColorForValue(int val) {
    switch (val) {
      case 0:
        return Colors.grey;
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
        Text(
          label,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w500,
              ),
        ),
        const SizedBox(height: 8),
        SegmentedButton<int>(
          segments: List.generate(4, (index) {
            return ButtonSegment<int>(
              value: index,
              label: Text(
                options[index],
                style: const TextStyle(fontSize: 12),
              ),
            );
          }),
          selected: {value},
          onSelectionChanged: (Set<int> selected) {
            onChanged(selected.first);
          },
          style: ButtonStyle(
            backgroundColor: WidgetStateProperty.resolveWith<Color?>(
              (states) {
                if (states.contains(WidgetState.selected)) {
                  return _getColorForValue(value).withValues(alpha: 0.2);
                }
                return null;
              },
            ),
            foregroundColor: WidgetStateProperty.resolveWith<Color?>(
              (states) {
                if (states.contains(WidgetState.selected)) {
                  return _getColorForValue(value);
                }
                return Colors.grey.shade600;
              },
            ),
          ),
        ),
      ],
    );
  }
}

/// Compact severity badge for displaying in lists
class SeverityBadge extends StatelessWidget {
  final String symptomName;
  final int severity;

  const SeverityBadge({
    super.key,
    required this.symptomName,
    required this.severity,
  });

  Color get _color {
    switch (severity) {
      case 0:
        return Colors.grey;
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

  String get _severityLabel {
    switch (severity) {
      case 0:
        return 'None';
      case 1:
        return 'Mild';
      case 2:
        return 'Moderate';
      case 3:
        return 'Severe';
      default:
        return 'Unknown';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _color.withValues(alpha: 0.3)),
      ),
      child: Text(
        '$symptomName: $_severityLabel',
        style: TextStyle(
          fontSize: 11,
          color: _color,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}
