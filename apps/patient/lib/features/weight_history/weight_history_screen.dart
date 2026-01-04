import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../routes/router.dart';
import 'weight_history_provider.dart';
import 'weight_list.dart';

/// Main screen showing weight history
class WeightHistoryScreen extends StatelessWidget {
  const WeightHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) =>
          WeightHistoryProvider(context.read<ApiClient>())..fetchMeasurements(),
      child: const _WeightHistoryScreenContent(),
    );
  }
}

class _WeightHistoryScreenContent extends StatelessWidget {
  const _WeightHistoryScreenContent();

  @override
  Widget build(BuildContext context) {
    final authProvider = context.read<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Weight'),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) async {
              if (value == 'profile') {
                context.push(Routes.profile);
              } else if (value == 'logout') {
                await authProvider.logout();
              }
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'profile',
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundColor: Theme.of(context).primaryColor.withValues(alpha: 0.1),
                      child: Icon(
                        Icons.person,
                        size: 18,
                        color: Theme.of(context).primaryColor,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            authProvider.user?.name ?? 'Patient',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          Text(
                            authProvider.user?.email ?? '',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, size: 20),
                    SizedBox(width: 8),
                    Text('Log Out'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Consumer<WeightHistoryProvider>(
        builder: (context, provider, child) {
          // Loading state
          if (provider.isLoading && !provider.hasLoaded) {
            return const Center(child: CircularProgressIndicator());
          }

          // Error state
          if (provider.error != null && !provider.hasLoaded) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline,
                      size: 48, color: Colors.red.shade400),
                  const SizedBox(height: 16),
                  Text(provider.error!),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.fetchMeasurements(refresh: true),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          // Empty state
          if (provider.isEmpty) {
            return WeightListEmpty(
              onAddWeight: () => context.go(Routes.addWeight),
            );
          }

          // Data loaded
          return WeightList(
            measurements: provider.measurements,
            onRefresh: provider.refresh,
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await context.push(Routes.addWeight);
          if (context.mounted) {
            context.read<WeightHistoryProvider>().refresh();
          }
        },
        icon: const Icon(Icons.add),
        label: const Text('Add Weight'),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: 0,
        onDestinationSelected: (index) {
          if (index == 1) {
            context.go(Routes.bp);
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.monitor_weight_outlined),
            selectedIcon: Icon(Icons.monitor_weight),
            label: 'Weight',
          ),
          NavigationDestination(
            icon: Icon(Icons.favorite_outline),
            selectedIcon: Icon(Icons.favorite),
            label: 'Blood Pressure',
          ),
        ],
      ),
    );
  }
}
