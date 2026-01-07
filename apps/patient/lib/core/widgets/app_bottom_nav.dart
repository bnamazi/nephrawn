import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../routes/router.dart';

/// Bottom navigation indices
enum NavIndex {
  dashboard(0),
  weight(1),
  bp(2),
  symptoms(3),
  medications(4);

  final int value;
  const NavIndex(this.value);
}

/// Shared bottom navigation bar for main app screens
class AppBottomNav extends StatelessWidget {
  final NavIndex currentIndex;

  const AppBottomNav({
    super.key,
    required this.currentIndex,
  });

  @override
  Widget build(BuildContext context) {
    return NavigationBar(
      selectedIndex: currentIndex.value,
      onDestinationSelected: (index) {
        if (index == currentIndex.value) return;

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
            context.go(Routes.checkins);
            break;
          case 4:
            context.go(Routes.medications);
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
        NavigationDestination(
          icon: Icon(Icons.medication_outlined),
          selectedIcon: Icon(Icons.medication),
          label: 'Meds',
        ),
      ],
    );
  }
}
