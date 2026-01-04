// Alert models for patient alerts

/// Alert severity levels
enum AlertSeverity {
  critical('CRITICAL'),
  warning('WARNING'),
  info('INFO');

  final String value;
  const AlertSeverity(this.value);

  static AlertSeverity fromString(String value) {
    switch (value.toUpperCase()) {
      case 'CRITICAL':
        return AlertSeverity.critical;
      case 'WARNING':
        return AlertSeverity.warning;
      case 'INFO':
        return AlertSeverity.info;
      default:
        return AlertSeverity.info;
    }
  }
}

/// Alert status
enum AlertStatus {
  open('OPEN'),
  acknowledged('ACKNOWLEDGED'),
  dismissed('DISMISSED');

  final String value;
  const AlertStatus(this.value);

  static AlertStatus fromString(String value) {
    switch (value.toUpperCase()) {
      case 'OPEN':
        return AlertStatus.open;
      case 'ACKNOWLEDGED':
        return AlertStatus.acknowledged;
      case 'DISMISSED':
        return AlertStatus.dismissed;
      default:
        return AlertStatus.open;
    }
  }
}

/// Patient info embedded in alert
class AlertPatient {
  final String id;
  final String name;

  AlertPatient({required this.id, required this.name});

  factory AlertPatient.fromJson(Map<String, dynamic> json) {
    return AlertPatient(
      id: json['id'] as String,
      name: json['name'] as String,
    );
  }
}

/// Alert model
class Alert {
  final String id;
  final String patientId;
  final DateTime triggeredAt;
  final String ruleId;
  final String ruleName;
  final AlertSeverity severity;
  final AlertStatus status;
  final Map<String, dynamic> inputs;
  final String? summaryText;
  final String? acknowledgedBy;
  final DateTime? acknowledgedAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  final AlertPatient patient;

  Alert({
    required this.id,
    required this.patientId,
    required this.triggeredAt,
    required this.ruleId,
    required this.ruleName,
    required this.severity,
    required this.status,
    required this.inputs,
    this.summaryText,
    this.acknowledgedBy,
    this.acknowledgedAt,
    required this.createdAt,
    required this.updatedAt,
    required this.patient,
  });

  factory Alert.fromJson(Map<String, dynamic> json) {
    return Alert(
      id: json['id'] as String,
      patientId: json['patientId'] as String,
      triggeredAt: DateTime.parse(json['triggeredAt'] as String),
      ruleId: json['ruleId'] as String,
      ruleName: json['ruleName'] as String,
      severity: AlertSeverity.fromString(json['severity'] as String),
      status: AlertStatus.fromString(json['status'] as String),
      inputs: json['inputs'] as Map<String, dynamic>? ?? {},
      summaryText: json['summaryText'] as String?,
      acknowledgedBy: json['acknowledgedBy'] as String?,
      acknowledgedAt: json['acknowledgedAt'] != null
          ? DateTime.parse(json['acknowledgedAt'] as String)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      patient: AlertPatient.fromJson(json['patient'] as Map<String, dynamic>),
    );
  }

  /// Check if alert is open
  bool get isOpen => status == AlertStatus.open;

  /// Check if alert is acknowledged
  bool get isAcknowledged => status == AlertStatus.acknowledged;

  /// Check if alert is dismissed
  bool get isDismissed => status == AlertStatus.dismissed;

  /// Check if alert is critical
  bool get isCritical => severity == AlertSeverity.critical;

  /// Check if alert is warning
  bool get isWarning => severity == AlertSeverity.warning;

  /// Get a human-readable description based on rule
  String get description {
    switch (ruleId) {
      case 'weight_gain_48h':
        final delta = inputs['delta'];
        if (delta != null) {
          final lbsDelta = (delta as num) * 2.205;
          return '${lbsDelta.toStringAsFixed(1)} lbs gain in 48 hours';
        }
        return 'Rapid weight gain detected';
      case 'bp_systolic_high':
        final measurement = inputs['measurement'];
        if (measurement != null) {
          return 'Systolic: ${measurement['value']} mmHg';
        }
        return 'High blood pressure detected';
      case 'bp_systolic_low':
        final measurement = inputs['measurement'];
        if (measurement != null) {
          return 'Systolic: ${measurement['value']} mmHg';
        }
        return 'Low blood pressure detected';
      case 'spo2_low':
        final measurement = inputs['measurement'];
        if (measurement != null) {
          return 'SpO2: ${measurement['value']}%';
        }
        return 'Low oxygen saturation';
      default:
        return summaryText ?? 'Alert triggered';
    }
  }
}
