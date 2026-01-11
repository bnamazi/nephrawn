import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/models/body_composition.dart';
import '../../core/widgets/app_bottom_nav.dart';
import '../../core/widgets/source_badge.dart';
import '../../routes/router.dart';
import 'body_composition_provider.dart';

/// Screen showing body composition data from smart scale
class BodyCompositionScreen extends StatelessWidget {
  const BodyCompositionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) =>
          BodyCompositionProvider(context.read<ApiClient>())..fetchData(),
      child: const _BodyCompositionScreenContent(),
    );
  }
}

class _BodyCompositionScreenContent extends StatelessWidget {
  const _BodyCompositionScreenContent();

  @override
  Widget build(BuildContext context) {
    final authProvider = context.read<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Body Composition'),
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
      body: Consumer<BodyCompositionProvider>(
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
                  Icon(Icons.error_outline, size: 48, color: Colors.red.shade400),
                  const SizedBox(height: 16),
                  Text(provider.error!),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.fetchData(refresh: true),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          // Empty state
          if (provider.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.accessibility_new,
                      size: 64, color: Colors.grey.shade400),
                  const SizedBox(height: 16),
                  Text(
                    'No Body Composition Data',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Connect a Withings scale to see\nyour body composition metrics',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: () => context.push(Routes.devices),
                    icon: const Icon(Icons.devices),
                    label: const Text('Connect Device'),
                  ),
                ],
              ),
            );
          }

          // Data loaded - show latest and history
          return RefreshIndicator(
            onRefresh: provider.refresh,
            child: CustomScrollView(
              slivers: [
                // Latest reading summary
                if (provider.latestReading != null)
                  SliverToBoxAdapter(
                    child: _LatestReadingCard(reading: provider.latestReading!),
                  ),
                // History header
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    child: Text(
                      'History',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                ),
                // History list
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final reading = provider.readings[index];
                        return _BodyCompHistoryItem(reading: reading);
                      },
                      childCount: provider.readings.length,
                    ),
                  ),
                ),
                const SliverPadding(padding: EdgeInsets.only(bottom: 24)),
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: const AppBottomNav(currentIndex: NavIndex.weight),
    );
  }
}

/// Card showing the latest body composition reading
class _LatestReadingCard extends StatelessWidget {
  final BodyCompositionReading reading;

  const _LatestReadingCard({required this.reading});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  'Latest Reading',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const Spacer(),
                SourceBadge(source: reading.source),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              _formatDate(reading.timestamp),
              style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
            ),
            const Divider(height: 24),
            _buildMetricsGrid(context),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricsGrid(BuildContext context) {
    final metrics = <Widget>[];

    if (reading.fatRatio != null) {
      metrics.add(_MetricTile(
        icon: Icons.water_drop,
        label: 'Body Fat',
        value: '${reading.fatRatio!.toStringAsFixed(1)}%',
        color: Colors.orange,
      ));
    }

    if (reading.muscleMassKg != null) {
      metrics.add(_MetricTile(
        icon: Icons.fitness_center,
        label: 'Muscle',
        value: '${reading.kgToLbs(reading.muscleMassKg!).toStringAsFixed(1)} lbs',
        color: Colors.blue,
      ));
    }

    if (reading.fatMassKg != null) {
      metrics.add(_MetricTile(
        icon: Icons.pie_chart,
        label: 'Fat Mass',
        value: '${reading.kgToLbs(reading.fatMassKg!).toStringAsFixed(1)} lbs',
        color: Colors.amber,
      ));
    }

    if (reading.fatFreeKg != null) {
      metrics.add(_MetricTile(
        icon: Icons.accessibility_new,
        label: 'Lean Mass',
        value: '${reading.kgToLbs(reading.fatFreeKg!).toStringAsFixed(1)} lbs',
        color: Colors.green,
      ));
    }

    if (reading.hydrationKg != null) {
      metrics.add(_MetricTile(
        icon: Icons.water,
        label: 'Hydration',
        value: '${reading.kgToLbs(reading.hydrationKg!).toStringAsFixed(1)} lbs',
        color: Colors.cyan,
      ));
    }

    if (reading.boneMassKg != null) {
      metrics.add(_MetricTile(
        icon: Icons.medical_information,
        label: 'Bone Mass',
        value: '${reading.kgToLbs(reading.boneMassKg!).toStringAsFixed(1)} lbs',
        color: Colors.grey,
      ));
    }

    if (reading.pulseWaveVelocity != null) {
      metrics.add(_MetricTile(
        icon: Icons.favorite,
        label: 'PWV',
        value: '${reading.pulseWaveVelocity!.toStringAsFixed(1)} m/s',
        color: Colors.red,
      ));
    }

    if (metrics.isEmpty) {
      return const Text('No metrics available');
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: metrics,
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

class _MetricTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const _MetricTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: (MediaQuery.of(context).size.width - 56) / 2,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade600,
                  ),
                ),
                Text(
                  value,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BodyCompHistoryItem extends StatelessWidget {
  final BodyCompositionReading reading;

  const _BodyCompHistoryItem({required this.reading});

  @override
  Widget build(BuildContext context) {
    final summaryParts = <String>[];

    if (reading.fatRatio != null) {
      summaryParts.add('${reading.fatRatio!.toStringAsFixed(1)}% fat');
    }
    if (reading.muscleMassKg != null) {
      summaryParts
          .add('${reading.kgToLbs(reading.muscleMassKg!).toStringAsFixed(0)} lbs muscle');
    }

    final summary =
        summaryParts.isNotEmpty ? summaryParts.join(', ') : 'No data';

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
            Icons.accessibility_new,
            color: Theme.of(context).primaryColor,
            size: 20,
          ),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                summary,
                style: const TextStyle(fontWeight: FontWeight.bold),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            SourceBadge(source: reading.source, compact: true),
          ],
        ),
        subtitle: Text(
          _formatDate(reading.timestamp),
          style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
        ),
        trailing: Text(
          '${reading.availableMetricsCount} metrics',
          style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
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
