import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import 'bp_entry_form.dart';
import 'bp_provider.dart';

/// Screen for entering blood pressure measurement
class BPEntryScreen extends StatelessWidget {
  const BPEntryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) => BPProvider(context.read<ApiClient>()),
      child: const _BPEntryScreenContent(),
    );
  }
}

class _BPEntryScreenContent extends StatelessWidget {
  const _BPEntryScreenContent();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add Blood Pressure'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Consumer<BPProvider>(
            builder: (context, provider, child) {
              return BPEntryForm(
                isLoading: provider.isSubmitting,
                errorMessage: provider.submitError,
                onSubmit: (systolic, diastolic) async {
                  final success = await provider.submitBP(systolic, diastolic);
                  if (success && context.mounted) {
                    final message = provider.isDuplicate
                        ? 'Blood pressure already recorded'
                        : 'Blood pressure saved successfully';
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(message),
                        backgroundColor:
                            provider.isDuplicate ? Colors.orange : Colors.green,
                      ),
                    );
                    if (context.canPop()) {
                      context.pop();
                    } else {
                      context.go('/bp');
                    }
                  }
                },
              );
            },
          ),
        ),
      ),
    );
  }
}
