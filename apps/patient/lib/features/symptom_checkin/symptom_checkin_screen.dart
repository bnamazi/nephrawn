import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../routes/router.dart';
import 'symptom_checkin_provider.dart';
import 'widgets/checkin_list_item.dart';

/// Screen showing symptom check-in history
class SymptomCheckinScreen extends StatelessWidget {
  const SymptomCheckinScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) =>
          SymptomCheckinProvider(context.read<ApiClient>())..fetchCheckins(),
      child: const _SymptomCheckinScreenContent(),
    );
  }
}

class _SymptomCheckinScreenContent extends StatelessWidget {
  const _SymptomCheckinScreenContent();

  @override
  Widget build(BuildContext context) {
    final authProvider = context.read<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Symptoms'),
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
                      backgroundColor:
                          Theme.of(context).primaryColor.withValues(alpha: 0.1),
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
      bottomNavigationBar: NavigationBar(
        selectedIndex: 3,
        onDestinationSelected: (index) {
          switch (index) {
            case 0:
              context.go(Routes.home);
              break;
            case 1:
              context.go(Routes.weight);
              break;
            case 2:
              context.go(Routes.bp);
              break;
            case 3:
              // Already on symptoms
              break;
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.monitor_weight_outlined),
            selectedIcon: Icon(Icons.monitor_weight),
            label: 'Weight',
          ),
          NavigationDestination(
            icon: Icon(Icons.favorite_outline),
            selectedIcon: Icon(Icons.favorite),
            label: 'BP',
          ),
          NavigationDestination(
            icon: Icon(Icons.medical_information_outlined),
            selectedIcon: Icon(Icons.medical_information),
            label: 'Symptoms',
          ),
        ],
      ),
      body: Consumer<SymptomCheckinProvider>(
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
                    onPressed: () => provider.fetchCheckins(refresh: true),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          // Empty state
          if (provider.isEmpty) {
            return CheckinListEmpty(
              onAddCheckin: () async {
                await context.push(Routes.addCheckin);
                if (context.mounted) {
                  context.read<SymptomCheckinProvider>().refresh();
                }
              },
            );
          }

          // Data loaded - show list
          return RefreshIndicator(
            onRefresh: provider.refresh,
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: provider.checkins.length,
              itemBuilder: (context, index) {
                final checkin = provider.checkins[index];
                return CheckinListItem(checkin: checkin);
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await context.push(Routes.addCheckin);
          if (context.mounted) {
            context.read<SymptomCheckinProvider>().refresh();
          }
        },
        icon: const Icon(Icons.add),
        label: const Text('Check-in'),
      ),
    );
  }
}
