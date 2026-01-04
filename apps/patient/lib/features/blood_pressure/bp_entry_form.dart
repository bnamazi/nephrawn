import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/widgets/primary_button.dart';

/// Form for entering blood pressure measurement
class BPEntryForm extends StatefulWidget {
  final Future<void> Function(int systolic, int diastolic) onSubmit;
  final bool isLoading;
  final String? errorMessage;

  const BPEntryForm({
    super.key,
    required this.onSubmit,
    this.isLoading = false,
    this.errorMessage,
  });

  @override
  State<BPEntryForm> createState() => _BPEntryFormState();
}

class _BPEntryFormState extends State<BPEntryForm> {
  final _formKey = GlobalKey<FormState>();
  final _systolicController = TextEditingController();
  final _diastolicController = TextEditingController();
  final _systolicFocus = FocusNode();
  final _diastolicFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _systolicFocus.requestFocus();
    });
  }

  @override
  void dispose() {
    _systolicController.dispose();
    _diastolicController.dispose();
    _systolicFocus.dispose();
    _diastolicFocus.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState!.validate()) {
      final systolic = int.parse(_systolicController.text.trim());
      final diastolic = int.parse(_diastolicController.text.trim());
      widget.onSubmit(systolic, diastolic);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Error message
          if (widget.errorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline, color: Colors.red.shade700),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.errorMessage!,
                      style: TextStyle(color: Colors.red.shade700),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // BP Input Row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Systolic
              Expanded(
                child: TextFormField(
                  controller: _systolicController,
                  focusNode: _systolicFocus,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  enabled: !widget.isLoading,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(3),
                  ],
                  onFieldSubmitted: (_) => _diastolicFocus.requestFocus(),
                  style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                  decoration: const InputDecoration(
                    labelText: 'Systolic',
                    helperText: 'Top number',
                    suffixText: 'mmHg',
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Required';
                    }
                    final num = int.tryParse(value);
                    if (num == null) {
                      return 'Invalid';
                    }
                    if (num < 60 || num > 250) {
                      return '60-250';
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 16),
              // Divider
              const Padding(
                padding: EdgeInsets.only(top: 24),
                child: Text(
                  '/',
                  style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 16),
              // Diastolic
              Expanded(
                child: TextFormField(
                  controller: _diastolicController,
                  focusNode: _diastolicFocus,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.done,
                  enabled: !widget.isLoading,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(3),
                  ],
                  onFieldSubmitted: (_) => _submit(),
                  style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                  decoration: const InputDecoration(
                    labelText: 'Diastolic',
                    helperText: 'Bottom number',
                    suffixText: 'mmHg',
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Required';
                    }
                    final num = int.tryParse(value);
                    if (num == null) {
                      return 'Invalid';
                    }
                    if (num < 40 || num > 150) {
                      return '40-150';
                    }
                    return null;
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),

          // Submit button
          PrimaryButton(
            text: 'Save Blood Pressure',
            onPressed: _submit,
            isLoading: widget.isLoading,
          ),
        ],
      ),
    );
  }
}
