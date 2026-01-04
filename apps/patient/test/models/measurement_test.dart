import 'package:flutter_test/flutter_test.dart';
import 'package:nephrawn_patient/core/models/measurement.dart';

void main() {
  group('Measurement', () {
    group('fromJson', () {
      test('parses complete JSON correctly', () {
        final json = {
          'id': 'meas-123',
          'patientId': 'patient-456',
          'timestamp': '2024-01-15T10:30:00.000Z',
          'type': 'WEIGHT',
          'value': 70.5,
          'unit': 'kg',
          'inputUnit': 'lbs',
          'source': 'manual',
          'createdAt': '2024-01-15T10:30:00.000Z',
        };

        final measurement = Measurement.fromJson(json);

        expect(measurement.id, 'meas-123');
        expect(measurement.patientId, 'patient-456');
        expect(measurement.type, 'WEIGHT');
        expect(measurement.value, 70.5);
        expect(measurement.unit, 'kg');
        expect(measurement.inputUnit, 'lbs');
        expect(measurement.source, 'manual');
      });

      test('parses value as double when given int', () {
        final json = {
          'id': 'meas-123',
          'patientId': 'patient-456',
          'timestamp': '2024-01-15T10:30:00.000Z',
          'type': 'WEIGHT',
          'value': 70, // int not double
          'unit': 'kg',
          'source': 'manual',
          'createdAt': '2024-01-15T10:30:00.000Z',
        };

        final measurement = Measurement.fromJson(json);
        expect(measurement.value, 70.0);
        expect(measurement.value is double, true);
      });

      test('parses value as double when given string', () {
        final json = {
          'id': 'meas-123',
          'patientId': 'patient-456',
          'timestamp': '2024-01-15T10:30:00.000Z',
          'type': 'WEIGHT',
          'value': '70.5', // string not number
          'unit': 'kg',
          'source': 'manual',
          'createdAt': '2024-01-15T10:30:00.000Z',
        };

        final measurement = Measurement.fromJson(json);
        expect(measurement.value, 70.5);
      });

      test('handles null inputUnit', () {
        final json = {
          'id': 'meas-123',
          'patientId': 'patient-456',
          'timestamp': '2024-01-15T10:30:00.000Z',
          'type': 'WEIGHT',
          'value': 70.5,
          'unit': 'kg',
          'inputUnit': null,
          'source': 'manual',
          'createdAt': '2024-01-15T10:30:00.000Z',
        };

        final measurement = Measurement.fromJson(json);
        expect(measurement.inputUnit, null);
      });
    });

    group('displayValue', () {
      test('converts kg to lbs for weight', () {
        final measurement = Measurement(
          id: 'test',
          patientId: 'test',
          timestamp: DateTime.now(),
          type: 'WEIGHT',
          value: 45.3592, // ~100 lbs in kg
          unit: 'kg',
          source: 'manual',
          createdAt: DateTime.now(),
        );

        expect(measurement.displayValue, closeTo(100.0, 0.1));
      });

      test('returns raw value for non-weight measurements', () {
        final measurement = Measurement(
          id: 'test',
          patientId: 'test',
          timestamp: DateTime.now(),
          type: 'BP_SYSTOLIC',
          value: 120,
          unit: 'mmHg',
          source: 'manual',
          createdAt: DateTime.now(),
        );

        expect(measurement.displayValue, 120);
      });
    });

    group('displayUnit', () {
      test('returns lbs for weight', () {
        final measurement = Measurement(
          id: 'test',
          patientId: 'test',
          timestamp: DateTime.now(),
          type: 'WEIGHT',
          value: 70,
          unit: 'kg',
          source: 'manual',
          createdAt: DateTime.now(),
        );

        expect(measurement.displayUnit, 'lbs');
      });

      test('returns raw unit for other types', () {
        final measurement = Measurement(
          id: 'test',
          patientId: 'test',
          timestamp: DateTime.now(),
          type: 'BP_SYSTOLIC',
          value: 120,
          unit: 'mmHg',
          source: 'manual',
          createdAt: DateTime.now(),
        );

        expect(measurement.displayUnit, 'mmHg');
      });
    });
  });

  group('CreateMeasurementResponse', () {
    test('parses complete response', () {
      final json = {
        'measurement': {
          'id': 'meas-123',
          'patientId': 'patient-456',
          'timestamp': '2024-01-15T10:30:00.000Z',
          'type': 'WEIGHT',
          'value': 70.5,
          'unit': 'kg',
          'source': 'manual',
          'createdAt': '2024-01-15T10:30:00.000Z',
        },
        'convertedFrom': 'lbs',
        'isDuplicate': false,
      };

      final response = CreateMeasurementResponse.fromJson(json);

      expect(response.measurement.id, 'meas-123');
      expect(response.convertedFrom, 'lbs');
      expect(response.isDuplicate, false);
    });

    test('handles missing isDuplicate (defaults to false)', () {
      final json = {
        'measurement': {
          'id': 'meas-123',
          'patientId': 'patient-456',
          'timestamp': '2024-01-15T10:30:00.000Z',
          'type': 'WEIGHT',
          'value': 70.5,
          'unit': 'kg',
          'source': 'manual',
          'createdAt': '2024-01-15T10:30:00.000Z',
        },
      };

      final response = CreateMeasurementResponse.fromJson(json);
      expect(response.isDuplicate, false);
    });

    test('handles isDuplicate true', () {
      final json = {
        'measurement': {
          'id': 'meas-123',
          'patientId': 'patient-456',
          'timestamp': '2024-01-15T10:30:00.000Z',
          'type': 'WEIGHT',
          'value': 70.5,
          'unit': 'kg',
          'source': 'manual',
          'createdAt': '2024-01-15T10:30:00.000Z',
        },
        'isDuplicate': true,
      };

      final response = CreateMeasurementResponse.fromJson(json);
      expect(response.isDuplicate, true);
    });
  });
}
