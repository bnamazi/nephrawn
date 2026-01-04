import 'package:flutter/material.dart';
import '../../core/models/measurement.dart';

/// Simple line chart for weight measurements
class WeightChart extends StatelessWidget {
  final List<Measurement> measurements;
  final double height;

  const WeightChart({
    super.key,
    required this.measurements,
    this.height = 200,
  });

  @override
  Widget build(BuildContext context) {
    if (measurements.isEmpty) {
      return SizedBox(
        height: height,
        child: const Center(child: Text('No data')),
      );
    }

    return SizedBox(
      height: height,
      child: CustomPaint(
        size: Size.infinite,
        painter: _WeightChartPainter(
          measurements: measurements,
          lineColor: Colors.blue.shade600,
          fillColor: Colors.blue.shade100,
        ),
      ),
    );
  }
}

class _WeightChartPainter extends CustomPainter {
  final List<Measurement> measurements;
  final Color lineColor;
  final Color fillColor;

  _WeightChartPainter({
    required this.measurements,
    required this.lineColor,
    required this.fillColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (measurements.isEmpty) return;

    final padding = const EdgeInsets.fromLTRB(40, 20, 20, 30);
    final chartWidth = size.width - padding.left - padding.right;
    final chartHeight = size.height - padding.top - padding.bottom;

    // Find min/max values
    final values = measurements.map((m) => m.displayValue).toList();
    final minValue = values.reduce((a, b) => a < b ? a : b);
    final maxValue = values.reduce((a, b) => a > b ? a : b);

    // Add some padding to the range
    final range = maxValue - minValue;
    final paddedMin = minValue - (range * 0.1).clamp(1, 10);
    final paddedMax = maxValue + (range * 0.1).clamp(1, 10);
    final valueRange = paddedMax - paddedMin;

    // Draw grid lines and labels
    final gridPaint = Paint()
      ..color = Colors.grey.shade300
      ..strokeWidth = 1;

    final textStyle = TextStyle(
      color: Colors.grey.shade600,
      fontSize: 10,
    );

    // Draw 3 horizontal grid lines
    for (var i = 0; i <= 2; i++) {
      final y = padding.top + (chartHeight * i / 2);
      canvas.drawLine(
        Offset(padding.left, y),
        Offset(size.width - padding.right, y),
        gridPaint,
      );

      // Draw value label
      final value = paddedMax - (valueRange * i / 2);
      final textPainter = TextPainter(
        text: TextSpan(text: value.toStringAsFixed(0), style: textStyle),
        textDirection: TextDirection.ltr,
      );
      textPainter.layout();
      textPainter.paint(
        canvas,
        Offset(padding.left - textPainter.width - 8, y - textPainter.height / 2),
      );
    }

    // Create points
    final points = <Offset>[];
    for (var i = 0; i < measurements.length; i++) {
      final x = padding.left + (chartWidth * i / (measurements.length - 1).clamp(1, double.infinity));
      final normalizedValue = (measurements[i].displayValue - paddedMin) / valueRange;
      final y = padding.top + chartHeight - (chartHeight * normalizedValue);
      points.add(Offset(x, y));
    }

    if (points.length == 1) {
      // Single point - draw a dot
      final dotPaint = Paint()
        ..color = lineColor
        ..style = PaintingStyle.fill;
      canvas.drawCircle(points[0], 6, dotPaint);
      return;
    }

    // Draw filled area
    final fillPath = Path();
    fillPath.moveTo(points.first.dx, padding.top + chartHeight);
    for (final point in points) {
      fillPath.lineTo(point.dx, point.dy);
    }
    fillPath.lineTo(points.last.dx, padding.top + chartHeight);
    fillPath.close();

    final fillPaint = Paint()
      ..color = fillColor.withValues(alpha: 0.3)
      ..style = PaintingStyle.fill;
    canvas.drawPath(fillPath, fillPaint);

    // Draw line
    final linePath = Path();
    linePath.moveTo(points.first.dx, points.first.dy);
    for (var i = 1; i < points.length; i++) {
      linePath.lineTo(points[i].dx, points[i].dy);
    }

    final linePaint = Paint()
      ..color = lineColor
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(linePath, linePaint);

    // Draw dots
    final dotPaint = Paint()
      ..color = lineColor
      ..style = PaintingStyle.fill;
    final dotBorderPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    for (final point in points) {
      canvas.drawCircle(point, 5, dotBorderPaint);
      canvas.drawCircle(point, 4, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _WeightChartPainter oldDelegate) {
    return measurements != oldDelegate.measurements;
  }
}
