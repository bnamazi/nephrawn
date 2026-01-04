import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../routes/router.dart';
import 'registration_form.dart';

/// Registration screen for new patient accounts
class RegistrationScreen extends StatelessWidget {
  const RegistrationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo / Title
                  Icon(
                    Icons.monitor_heart_outlined,
                    size: 64,
                    color: Theme.of(context).primaryColor,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Nephrawn',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: Theme.of(context).primaryColor,
                        ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Create your account',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),

                  // Registration form
                  Consumer<AuthProvider>(
                    builder: (context, authProvider, child) {
                      return RegistrationForm(
                        isLoading: authProvider.isLoading,
                        errorMessage: authProvider.error,
                        onSubmit: ({
                          required String email,
                          required String password,
                          required String name,
                          required String dateOfBirth,
                        }) async {
                          authProvider.clearError();
                          await authProvider.register(
                            email: email,
                            password: password,
                            name: name,
                            dateOfBirth: dateOfBirth,
                          );
                        },
                      );
                    },
                  ),
                  const SizedBox(height: 24),

                  // Sign in link
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
            ),
          ),
        ),
      ),
    );
  }
}
