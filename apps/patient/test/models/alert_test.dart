import 'package:flutter_test/flutter_test.dart';
import 'package:nephrawn_patient/core/models/alert.dart';

void main() {
  group('AlertSeverity', () {
    test('fromString parses CRITICAL', () {
      expect(AlertSeverity.fromString('CRITICAL'), AlertSeverity.critical);
      expect(AlertSeverity.fromString('critical'), AlertSeverity.critical);
    });

    test('fromString parses WARNING', () {
      expect(AlertSeverity.fromString('WARNING'), AlertSeverity.warning);
      expect(AlertSeverity.fromString('warning'), AlertSeverity.warning);
    });

    test('fromString parses INFO', () {
      expect(AlertSeverity.fromString('INFO'), AlertSeverity.info);
      expect(AlertSeverity.fromString('info'), AlertSeverity.info);
    });

    test('fromString defaults to INFO for unknown values', () {
      expect(AlertSeverity.fromString('UNKNOWN'), AlertSeverity.info);
      expect(AlertSeverity.fromString(''), AlertSeverity.info);
    });
  });

  group('AlertStatus', () {
    test('fromString parses OPEN', () {
      expect(AlertStatus.fromString('OPEN'), AlertStatus.open);
      expect(AlertStatus.fromString('open'), AlertStatus.open);
    });

    test('fromString parses ACKNOWLEDGED', () {
      expect(AlertStatus.fromString('ACKNOWLEDGED'), AlertStatus.acknowledged);
      expect(AlertStatus.fromString('acknowledged'), AlertStatus.acknowledged);
    });

    test('fromString parses DISMISSED', () {
      expect(AlertStatus.fromString('DISMISSED'), AlertStatus.dismissed);
      expect(AlertStatus.fromString('dismissed'), AlertStatus.dismissed);
    });

    test('fromString defaults to OPEN for unknown values', () {
      expect(AlertStatus.fromString('UNKNOWN'), AlertStatus.open);
    });
  });

  group('Alert', () {
    final baseJson = {
      'id': 'alert-123',
      'patientId': 'patient-456',
      'triggeredAt': '2024-01-15T10:30:00.000Z',
      'ruleId': 'weight_gain_48h',
      'ruleName': 'Weight Gain 48h',
      'severity': 'WARNING',
      'status': 'OPEN',
      'inputs': {'delta': 1.5},
      'createdAt': '2024-01-15T10:30:00.000Z',
      'updatedAt': '2024-01-15T10:30:00.000Z',
      'patient': {'id': 'patient-456', 'name': 'John Doe'},
    };

    group('fromJson', () {
      test('parses complete JSON correctly', () {
        final alert = Alert.fromJson(baseJson);

        expect(alert.id, 'alert-123');
        expect(alert.patientId, 'patient-456');
        expect(alert.ruleId, 'weight_gain_48h');
        expect(alert.ruleName, 'Weight Gain 48h');
        expect(alert.severity, AlertSeverity.warning);
        expect(alert.status, AlertStatus.open);
        expect(alert.inputs['delta'], 1.5);
        expect(alert.patient.id, 'patient-456');
        expect(alert.patient.name, 'John Doe');
      });

      test('handles null optional fields', () {
        final json = {
          ...baseJson,
          'summaryText': null,
          'acknowledgedBy': null,
          'acknowledgedAt': null,
        };

        final alert = Alert.fromJson(json);

        expect(alert.summaryText, null);
        expect(alert.acknowledgedBy, null);
        expect(alert.acknowledgedAt, null);
      });

      test('parses acknowledged alert', () {
        final json = {
          ...baseJson,
          'status': 'ACKNOWLEDGED',
          'acknowledgedBy': 'clinician-789',
          'acknowledgedAt': '2024-01-15T11:00:00.000Z',
        };

        final alert = Alert.fromJson(json);

        expect(alert.status, AlertStatus.acknowledged);
        expect(alert.acknowledgedBy, 'clinician-789');
        expect(alert.acknowledgedAt, isNotNull);
      });

      test('handles missing inputs gracefully', () {
        final json = Map<String, dynamic>.from(baseJson);
        json.remove('inputs');

        final alert = Alert.fromJson(json);
        expect(alert.inputs, isEmpty);
      });

      test('handles null inputs', () {
        final json = {
          ...baseJson,
          'inputs': null,
        };

        final alert = Alert.fromJson(json);
        expect(alert.inputs, isEmpty);
      });
    });

    group('status helpers', () {
      test('isOpen returns true for open alerts', () {
        final alert = Alert.fromJson({...baseJson, 'status': 'OPEN'});
        expect(alert.isOpen, true);
        expect(alert.isAcknowledged, false);
        expect(alert.isDismissed, false);
      });

      test('isAcknowledged returns true for acknowledged alerts', () {
        final alert = Alert.fromJson({...baseJson, 'status': 'ACKNOWLEDGED'});
        expect(alert.isOpen, false);
        expect(alert.isAcknowledged, true);
        expect(alert.isDismissed, false);
      });

      test('isDismissed returns true for dismissed alerts', () {
        final alert = Alert.fromJson({...baseJson, 'status': 'DISMISSED'});
        expect(alert.isOpen, false);
        expect(alert.isAcknowledged, false);
        expect(alert.isDismissed, true);
      });
    });

    group('severity helpers', () {
      test('isCritical returns true for critical alerts', () {
        final alert = Alert.fromJson({...baseJson, 'severity': 'CRITICAL'});
        expect(alert.isCritical, true);
        expect(alert.isWarning, false);
      });

      test('isWarning returns true for warning alerts', () {
        final alert = Alert.fromJson({...baseJson, 'severity': 'WARNING'});
        expect(alert.isCritical, false);
        expect(alert.isWarning, true);
      });
    });

    group('description', () {
      test('formats weight gain description', () {
        final json = {
          ...baseJson,
          'ruleId': 'weight_gain_48h',
          'inputs': {'delta': 1.0}, // 1 kg = ~2.2 lbs
        };

        final alert = Alert.fromJson(json);
        expect(alert.description, contains('lbs'));
        expect(alert.description, contains('48 hours'));
      });

      test('formats BP high description', () {
        final json = {
          ...baseJson,
          'ruleId': 'bp_systolic_high',
          'inputs': {
            'measurement': {'value': 180}
          },
        };

        final alert = Alert.fromJson(json);
        expect(alert.description, contains('180'));
        expect(alert.description, contains('mmHg'));
      });

      test('formats BP low description', () {
        final json = {
          ...baseJson,
          'ruleId': 'bp_systolic_low',
          'inputs': {
            'measurement': {'value': 85}
          },
        };

        final alert = Alert.fromJson(json);
        expect(alert.description, contains('85'));
      });

      test('formats SpO2 low description', () {
        final json = {
          ...baseJson,
          'ruleId': 'spo2_low',
          'inputs': {
            'measurement': {'value': 90}
          },
        };

        final alert = Alert.fromJson(json);
        expect(alert.description, contains('90'));
        expect(alert.description, contains('%'));
      });

      test('uses summaryText for unknown rules', () {
        final json = {
          ...baseJson,
          'ruleId': 'unknown_rule',
          'summaryText': 'Custom alert message',
        };

        final alert = Alert.fromJson(json);
        expect(alert.description, 'Custom alert message');
      });

      test('falls back to default for unknown rules without summaryText', () {
        final json = {
          ...baseJson,
          'ruleId': 'unknown_rule',
          'summaryText': null,
        };

        final alert = Alert.fromJson(json);
        expect(alert.description, 'Alert triggered');
      });
    });
  });
}
