import 'package:flutter/material.dart';

/// Badge to indicate the source of a measurement
class SourceBadge extends StatelessWidget {
  final String source;
  final bool compact;

  const SourceBadge({
    super.key,
    required this.source,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDevice = source != 'manual';

    if (compact) {
      return Icon(
        isDevice ? Icons.watch : Icons.edit,
        size: 14,
        color: isDevice ? Colors.blue.shade600 : Colors.grey.shade500,
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: isDevice ? Colors.blue.shade50 : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isDevice ? Icons.watch : Icons.edit,
            size: 12,
            color: isDevice ? Colors.blue.shade700 : Colors.grey.shade600,
          ),
          const SizedBox(width: 4),
          Text(
            _getDisplayName(source),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: isDevice ? Colors.blue.shade700 : Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }

  String _getDisplayName(String source) {
    switch (source.toLowerCase()) {
      case 'withings':
        return 'Withings';
      case 'manual':
        return 'Manual';
      default:
        return source;
    }
  }
}
