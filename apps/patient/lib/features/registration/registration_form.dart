import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/primary_button.dart';

/// Registration form widget with email, password, name, and DOB fields
class RegistrationForm extends StatefulWidget {
  final Future<void> Function({
    required String email,
    required String password,
    required String name,
    required String dateOfBirth,
  }) onSubmit;
  final bool isLoading;
  final String? errorMessage;

  const RegistrationForm({
    super.key,
    required this.onSubmit,
    this.isLoading = false,
    this.errorMessage,
  });

  @override
  State<RegistrationForm> createState() => _RegistrationFormState();
}

class _RegistrationFormState extends State<RegistrationForm> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _nameController = TextEditingController();
  final _dobController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  DateTime? _selectedDate;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _nameController.dispose();
    _dobController.dispose();
    super.dispose();
  }

  Future<void> _selectDate(BuildContext context) async {
    final now = DateTime.now();
    final eighteenYearsAgo = DateTime(now.year - 18, now.month, now.day);

    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime(1980),
      firstDate: DateTime(1920),
      lastDate: eighteenYearsAgo,
      helpText: 'Select your date of birth',
    );

    if (picked != null) {
      setState(() {
        _selectedDate = picked;
        _dobController.text = DateFormat('MMMM d, yyyy').format(picked);
      });
    }
  }

  void _submit() {
    if (_formKey.currentState!.validate()) {
      widget.onSubmit(
        email: _emailController.text.trim(),
        password: _passwordController.text,
        name: _nameController.text.trim(),
        dateOfBirth: DateFormat('yyyy-MM-dd').format(_selectedDate!),
      );
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

          // Name field
          TextFormField(
            controller: _nameController,
            keyboardType: TextInputType.name,
            textInputAction: TextInputAction.next,
            textCapitalization: TextCapitalization.words,
            enabled: !widget.isLoading,
            decoration: const InputDecoration(
              labelText: 'Full Name',
              prefixIcon: Icon(Icons.person_outlined),
            ),
            validator: Validators.name,
          ),
          const SizedBox(height: 16),

          // Email field
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autocorrect: false,
            enabled: !widget.isLoading,
            decoration: const InputDecoration(
              labelText: 'Email',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            validator: Validators.email,
          ),
          const SizedBox(height: 16),

          // Password field
          TextFormField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            textInputAction: TextInputAction.next,
            enabled: !widget.isLoading,
            decoration: InputDecoration(
              labelText: 'Password',
              prefixIcon: const Icon(Icons.lock_outlined),
              helperText: 'Min 8 chars with uppercase, lowercase, and number',
              helperMaxLines: 2,
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? Icons.visibility : Icons.visibility_off,
                ),
                onPressed: () {
                  setState(() {
                    _obscurePassword = !_obscurePassword;
                  });
                },
              ),
            ),
            validator: Validators.password,
          ),
          const SizedBox(height: 16),

          // Confirm Password field
          TextFormField(
            controller: _confirmPasswordController,
            obscureText: _obscureConfirmPassword,
            textInputAction: TextInputAction.next,
            enabled: !widget.isLoading,
            decoration: InputDecoration(
              labelText: 'Confirm Password',
              prefixIcon: const Icon(Icons.lock_outlined),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscureConfirmPassword ? Icons.visibility : Icons.visibility_off,
                ),
                onPressed: () {
                  setState(() {
                    _obscureConfirmPassword = !_obscureConfirmPassword;
                  });
                },
              ),
            ),
            validator: Validators.confirmPassword(_passwordController.text),
          ),
          const SizedBox(height: 16),

          // Date of Birth field
          TextFormField(
            controller: _dobController,
            readOnly: true,
            enabled: !widget.isLoading,
            onTap: () => _selectDate(context),
            decoration: const InputDecoration(
              labelText: 'Date of Birth',
              prefixIcon: Icon(Icons.cake_outlined),
              suffixIcon: Icon(Icons.calendar_today),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter your date of birth';
              }
              return null;
            },
          ),
          const SizedBox(height: 24),

          // Submit button
          PrimaryButton(
            text: 'Create Account',
            onPressed: _submit,
            isLoading: widget.isLoading,
          ),
        ],
      ),
    );
  }
}
