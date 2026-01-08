import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';
import '../../core/models/document.dart';
import 'documents_provider.dart';

class DocumentsScreen extends StatelessWidget {
  const DocumentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) =>
          DocumentsProvider(context.read<ApiClient>())..fetchDocuments(),
      child: const _DocumentsScreenContent(),
    );
  }
}

class _DocumentsScreenContent extends StatelessWidget {
  const _DocumentsScreenContent();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lab Results & Documents'),
      ),
      body: Consumer<DocumentsProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.error != null && provider.documents.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline, size: 48, color: Colors.red.shade400),
                  const SizedBox(height: 16),
                  Text(provider.error!),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.fetchDocuments(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          if (provider.documents.isEmpty) {
            return _buildEmptyState(context);
          }

          return RefreshIndicator(
            onRefresh: () => provider.fetchDocuments(),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: provider.documents.length,
              itemBuilder: (context, index) {
                final doc = provider.documents[index];
                return _DocumentCard(
                  document: doc,
                  onTap: () => _showDocumentDetails(context, doc),
                  onDelete: () => _confirmDelete(context, doc),
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: Consumer<DocumentsProvider>(
        builder: (context, provider, child) {
          return FloatingActionButton.extended(
            onPressed: provider.isUploading ? null : () => _pickAndUpload(context),
            icon: provider.isUploading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.upload_file),
            label: Text(provider.isUploading ? 'Uploading...' : 'Upload'),
          );
        },
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: Colors.teal.shade50,
                borderRadius: BorderRadius.circular(40),
              ),
              child: Icon(
                Icons.folder_open_outlined,
                size: 40,
                color: Colors.teal.shade400,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'No documents yet',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.grey.shade600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Upload lab results and other documents\nfor your care team to review',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey.shade500,
                  ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickAndUpload(BuildContext context) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'heic'],
      withData: true,
    );

    if (result != null && result.files.isNotEmpty && context.mounted) {
      final file = result.files.first;

      // Show upload dialog for metadata
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => _UploadDialog(
          file: file,
          onUpload: (title, notes, date, type) async {
            final provider = context.read<DocumentsProvider>();
            final success = await provider.uploadDocument(
              file: file,
              title: title,
              notes: notes,
              documentDate: date,
              type: type,
            );
            if (dialogContext.mounted) {
              Navigator.of(dialogContext).pop();
            }
            if (success && context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Document uploaded successfully'),
                  backgroundColor: Colors.green,
                ),
              );
            } else if (!success && context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(provider.error ?? 'Upload failed'),
                  backgroundColor: Colors.red,
                ),
              );
            }
          },
        ),
      );
    }
  }

  void _showDocumentDetails(BuildContext context, Document doc) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => _DocumentDetailsSheet(
        document: doc,
        onView: () async {
          Navigator.pop(sheetContext);
          final provider = context.read<DocumentsProvider>();
          final url = await provider.getDownloadUrl(doc.id);
          if (url != null && context.mounted) {
            final uri = Uri.parse(url);
            if (await canLaunchUrl(uri)) {
              await launchUrl(uri, mode: LaunchMode.externalApplication);
            } else if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Could not open document'),
                  backgroundColor: Colors.red,
                ),
              );
            }
          }
        },
        onEdit: () {
          Navigator.pop(sheetContext);
          _showEditDialog(context, doc);
        },
        onDelete: () {
          Navigator.pop(sheetContext);
          _confirmDelete(context, doc);
        },
      ),
    );
  }

  void _showEditDialog(BuildContext context, Document doc) {
    showDialog(
      context: context,
      builder: (dialogContext) => _EditDocumentDialog(
        document: doc,
        onSave: (title, notes, date, type) async {
          final provider = context.read<DocumentsProvider>();
          final success = await provider.updateDocument(
            doc.id,
            title: title,
            notes: notes,
            documentDate: date,
            type: type,
          );
          if (dialogContext.mounted) {
            Navigator.of(dialogContext).pop();
          }
          if (success && context.mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Document updated')),
            );
          }
        },
      ),
    );
  }

  void _confirmDelete(BuildContext context, Document doc) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete Document'),
        content: Text('Are you sure you want to delete "${doc.displayTitle}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(dialogContext);
              final provider = context.read<DocumentsProvider>();
              final success = await provider.deleteDocument(doc.id);
              if (success && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Document deleted')),
                );
              }
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

class _DocumentCard extends StatelessWidget {
  final Document document;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  const _DocumentCard({
    required this.document,
    required this.onTap,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: _getIconColor().shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  _getIcon(),
                  color: _getIconColor().shade400,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      document.displayTitle,
                      style: Theme.of(context).textTheme.titleMedium,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            document.type.displayName,
                            style: Theme.of(context).textTheme.labelSmall,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          document.formattedSize,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: Colors.grey.shade600,
                              ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _formatDate(document.documentDate ?? document.uploadedAt),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.grey.shade500,
                          ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: Colors.grey.shade400),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getIcon() {
    if (document.isPdf) return Icons.picture_as_pdf;
    if (document.isImage) return Icons.image;
    return Icons.insert_drive_file;
  }

  MaterialColor _getIconColor() {
    if (document.isPdf) return Colors.red;
    if (document.isImage) return Colors.blue;
    return Colors.grey;
  }

  String _formatDate(DateTime date) {
    return DateFormat.yMMMd().format(date);
  }
}

class _UploadDialog extends StatefulWidget {
  final PlatformFile file;
  final Future<void> Function(
    String? title,
    String? notes,
    DateTime? date,
    DocumentType type,
  ) onUpload;

  const _UploadDialog({required this.file, required this.onUpload});

