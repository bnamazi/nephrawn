import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/widgets/primary_button.dart';
import '../../routes/router.dart';
import 'join_clinic_provider.dart';

/// Success screen after claiming an invite
class ClaimSuccessScreen extends StatelessWidget {
  const ClaimSuccessScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Consumer<JoinClinicProvider>(
              builder: (context, provider, child) {
                return Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Success icon
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: Colors.green.shade100,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.check,
                        size: 48,
                        color: Colors.green.shade700,
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Title
                    Text(
                      'Welcome!',
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                      textAlign: TextAlign.center,
                    ),

                    const SizedBox(height: 8),

                    // Subtitle
                    Text(
                      'Your account has been created and you\'ve been enrolled at',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: Colors.grey.shade600,
                          ),
                      textAlign: TextAlign.center,
                    ),

                    const SizedBox(height: 8),

                    // Clinic name
                    if (provider.claimResult?.clinicName != null)
                      Text(
                        provider.claimResult!.clinicName!,
                        style:
                            Theme.of(context).textTheme.titleLarge?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: Theme.of(context).primaryColor,
                                ),
                        textAlign: TextAlign.center,
                      ),

                    const SizedBox(height: 32),

                    // Info card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.blue.shade200),
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              Icon(Icons.info_outline,
                                  color: Colors.blue.shade700),
                              const SizedBox(width: 12),
                              const Expanded(
                                child: Text(
                                  'What\'s next?',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'You can now start tracking your health metrics. '
                            'Your healthcare team will be able to monitor your progress '
                            'and provide personalized guidance.',
                            style: TextStyle(fontSize: 14),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 32),

                    // Continue button
                    PrimaryButton(
                      text: 'Go to Dashboard',
                      onPressed: () {
                        // Reset the provider state
                        provider.reset();
                        // Navigate to home
                        context.go(Routes.home);
                      },
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
