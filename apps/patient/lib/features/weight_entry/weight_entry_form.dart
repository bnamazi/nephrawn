import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/widgets/primary_button.dart';

/// Form for entering weight measurement
class WeightEntryForm extends StatefulWidget {
  final Future<void> Function(double weight) onSubmit;
  final bool isLoading;
  final String? errorMessage;

  const WeightEntryForm({
    super.key,
    required this.onSubmit,
    this.isLoading = false,
    this.errorMessage,
  });

  @override
  State<WeightEntryForm> createState() => _WeightEntryFormState();
}

class _WeightEntryFormState extends State<WeightEntryForm> {
  final _formKey = GlobalKey<FormState>();
  final _weightController = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    // Auto-focus the weight field
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _weightController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState!.validate()) {
      final weight = double.parse(_weightController.text.trim());
      widget.onSubmit(weight);
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

          // Weight input
          TextFormField(
            controller: _weightController,
            focusNode: _focusNode,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textInputAction: TextInputAction.done,
            enabled: !widget.isLoading,
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,1}')),
            ],
            onFieldSubmitted: (_) => _submit(),
            style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
            decoration: InputDecoration(
              labelText: 'Weight',
              suffixText: 'lbs',
              suffixStyle: TextStyle(
                fontSize: 20,
                color: Colors.grey.shade600,
              ),
              helperText: 'Enter your weight in pounds',
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter your weight';
              }
              final weight = double.tryParse(value);
              if (weight == null) {
                return 'Please enter a valid number';
              }
              if (weight < 50 || weight > 700) {
                return 'Please enter a weight between 50 and 700 lbs';
              }
              return null;
            },
          ),
          const SizedBox(height: 32),

          // Submit button
          PrimaryButton(
            text: 'Save Weight',
            onPressed: _submit,
            isLoading: widget.isLoading,
          ),
        ],
      ),
    );
  }
}
