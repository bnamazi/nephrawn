import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/widgets/app_bottom_nav.dart';
import '../../core/widgets/source_badge.dart';
import '../../routes/router.dart';
import 'weight_chart.dart';
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

          // Data loaded - show chart and list
          return RefreshIndicator(
            onRefresh: provider.refresh,
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
                          WeightChart(
                            measurements: provider.measurements.take(10).toList().reversed.toList(),
                            height: 180,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                // Body composition link
                SliverToBoxAdapter(
                  child: Card(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    child: ListTile(
                      leading: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: Colors.green.shade50,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(
                          Icons.accessibility_new,
                          color: Colors.green.shade600,
                          size: 20,
                        ),
                      ),
                      title: const Text('Body Composition'),
                      subtitle: const Text('View fat %, muscle mass & more'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push(Routes.bodyComposition),
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 8)),
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
                        final measurement = provider.measurements[index];
                        return _WeightHistoryItem(measurement: measurement);
                      },
                      childCount: provider.measurements.length,
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
          await context.push(Routes.addWeight);
          if (context.mounted) {
            context.read<WeightHistoryProvider>().refresh();
          }
        },
        icon: const Icon(Icons.add),
        label: const Text('Add Weight'),
      ),
      bottomNavigationBar: const AppBottomNav(currentIndex: NavIndex.weight),
    );
  }
}

class _WeightHistoryItem extends StatelessWidget {
  final dynamic measurement;

  const _WeightHistoryItem({required this.measurement});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: Theme.of(context).primaryColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            Icons.monitor_weight,
            color: Theme.of(context).primaryColor,
            size: 20,
          ),
        ),
        title: Row(
          children: [
            Text(
              '${measurement.displayValue.toStringAsFixed(1)} ${measurement.displayUnit}',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(width: 8),
            SourceBadge(source: measurement.source),
          ],
        ),
        subtitle: Text(
          _formatDate(measurement.timestamp),
          style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
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
