import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../routes/router.dart';
import 'bp_chart.dart';
import 'bp_list.dart';
import 'bp_provider.dart';

/// Screen showing blood pressure history with chart
class BPHistoryScreen extends StatelessWidget {
  const BPHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) =>
          BPProvider(context.read<ApiClient>())..fetchHistory(),
      child: const _BPHistoryScreenContent(),
    );
  }
}

class _BPHistoryScreenContent extends StatelessWidget {
  const _BPHistoryScreenContent();

  @override
  Widget build(BuildContext context) {
    final authProvider = context.read<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Blood Pressure'),
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
      bottomNavigationBar: NavigationBar(
        selectedIndex: 2,
        onDestinationSelected: (index) {
          switch (index) {
            case 0:
              context.go(Routes.home);
              break;
            case 1:
              context.go(Routes.weight);
              break;
            case 2:
              // Already on BP
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
            label: 'Blood Pressure',
          ),
        ],
      ),
      body: Consumer<BPProvider>(
        builder: (context, provider, child) {
          // Loading state
          if (provider.isLoadingHistory && !provider.hasLoadedHistory) {
            return const Center(child: CircularProgressIndicator());
          }

          // Error state
          if (provider.historyError != null && !provider.hasLoadedHistory) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline, size: 48, color: Colors.red.shade400),
                  const SizedBox(height: 16),
                  Text(provider.historyError!),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.fetchHistory(refresh: true),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          // Empty state
          if (provider.isEmpty) {
            return BPListEmpty(
              onAddBP: () async {
                await context.push(Routes.addBP);
                if (context.mounted) {
                  context.read<BPProvider>().refreshHistory();
                }
              },
            );
          }

          // Data loaded - show chart and list
          return RefreshIndicator(
            onRefresh: provider.refreshHistory,
            child: CustomScrollView(
              slivers: [
                // Chart section
                SliverToBoxAdapter(
                  child: Card(
                    margin: const EdgeInsets.all(16),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Trend',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 8),
                          BPChart(
                            readings: provider.readings.take(10).toList().reversed.toList(),
                            height: 180,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                // List header
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'History',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                ),
                // List items
                SliverPadding(
                  padding: const EdgeInsets.all(16),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final reading = provider.readings[index];
                        return _BPHistoryItem(reading: reading);
                      },
                      childCount: provider.readings.length,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await context.push(Routes.addBP);
          if (context.mounted) {
            context.read<BPProvider>().refreshHistory();
          }
        },
        icon: const Icon(Icons.add),
        label: const Text('Add BP'),
      ),
    );
  }
}

class _BPHistoryItem extends StatelessWidget {
  final dynamic reading;

  const _BPHistoryItem({required this.reading});

  Color _getCategoryColor() {
    if (reading.systolic < 120 && reading.diastolic < 80) {
      return Colors.green;
    } else if (reading.systolic < 130 && reading.diastolic < 80) {
      return Colors.amber;
    } else if (reading.systolic < 140 || reading.diastolic < 90) {
      return Colors.orange;
    } else {
      return Colors.red;
    }
  }

  @override
  Widget build(BuildContext context) {
    final categoryColor = _getCategoryColor();

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: categoryColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(Icons.favorite, color: categoryColor, size: 20),
        ),
        title: Text(
          '${reading.systolic}/${reading.diastolic} mmHg',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Text(
          _formatDate(reading.timestamp),
          style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: categoryColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            reading.category,
            style: TextStyle(fontSize: 11, color: categoryColor),
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else if (diff.inDays < 7) {
      return '${diff.inDays}d ago';
    } else {
      return '${date.month}/${date.day}/${date.year}';
    }
  }
}
