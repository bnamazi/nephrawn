import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/models/alert.dart';
import '../dashboard/widgets/alert_card.dart';
import 'alerts_provider.dart';

/// Screen showing all patient alerts
class AlertsScreen extends StatelessWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) =>
          AlertsProvider(context.read<ApiClient>())..fetchAlerts(),
      child: const _AlertsScreenContent(),
    );
  }
}

class _AlertsScreenContent extends StatelessWidget {
  const _AlertsScreenContent();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Alerts'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: Consumer<AlertsProvider>(
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
                    onPressed: () => provider.fetchAlerts(refresh: true),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          return Column(
            children: [
              // Filter chips
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    _FilterChip(
                      label: 'All',
                      isSelected: provider.statusFilter == null,
                      onTap: () => provider.setStatusFilter(null),
                    ),
                    const SizedBox(width: 8),
                    _FilterChip(
                      label: 'Open',
                      isSelected: provider.statusFilter == AlertStatus.open,
                      onTap: () => provider.setStatusFilter(AlertStatus.open),
                      count: provider.openCount,
                    ),
                    const SizedBox(width: 8),
                    _FilterChip(
                      label: 'Acknowledged',
                      isSelected:
                          provider.statusFilter == AlertStatus.acknowledged,
                      onTap: () =>
                          provider.setStatusFilter(AlertStatus.acknowledged),
                    ),
                  ],
                ),
              ),

              // Alerts list
              Expanded(
                child: provider.isEmpty
                    ? _buildEmptyState(context, provider.statusFilter)
                    : RefreshIndicator(
                        onRefresh: provider.refresh,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: provider.alerts.length,
                          itemBuilder: (context, index) {
                            final alert = provider.alerts[index];
                            return AlertCard(alert: alert);
                          },
                        ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context, AlertStatus? filter) {
    final message = filter == null
        ? 'No alerts yet'
        : filter == AlertStatus.open
            ? 'No open alerts'
            : 'No acknowledged alerts';

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              borderRadius: BorderRadius.circular(40),
            ),
            child: Icon(
              Icons.check_circle_outline,
              size: 40,
              color: Colors.green.shade400,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            message,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Colors.grey.shade600,
                ),
          ),
          if (filter == null) ...[
            const SizedBox(height: 8),
            Text(
              'All your health metrics look good!',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey.shade500,
                  ),
            ),
          ],
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;
  final int? count;

  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
    this.count,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isSelected
          ? Theme.of(context).primaryColor
          : Colors.grey.shade200,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? Colors.white : Colors.grey.shade700,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (count != null && count! > 0) ...[
                const SizedBox(width: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? Colors.white.withValues(alpha: 0.2)
                        : Colors.red.shade100,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    count.toString(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: isSelected ? Colors.white : Colors.red.shade700,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
