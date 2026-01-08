enum DocumentType {
  labResult,
  other;

  String get displayName {
    switch (this) {
      case DocumentType.labResult:
        return 'Lab Result';
      case DocumentType.other:
        return 'Other';
    }
  }

  static DocumentType fromString(String value) {
    switch (value) {
      case 'LAB_RESULT':
        return DocumentType.labResult;
      case 'OTHER':
        return DocumentType.other;
      default:
        return DocumentType.other;
    }
  }

  String toApiString() {
    switch (this) {
      case DocumentType.labResult:
        return 'LAB_RESULT';
      case DocumentType.other:
        return 'OTHER';
    }
  }
}

class Document {
  final String id;
  final String patientId;
  final DocumentType type;
  final String filename;
  final String mimeType;
  final int sizeBytes;
  final String? title;
  final String? notes;
  final DateTime? documentDate;
  final DateTime uploadedAt;
  final DateTime createdAt;

  Document({
    required this.id,
    required this.patientId,
    required this.type,
    required this.filename,
    required this.mimeType,
    required this.sizeBytes,
    this.title,
    this.notes,
    this.documentDate,
    required this.uploadedAt,
    required this.createdAt,
  });

  factory Document.fromJson(Map<String, dynamic> json) {
    return Document(
      id: json['id'] as String,
      patientId: json['patientId'] as String,
      type: DocumentType.fromString(json['type'] as String),
      filename: json['filename'] as String,
      mimeType: json['mimeType'] as String,
      sizeBytes: json['sizeBytes'] as int,
      title: json['title'] as String?,
      notes: json['notes'] as String?,
      documentDate: json['documentDate'] != null
          ? DateTime.parse(json['documentDate'] as String)
          : null,
      uploadedAt: DateTime.parse(json['uploadedAt'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'patientId': patientId,
      'type': type.toApiString(),
      'filename': filename,
      'mimeType': mimeType,
      'sizeBytes': sizeBytes,
      'title': title,
      'notes': notes,
      'documentDate': documentDate?.toIso8601String(),
      'uploadedAt': uploadedAt.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
    };
  }

  String get formattedSize {
    if (sizeBytes < 1024) {
      return '$sizeBytes B';
    } else if (sizeBytes < 1024 * 1024) {
      return '${(sizeBytes / 1024).toStringAsFixed(1)} KB';
    } else {
      return '${(sizeBytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
  }

  String get displayTitle => title ?? filename;

  bool get isPdf => mimeType == 'application/pdf';
  bool get isImage => mimeType.startsWith('image/');
}
