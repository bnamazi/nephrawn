import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Configures global error handling for the app.
/// Catches both synchronous Flutter errors and async Zone errors.
void setupErrorHandling() {
  // Handle Flutter framework errors
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    _logError(details.exception, details.stack);
  };

  // Handle errors that escape the Flutter framework
  PlatformDispatcher.instance.onError = (error, stack) {
    _logError(error, stack);
    return true;
  };
}

void _logError(Object error, StackTrace? stack) {
  // In development, print to console
  if (kDebugMode) {
    debugPrint('ERROR: $error');
    if (stack != null) {
      debugPrint('STACK: $stack');
    }
  }
  // TODO: In production, send to error tracking service (e.g., Sentry)
}

/// A widget that catches errors in its subtree and displays a fallback UI.
class ErrorBoundary extends StatefulWidget {
  final Widget child;
  final Widget Function(FlutterErrorDetails)? errorBuilder;

  const ErrorBoundary({
    super.key,
    required this.child,
    this.errorBuilder,
  });

  @override
  State<ErrorBoundary> createState() => _ErrorBoundaryState();
}

class _ErrorBoundaryState extends State<ErrorBoundary> {
  FlutterErrorDetails? _error;

  void _resetError() {
    setState(() {
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      if (widget.errorBuilder != null) {
        return widget.errorBuilder!(_error!);
      }
      return ErrorScreen(
        error: _error!,
        onRetry: _resetError,
      );
    }

    return widget.child;
  }
}

/// A fallback screen shown when an unhandled error occurs.
class ErrorScreen extends StatelessWidget {
  final FlutterErrorDetails error;
  final VoidCallback? onRetry;

  const ErrorScreen({
    super.key,
    required this.error,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(32),
                  ),
                  child: Icon(
                    Icons.error_outline,
                    size: 32,
                    color: Colors.red.shade600,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  'Something went wrong',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  'An unexpected error occurred. Please try again.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.grey.shade600,
                      ),
                  textAlign: TextAlign.center,
                ),
                if (kDebugMode) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      error.exceptionAsString(),
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: Colors.red.shade700,
                      ),
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                if (onRetry != null)
                  FilledButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Try again'),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A simple error screen for display when the app fails to initialize.
class AppErrorScreen extends StatelessWidget {
  final Object error;

  const AppErrorScreen({
    super.key,
    required this.error,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.error_outline,
                    size: 64,
                    color: Colors.red.shade400,
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Failed to start app',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Please restart the application.',
                    style: TextStyle(
                      color: Colors.grey.shade600,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  if (kDebugMode) ...[
                    const SizedBox(height: 16),
                    Text(
                      error.toString(),
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: Colors.red.shade700,
                      ),
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