  @override
  State<_UploadDialog> createState() => _UploadDialogState();
}

class _UploadDialogState extends State<_UploadDialog> {
  final _titleController = TextEditingController();
  final _notesController = TextEditingController();
  DateTime? _documentDate;
  DocumentType _type = DocumentType.labResult;
  bool _isUploading = false;

  @override
  void dispose() {
    _titleController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Upload Document'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // File info
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(Icons.attach_file, color: Colors.grey.shade600),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.file.name,
                          style: const TextStyle(fontWeight: FontWeight.w500),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          _formatSize(widget.file.size),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Document type
            DropdownButtonFormField<DocumentType>(
              initialValue: _type,
              decoration: const InputDecoration(
                labelText: 'Document Type',
                border: OutlineInputBorder(),
              ),
              items: DocumentType.values.map((type) {
                return DropdownMenuItem(
                  value: type,
                  child: Text(type.displayName),
                );
              }).toList(),
              onChanged: (value) {
                if (value != null) setState(() => _type = value);
              },
            ),
            const SizedBox(height: 16),

            // Title
            TextField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Title (optional)',
                hintText: 'e.g., Lab Results - January 2025',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),

            // Document date
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Document Date'),
              subtitle: Text(
                _documentDate != null
                    ? DateFormat.yMMMd().format(_documentDate!)
                    : 'Not set',
              ),
              trailing: const Icon(Icons.calendar_today),
              onTap: _pickDate,
            ),
            const SizedBox(height: 8),

            // Notes
            TextField(
              controller: _notesController,
              decoration: const InputDecoration(
                labelText: 'Notes (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isUploading ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _isUploading ? null : _upload,
          child: _isUploading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Upload'),
        ),
      ],
    );
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _documentDate ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
    );
    if (date != null) {
      setState(() => _documentDate = date);
    }
  }

  Future<void> _upload() async {
    setState(() => _isUploading = true);
    await widget.onUpload(
      _titleController.text.isEmpty ? null : _titleController.text,
      _notesController.text.isEmpty ? null : _notesController.text,
      _documentDate,
      _type,
    );
  }

  String _formatSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

class _DocumentDetailsSheet extends StatelessWidget {
  final Document document;
  final VoidCallback onView;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _DocumentDetailsSheet({
    required this.document,
    required this.onView,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.5,
      minChildSize: 0.3,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) {
        return SingleChildScrollView(
          controller: scrollController,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Title
                Text(
                  document.displayTitle,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),

                // Type badge
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.teal.shade50,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    document.type.displayName,
                    style: TextStyle(
                      color: Colors.teal.shade700,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Details
                _DetailRow(label: 'File', value: document.filename),
                _DetailRow(label: 'Size', value: document.formattedSize),
                _DetailRow(
                  label: 'Uploaded',
                  value: DateFormat.yMMMd().add_jm().format(document.uploadedAt),
                ),
                if (document.documentDate != null)
                  _DetailRow(
                    label: 'Document Date',
                    value: DateFormat.yMMMd().format(document.documentDate!),
                  ),
                if (document.notes != null && document.notes!.isNotEmpty)
                  _DetailRow(label: 'Notes', value: document.notes!),
                const SizedBox(height: 32),

                // Actions
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: onView,
                        icon: const Icon(Icons.visibility),
                        label: const Text('View'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: onEdit,
                        icon: const Icon(Icons.edit),
                        label: const Text('Edit'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: onDelete,
                    icon: const Icon(Icons.delete),
                    label: const Text('Delete'),
                    style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: TextStyle(
                color: Colors.grey.shade600,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Expanded(
            child: Text(value),
          ),
        ],
      ),
    );
  }
}

class _EditDocumentDialog extends StatefulWidget {
  final Document document;
  final Future<void> Function(
    String? title,
    String? notes,
    DateTime? date,
    DocumentType type,
  ) onSave;

  const _EditDocumentDialog({required this.document, required this.onSave});

  @override
  State<_EditDocumentDialog> createState() => _EditDocumentDialogState();
}

class _EditDocumentDialogState extends State<_EditDocumentDialog> {
  late final TextEditingController _titleController;
  late final TextEditingController _notesController;
  late DateTime? _documentDate;
  late DocumentType _type;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.document.title ?? '');
    _notesController = TextEditingController(text: widget.document.notes ?? '');
    _documentDate = widget.document.documentDate;
    _type = widget.document.type;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Edit Document'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<DocumentType>(
              initialValue: _type,
              decoration: const InputDecoration(
                labelText: 'Document Type',
                border: OutlineInputBorder(),
              ),
              items: DocumentType.values.map((type) {
                return DropdownMenuItem(
                  value: type,
                  child: Text(type.displayName),
                );
              }).toList(),
              onChanged: (value) {
                if (value != null) setState(() => _type = value);
              },
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Title',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Document Date'),
              subtitle: Text(
                _documentDate != null
                    ? DateFormat.yMMMd().format(_documentDate!)
                    : 'Not set',
              ),
              trailing: const Icon(Icons.calendar_today),
              onTap: _pickDate,
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _notesController,
              decoration: const InputDecoration(
                labelText: 'Notes',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSaving ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _isSaving ? null : _save,
          child: _isSaving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('Save'),
        ),
      ],
    );
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _documentDate ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
    );
    if (date != null) {
      setState(() => _documentDate = date);
    }
  }

  Future<void> _save() async {
    setState(() => _isSaving = true);
    await widget.onSave(
      _titleController.text.isEmpty ? null : _titleController.text,
      _notesController.text.isEmpty ? null : _notesController.text,
      _documentDate,
      _type,
    );
  }
}
