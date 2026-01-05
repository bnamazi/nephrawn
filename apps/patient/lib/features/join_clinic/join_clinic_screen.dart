import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/widgets/primary_button.dart';
import '../../routes/router.dart';
import 'join_clinic_provider.dart';

/// Screen for entering an invite code to join a clinic
class JoinClinicScreen extends StatefulWidget {
  const JoinClinicScreen({super.key});

  @override
  State<JoinClinicScreen> createState() => _JoinClinicScreenState();
}

class _JoinClinicScreenState extends State<JoinClinicScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _validateCode() async {
    if (!_formKey.currentState!.validate()) return;

    final provider = context.read<JoinClinicProvider>();
    final success = await provider.validateCode(_codeController.text.trim());

    if (success && mounted) {
      context.go(Routes.claimInvite);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Join Clinic'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go(Routes.login),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Consumer<JoinClinicProvider>(
                builder: (context, provider, child) {
                  return Form(
                    key: _formKey,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Icon
                        Icon(
                          Icons.local_hospital_outlined,
                          size: 64,
                          color: Theme.of(context).primaryColor,
                        ),
                        const SizedBox(height: 16),

                        // Title
                        Text(
                          'Join a Clinic',
                          style:
                              Theme.of(context).textTheme.headlineMedium?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),

                        // Subtitle
                        Text(
                          'Enter the invite code provided by your healthcare provider',
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                color: Colors.grey.shade600,
                              ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 32),

                        // Code input
                        TextFormField(
                          controller: _codeController,
                          decoration: const InputDecoration(
                            labelText: 'Invite Code',
                            hintText: 'Enter your invite code',
                            border: OutlineInputBorder(),
                            prefixIcon: Icon(Icons.vpn_key_outlined),
                          ),
                          textCapitalization: TextCapitalization.characters,
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Please enter an invite code';
                            }
                            if (value.trim().length != 40) {
                              return 'Invite code must be 40 characters';
                            }
                            return null;
                          },
                          enabled: !provider.isLoading,
                        ),
                        const SizedBox(height: 16),

                        // Error message
                        if (provider.error != null)
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.red.shade50,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.red.shade200),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.error_outline,
                                    color: Colors.red.shade700, size: 20),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    provider.error!,
                                    style: TextStyle(color: Colors.red.shade700),
                                  ),
                                ),
                              ],
                            ),
                          ),

                        const SizedBox(height: 24),

                        // Submit button
                        PrimaryButton(
                          text: 'Validate Code',
                          onPressed: _validateCode,
                          isLoading: provider.isLoading,
                        ),

                        const SizedBox(height: 24),

                        // Back to login link
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              'Already have an account? ',
                              style: TextStyle(color: Colors.grey.shade600),
                            ),
                            TextButton(
                              onPressed: () => context.go(Routes.login),
                              child: const Text('Sign in'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}
