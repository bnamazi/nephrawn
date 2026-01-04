import 'package:flutter/material.dart';
import '../../core/models/blood_pressure.dart';

/// Simple blood pressure chart using CustomPainter
class BPChart extends StatelessWidget {
  final List<BloodPressureReading> readings;
  final double height;

  const BPChart({
    super.key,
    required this.readings,
    this.height = 200,
  });

  @override
  Widget build(BuildContext context) {
    if (readings.isEmpty) {
      return SizedBox(
        height: height,
        child: const Center(
          child: Text('Not enough data for chart'),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Legend
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _LegendItem(color: Colors.red.shade400, label: 'Systolic'),
            const SizedBox(width: 24),
            _LegendItem(color: Colors.blue.shade400, label: 'Diastolic'),
          ],
        ),
        const SizedBox(height: 16),
        // Chart
        SizedBox(
          height: height,
          child: CustomPaint(
            size: Size.infinite,
            painter: _BPChartPainter(readings: readings),
          ),
        ),
      ],
    );
  }
}

class _LegendItem extends StatelessWidget {
  final Color color;
  final String label;

  const _LegendItem({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}

class _BPChartPainter extends CustomPainter {
  final List<BloodPressureReading> readings;

  _BPChartPainter({required this.readings});

  @override
  void paint(Canvas canvas, Size size) {
    if (readings.isEmpty) return;

    final padding = const EdgeInsets.only(left: 40, right: 16, top: 16, bottom: 24);
    final chartArea = Rect.fromLTWH(
      padding.left,
      padding.top,
      size.width - padding.left - padding.right,
      size.height - padding.top - padding.bottom,
    );

    // Find min/max values
    int minVal = 40;
    int maxVal = 200;
    for (final r in readings) {
      if (r.systolic > maxVal) maxVal = r.systolic + 10;
      if (r.diastolic < minVal) minVal = r.diastolic - 10;
    }

    // Draw grid lines and labels
    final gridPaint = Paint()
      ..color = Colors.grey.shade300
      ..strokeWidth = 1;
    final textPainter = TextPainter(textDirection: TextDirection.ltr);

    for (int val = minVal; val <= maxVal; val += 20) {
      final y = chartArea.bottom -
          (val - minVal) / (maxVal - minVal) * chartArea.height;

      canvas.drawLine(
        Offset(chartArea.left, y),
        Offset(chartArea.right, y),
        gridPaint,
      );

      textPainter.text = TextSpan(
        text: '$val',
        style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
      );
      textPainter.layout();
      textPainter.paint(canvas, Offset(padding.left - textPainter.width - 4, y - textPainter.height / 2));
    }

    if (readings.length < 2) {
      // Just draw points for single reading
      _drawPoints(canvas, chartArea, minVal, maxVal);
      return;
    }

    // Draw lines
    final systolicPaint = Paint()
      ..color = Colors.red.shade400
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final diastolicPaint = Paint()
      ..color = Colors.blue.shade400
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    final systolicPath = Path();
    final diastolicPath = Path();

    for (int i = 0; i < readings.length; i++) {
      final x = chartArea.left + (i / (readings.length - 1)) * chartArea.width;
      final ySys = chartArea.bottom -
          (readings[i].systolic - minVal) / (maxVal - minVal) * chartArea.height;
      final yDia = chartArea.bottom -
          (readings[i].diastolic - minVal) / (maxVal - minVal) * chartArea.height;

      if (i == 0) {
        systolicPath.moveTo(x, ySys);
        diastolicPath.moveTo(x, yDia);
      } else {
        systolicPath.lineTo(x, ySys);
        diastolicPath.lineTo(x, yDia);
      }
    }

    canvas.drawPath(systolicPath, systolicPaint);
    canvas.drawPath(diastolicPath, diastolicPaint);

    // Draw points
    _drawPoints(canvas, chartArea, minVal, maxVal);
  }

  void _drawPoints(Canvas canvas, Rect chartArea, int minVal, int maxVal) {
    final systolicDotPaint = Paint()..color = Colors.red.shade400;
    final diastolicDotPaint = Paint()..color = Colors.blue.shade400;

    for (int i = 0; i < readings.length; i++) {
      final x = readings.length == 1
          ? chartArea.center.dx
          : chartArea.left + (i / (readings.length - 1)) * chartArea.width;
      final ySys = chartArea.bottom -
          (readings[i].systolic - minVal) / (maxVal - minVal) * chartArea.height;
      final yDia = chartArea.bottom -
          (readings[i].diastolic - minVal) / (maxVal - minVal) * chartArea.height;

      canvas.drawCircle(Offset(x, ySys), 4, systolicDotPaint);
      canvas.drawCircle(Offset(x, yDia), 4, diastolicDotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _BPChartPainter oldDelegate) {
    return readings != oldDelegate.readings;
  }
}
