import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_provider.dart';
import 'profile_provider.dart';

/// Profile screen showing user information
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) =>
          ProfileProvider(context.read<ApiClient>())..fetchProfile(),
      child: const _ProfileScreenContent(),
    );
  }
}

class _ProfileScreenContent extends StatelessWidget {
  const _ProfileScreenContent();

  @override
  Widget build(BuildContext context) {
    final authProvider = context.read<AuthProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
      ),
      body: Consumer<ProfileProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.error != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.error_outline, size: 48, color: Colors.red.shade400),
                  const SizedBox(height: 16),
                  Text(provider.error!),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.fetchProfile(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          final profile = provider.profile;
          if (profile == null) {
            return const Center(child: Text('No profile data'));
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                // Profile header
                Container(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 48,
                        backgroundColor: Theme.of(context).primaryColor.withValues(alpha: 0.1),
                        child: Icon(
                          Icons.person,
                          size: 48,
                          color: Theme.of(context).primaryColor,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        profile.name,
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        profile.email,
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: Colors.grey.shade600,
                            ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Profile details
                Card(
                  child: Column(
                    children: [
                      if (profile.dateOfBirth != null)
                        _ProfileDetailTile(
                          icon: Icons.cake_outlined,
                          label: 'Date of Birth',
                          value: DateFormat('MMMM d, yyyy').format(profile.dateOfBirth!),
                        ),
                      if (profile.createdAt != null) ...[
                        const Divider(height: 1),
                        _ProfileDetailTile(
                          icon: Icons.calendar_today_outlined,
                          label: 'Member Since',
                          value: DateFormat('MMMM d, yyyy').format(profile.createdAt!),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // My Clinics link
                Card(
                  child: ListTile(
                    leading: Icon(Icons.local_hospital_outlined, color: Theme.of(context).primaryColor),
                    title: const Text('My Clinics'),
                    subtitle: const Text('View and manage your enrolled clinics'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/clinics'),
                  ),
                ),
                const SizedBox(height: 32),

                // Logout button
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      await authProvider.logout();
                      if (context.mounted) {
                        context.go('/login');
                      }
                    },
                    icon: const Icon(Icons.logout),
                    label: const Text('Log Out'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Colors.red),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ProfileDetailTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _ProfileDetailTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: Colors.grey.shade600),
      title: Text(
        label,
        style: TextStyle(
          color: Colors.grey.shade600,
          fontSize: 12,
        ),
      ),
      subtitle: Text(
        value,
        style: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}
