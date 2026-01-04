import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/auth/auth_provider.dart';
import 'core/theme/app_theme.dart';
import 'routes/router.dart';

/// Main app widget
class NephrawnApp extends StatefulWidget {
  const NephrawnApp({super.key});

  @override
  State<NephrawnApp> createState() => _NephrawnAppState();
}

class _NephrawnAppState extends State<NephrawnApp> {
  @override
  void initState() {
    super.initState();
    // Initialize auth on app start
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AuthProvider>().initialize();
    });
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();

    // Show loading while initializing
    if (!authProvider.isInitialized) {
      return MaterialApp(
        title: 'Nephrawn',
        theme: AppTheme.lightTheme,
        home: const Scaffold(
          body: Center(
            child: CircularProgressIndicator(),
          ),
        ),
      );
    }

    return MaterialApp.router(
      title: 'Nephrawn',
      theme: AppTheme.lightTheme,
      routerConfig: createRouter(authProvider),
      debugShowCheckedModeBanner: false,
    );
  }
}
