import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';
import '../../core/models/device_connection.dart';
import 'devices_provider.dart';

/// Connected Devices screen for managing device integrations
class DevicesScreen extends StatelessWidget {
  const DevicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) =>
          DevicesProvider(context.read<ApiClient>())..fetchDevices(),
      child: const _DevicesScreenContent(),
    );
  }
}

class _DevicesScreenContent extends StatefulWidget {
  const _DevicesScreenContent();

  @override
  State<_DevicesScreenContent> createState() => _DevicesScreenContentState();
}

class _DevicesScreenContentState extends State<_DevicesScreenContent>
    with WidgetsBindingObserver {

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Refresh devices when app resumes (user returns from browser)
    if (state == AppLifecycleState.resumed) {
      context.read<DevicesProvider>().fetchDevices();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Connected Devices'),
      ),
      body: Consumer<DevicesProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && provider.deviceTypes.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.error != null && provider.deviceTypes.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline, size: 48, color: Colors.red.shade400),
                  const SizedBox(height: 16),
                  Text(provider.error!),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.fetchDevices(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => provider.fetchDevices(),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Error banner if any
                  if (provider.error != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.red.shade200),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline, color: Colors.red.shade700),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              provider.error!,
                              style: TextStyle(color: Colors.red.shade700),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, size: 18),
                            onPressed: () => provider.clearError(),
                            color: Colors.red.shade700,
                          ),
                        ],
                      ),
                    ),

                  // Info card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Icon(
                            Icons.info_outline,
                            color: Theme.of(context).primaryColor,
                          ),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Text(
                              'Connect your health devices to automatically sync measurements.',
                              style: TextStyle(fontSize: 14),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Blood Pressure Monitor Card
                  _DeviceCard(
                    deviceType: provider.bloodPressureMonitor,
                    fallbackName: 'Blood Pressure Monitor',
                    fallbackIcon: Icons.favorite_outline,
                    color: Colors.red,
                    description: 'Track your blood pressure readings',
                    supportedDevices: 'Withings BPM Pro2',
                    provider: provider,
                  ),
                  const SizedBox(height: 16),

                  // Smart Scale Card
                  _DeviceCard(
                    deviceType: provider.smartScale,
                    fallbackName: 'Smart Scale',
                    fallbackIcon: Icons.monitor_weight_outlined,
                    color: Colors.blue,
                    description: 'Track weight & body composition',
                    supportedDevices: 'Withings Body Pro 2',
                    provider: provider,
                  ),

                  const SizedBox(height: 32),

                  // Future devices hint
                  Center(
                    child: Text(
                      'More devices coming soon',
                      style: TextStyle(
                        color: Colors.grey.shade500,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Card for a device type with connect/sync/disconnect controls
class _DeviceCard extends StatelessWidget {
  final DeviceTypeInfo? deviceType;
  final String fallbackName;
  final IconData fallbackIcon;
  final Color color;
  final String description;
  final String supportedDevices;
  final DevicesProvider provider;

  const _DeviceCard({
    required this.deviceType,
    required this.fallbackName,
    required this.fallbackIcon,
    required this.color,
    required this.description,
    required this.supportedDevices,
    required this.provider,
  });

  Future<void> _connect(BuildContext context) async {
    final authUrl = await provider.getWithingsAuthUrl();
    if (authUrl != null && context.mounted) {
      final uri = Uri.parse(authUrl);
      // Use external browser so app goes to background and lifecycle observer triggers on return
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open authorization page')),
        );
      }
      // Devices will refresh automatically via didChangeAppLifecycleState when user returns
    }
  }

  Future<void> _sync(BuildContext context) async {
    final result = await provider.syncWithings();
    if (result != null && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.success
                ? 'Synced ${result.measurementsCreated} new measurements'
                : 'Sync completed with errors',
          ),
        ),
      );
    }
  }

  Future<void> _disconnect(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Disconnect Withings?'),
        content: const Text(
          'This will disconnect your Withings account and stop syncing all Withings devices (Blood Pressure Monitor and Smart Scale). You can reconnect at any time.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Disconnect All'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final success = await provider.disconnectWithings();
      if (success && context.mounted) {
        // Refresh to update UI immediately
        await provider.fetchDevices();
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Withings devices disconnected')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isConnected = deviceType?.connected ?? false;
    final name = deviceType?.name ?? fallbackName;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with colored background
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isConnected
                  ? Colors.green.shade50
                  : color.withValues(alpha: 0.08),
            ),
            child: Row(
              children: [
                // Device icon
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Icon(
                    fallbackIcon,
                    color: color,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 16),

                // Device info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 17,
                        ),
                      ),
                      const SizedBox(height: 2),
                      if (isConnected) ...[
                        Row(
                          children: [
                            Icon(
                              Icons.check_circle,
                              size: 14,
                              color: Colors.green.shade600,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              deviceType!.sourceDisplayName,
                              style: TextStyle(
                                color: Colors.green.shade700,
                                fontWeight: FontWeight.w500,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ] else ...[
                        Text(
                          'Not connected',
                          style: TextStyle(
                            color: Colors.grey.shade600,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                // Status icon
                if (isConnected)
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.green.shade100,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.check,
                      color: Colors.green.shade700,
                      size: 20,
                    ),
                  ),
              ],
            ),
          ),

          // Body
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (isConnected) ...[
                  // Connected state - show last sync and actions
                  Row(
                    children: [
                      Icon(Icons.sync, size: 16, color: Colors.grey.shade600),
                      const SizedBox(width: 6),
                      Text(
                        'Last synced: ${deviceType!.lastSyncDisplay}',
                        style: TextStyle(
                          color: Colors.grey.shade600,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Action buttons
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: provider.isSyncing
                              ? null
                              : () => _sync(context),
                          icon: provider.isSyncing
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.sync, size: 18),
                          label: Text(
                            provider.isSyncing ? 'Syncing...' : 'Sync Now',
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton(
                        onPressed: () => _disconnect(context),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red,
                        ),
                        child: const Text('Disconnect'),
                      ),
                    ],
                  ),
                ] else ...[
                  // Not connected - show description and connect button
                  Text(
                    description,
                    style: TextStyle(
                      color: Colors.grey.shade700,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(
                        Icons.devices,
                        size: 14,
                        color: Colors.grey.shade500,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        supportedDevices,
                        style: TextStyle(
                          color: Colors.grey.shade500,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: provider.isLoading
                          ? null
                          : () => _connect(context),
                      icon: provider.isLoading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.add),
                      label: const Text('Connect Device'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: color,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
