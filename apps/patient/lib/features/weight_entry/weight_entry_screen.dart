import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import 'weight_entry_form.dart';
import 'weight_provider.dart';

/// Screen for entering weight measurement
class WeightEntryScreen extends StatelessWidget {
  const WeightEntryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) => WeightEntryProvider(context.read<ApiClient>()),
      child: const _WeightEntryScreenContent(),
    );
  }
}

class _WeightEntryScreenContent extends StatelessWidget {
  const _WeightEntryScreenContent();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add Weight'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Consumer<WeightEntryProvider>(
            builder: (context, provider, child) {
              return WeightEntryForm(
                isLoading: provider.isLoading,
                errorMessage: provider.error,
                onSubmit: (weight) async {
                  final success = await provider.submitWeight(weight);
                  if (success && context.mounted) {
                    // Show success message
                    final message = provider.isDuplicate
                        ? 'Weight already recorded'
                        : 'Weight saved successfully';
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(message),
                        backgroundColor: provider.isDuplicate
                            ? Colors.orange
                            : Colors.green,
                      ),
                    );
                    // Navigate back
                    if (context.canPop()) {
                      context.pop();
                    } else {
                      context.go('/');
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
