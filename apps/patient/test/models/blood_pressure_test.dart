import 'package:flutter_test/flutter_test.dart';
import 'package:nephrawn_patient/core/models/blood_pressure.dart';

void main() {
  group('BloodPressureReading classification', () {
    group('AHA category', () {
      test('Normal: systolic < 120 AND diastolic < 80', () {
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 110, diastolic: 70).category,
          'Normal',
        );
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 119, diastolic: 79).category,
          'Normal',
        );
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 90, diastolic: 60).category,
          'Normal',
        );
      });

      test('Elevated: systolic 120-129 AND diastolic < 80', () {
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 120, diastolic: 75).category,
          'Elevated',
        );
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 125, diastolic: 79).category,
          'Elevated',
        );
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 129, diastolic: 70).category,
          'Elevated',
        );
      });

      test('High Stage 1: systolic 130-139 OR diastolic 80-89', () {
        // Systolic in Stage 1 range, diastolic normal
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 130, diastolic: 75).category,
          'High (Stage 1)',
        );
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 139, diastolic: 70).category,
          'High (Stage 1)',
        );
        // Diastolic in Stage 1 range, systolic normal
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 115, diastolic: 80).category,
          'High (Stage 1)',
        );
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 110, diastolic: 89).category,
          'High (Stage 1)',
        );
        // Both in Stage 1 range
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 135, diastolic: 85).category,
          'High (Stage 1)',
        );
      });

      test('High Stage 2: systolic >= 140 OR diastolic >= 90', () {
        // Systolic in Stage 2 range
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 140, diastolic: 85).category,
          'High (Stage 2)',
        );
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 160, diastolic: 70).category,
          'High (Stage 2)',
        );
        // Diastolic in Stage 2 range
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 125, diastolic: 90).category,
          'High (Stage 2)',
        );
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 110, diastolic: 100).category,
          'High (Stage 2)',
        );
        // Both in Stage 2 range
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 150, diastolic: 95).category,
          'High (Stage 2)',
        );
      });

      test('Crisis: systolic > 180 OR diastolic > 120', () {
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 181, diastolic: 90).category,
          'Crisis',
        );
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 200, diastolic: 110).category,
          'Crisis',
        );
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 150, diastolic: 121).category,
          'Crisis',
        );
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 190, diastolic: 130).category,
          'Crisis',
        );
      });
    });

    group('severityLevel', () {
      test('returns correct severity levels', () {
        // Normal = 0
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 110, diastolic: 70).severityLevel,
          0,
        );
        // Elevated = 1
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 125, diastolic: 75).severityLevel,
          1,
        );
        // Stage 1 = 2
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 135, diastolic: 85).severityLevel,
          2,
        );
        // Stage 2 = 3
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 150, diastolic: 95).severityLevel,
          3,
        );
        // Crisis = 4
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 185, diastolic: 125).severityLevel,
          4,
        );
      });
    });

    group('isElevated', () {
      test('returns false for normal readings', () {
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 110, diastolic: 70).isElevated,
          false,
        );
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 119, diastolic: 79).isElevated,
          false,
        );
      });

      test('returns true for elevated or higher readings', () {
        // Elevated systolic
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 130, diastolic: 75).isElevated,
          true,
        );
        // Elevated diastolic
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 110, diastolic: 80).isElevated,
          true,
        );
        // Stage 2
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 150, diastolic: 95).isElevated,
          true,
        );
      });
    });

    group('edge cases - bug regression tests', () {
      test('170/85 should be Stage 2, not Stage 1 (old OR bug)', () {
        // This was incorrectly classified as Stage 1 with the old buggy logic
        final reading = BloodPressureReading(
          timestamp: DateTime.now(),
          systolic: 170,
          diastolic: 85,
        );
        expect(reading.category, 'High (Stage 2)');
        expect(reading.severityLevel, 3);
      });

      test('135/95 should be Stage 2, not Stage 1 (old OR bug)', () {
        // This was incorrectly classified as Stage 1 with the old buggy logic
        final reading = BloodPressureReading(
          timestamp: DateTime.now(),
          systolic: 135,
          diastolic: 95,
        );
        expect(reading.category, 'High (Stage 2)');
        expect(reading.severityLevel, 3);
      });

      test('boundary values are correctly classified', () {
        // Exactly 120/80 should be Stage 1 (diastolic >= 80)
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 120, diastolic: 80).category,
          'High (Stage 1)',
        );
        // Exactly 140/90 should be Stage 2
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 140, diastolic: 90).category,
          'High (Stage 2)',
        );
        // Exactly 180/120 should be Stage 2 (not crisis - must be > not >=)
        expect(
          BloodPressureReading(timestamp: DateTime.now(), systolic: 180, diastolic: 120).category,
          'High (Stage 2)',
        );
      });
    });
  });
}
