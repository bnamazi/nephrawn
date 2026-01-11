enum DeviceVendor {
  withings;

  String get displayName {
    switch (this) {
      case DeviceVendor.withings:
        return 'Withings';
    }
  }

  static DeviceVendor fromString(String value) {
    switch (value) {
      case 'WITHINGS':
        return DeviceVendor.withings;
      default:
        return DeviceVendor.withings;
    }
  }

  String toApiString() {
    switch (this) {
      case DeviceVendor.withings:
        return 'WITHINGS';
    }
  }
}

enum DeviceConnectionStatus {
  active,
  expired,
  revoked,
  error;

  String get displayName {
    switch (this) {
      case DeviceConnectionStatus.active:
        return 'Connected';
      case DeviceConnectionStatus.expired:
        return 'Expired';
      case DeviceConnectionStatus.revoked:
        return 'Disconnected';
      case DeviceConnectionStatus.error:
        return 'Error';
    }
  }

  static DeviceConnectionStatus fromString(String value) {
    switch (value) {
      case 'ACTIVE':
        return DeviceConnectionStatus.active;
      case 'EXPIRED':
        return DeviceConnectionStatus.expired;
      case 'REVOKED':
        return DeviceConnectionStatus.revoked;
      case 'ERROR':
        return DeviceConnectionStatus.error;
      default:
        return DeviceConnectionStatus.error;
    }
  }

  String toApiString() {
    switch (this) {
      case DeviceConnectionStatus.active:
        return 'ACTIVE';
      case DeviceConnectionStatus.expired:
        return 'EXPIRED';
      case DeviceConnectionStatus.revoked:
        return 'REVOKED';
      case DeviceConnectionStatus.error:
        return 'ERROR';
    }
  }

  bool get isActive => this == DeviceConnectionStatus.active;
  bool get needsReauth => this == DeviceConnectionStatus.expired;
  bool get hasError => this == DeviceConnectionStatus.error;
}

class DeviceConnection {
  final String id;
  final DeviceVendor vendor;
  final DeviceConnectionStatus status;
  final DateTime? lastSyncAt;
  final String? lastSyncError;
  final DateTime createdAt;

  DeviceConnection({
    required this.id,
    required this.vendor,
    required this.status,
    this.lastSyncAt,
    this.lastSyncError,
    required this.createdAt,
  });

  factory DeviceConnection.fromJson(Map<String, dynamic> json) {
    return DeviceConnection(
      id: json['id'] as String,
      vendor: DeviceVendor.fromString(json['vendor'] as String),
      status: DeviceConnectionStatus.fromString(json['status'] as String),
      lastSyncAt: json['lastSyncAt'] != null
          ? DateTime.parse(json['lastSyncAt'] as String)
          : null,
      lastSyncError: json['lastSyncError'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'vendor': vendor.toApiString(),
      'status': status.toApiString(),
      'lastSyncAt': lastSyncAt?.toIso8601String(),
      'lastSyncError': lastSyncError,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  bool get isConnected => status.isActive;

  String get lastSyncDisplay {
    if (lastSyncAt == null) {
      return 'Never synced';
    }
    final now = DateTime.now();
    final diff = now.difference(lastSyncAt!);
    if (diff.inMinutes < 1) {
      return 'Just now';
    } else if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else {
      return '${diff.inDays}d ago';
    }
  }
}

class DeviceSyncResult {
  final bool success;
  final int measurementsCreated;
  final int measurementsSkipped;
  final List<String>? errors;

  DeviceSyncResult({
    required this.success,
    required this.measurementsCreated,
    required this.measurementsSkipped,
    this.errors,
  });

  factory DeviceSyncResult.fromJson(Map<String, dynamic> json) {
    return DeviceSyncResult(
      success: json['success'] as bool,
      measurementsCreated: json['measurementsCreated'] as int,
      measurementsSkipped: json['measurementsSkipped'] as int,
      errors: (json['errors'] as List<dynamic>?)?.cast<String>(),
    );
  }

  bool get hasErrors => errors != null && errors!.isNotEmpty;
  int get totalProcessed => measurementsCreated + measurementsSkipped;
}

/// Device type (blood pressure monitor, smart scale, etc.)
class DeviceTypeInfo {
  final String id;
  final String name;
  final String icon;
  final bool connected;
  final String? source;
  final DateTime? lastSync;

  DeviceTypeInfo({
    required this.id,
    required this.name,
    required this.icon,
    required this.connected,
    this.source,
    this.lastSync,
  });

  factory DeviceTypeInfo.fromJson(Map<String, dynamic> json) {
    return DeviceTypeInfo(
      id: json['id'] as String,
      name: json['name'] as String,
      icon: json['icon'] as String,
      connected: json['connected'] as bool,
      source: json['source'] as String?,
      lastSync: json['lastSync'] != null
          ? DateTime.parse(json['lastSync'] as String)
          : null,
    );
  }

  String get lastSyncDisplay {
    if (lastSync == null) {
      return 'Never synced';
    }
    final now = DateTime.now();
    final diff = now.difference(lastSync!);
    if (diff.inMinutes < 1) {
      return 'Just now';
    } else if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else {
      return '${diff.inDays}d ago';
    }
  }

  String get sourceDisplayName {
    if (source == null) return 'Not connected';
    switch (source!.toLowerCase()) {
      case 'withings':
        return 'Withings';
      default:
        return source!;
    }
  }

  bool get isBloodPressureMonitor => id == 'blood_pressure_monitor';
  bool get isSmartScale => id == 'smart_scale';
}
