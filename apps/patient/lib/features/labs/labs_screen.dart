import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/models/lab_report.dart';
import '../../core/widgets/app_bottom_nav.dart';
import 'labs_provider.dart';

class LabsScreen extends StatelessWidget {
  const LabsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (context) =>
          LabsProvider(context.read<ApiClient>())..fetchLabReports(),
      child: const _LabsScreenContent(),
    );
  }
}

class _LabsScreenContent extends StatelessWidget {
  const _LabsScreenContent();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Lab Results'),
      ),
      body: Consumer<LabsProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && provider.reports.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.error != null && provider.reports.isEmpty) {
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
                    onPressed: () => provider.fetchLabReports(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          if (provider.reports.isEmpty) {
            return _buildEmptyState(context);
          }

          return RefreshIndicator(
            onRefresh: () => provider.fetchLabReports(),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: provider.reports.length,
              itemBuilder: (context, index) {
                final report = provider.reports[index];
                return _LabReportCard(
                  report: report,
                  onTap: () => context.push('/labs/${report.id}'),
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/add-lab'),
        icon: const Icon(Icons.add),
        label: const Text('Add Labs'),
      ),
      bottomNavigationBar: const AppBottomNav(currentIndex: NavIndex.labs),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: Colors.indigo.shade50,
                borderRadius: BorderRadius.circular(40),
              ),
              child: Icon(
                Icons.science_outlined,
                size: 40,
                color: Colors.indigo.shade400,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'No lab results yet',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.grey.shade600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Add your lab results to track\nyour kidney health over time',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.grey.shade500,
                  ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _LabReportCard extends StatelessWidget {
  final LabReport report;
  final VoidCallback onTap;

  const _LabReportCard({
    required this.report,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final abnormalCount = report.abnormalResultsCount;
    final criticalCount = report.criticalResultsCount;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.indigo.shade50,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.science,
                      color: Colors.indigo.shade400,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          report.displayTitle,
                          style: Theme.of(context).textTheme.titleMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          DateFormat.yMMMd().format(report.collectedAt),
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: Colors.grey.shade600,
                                  ),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: Colors.grey.shade400),
                ],
              ),
              const SizedBox(height: 12),
              // Results summary
              Row(
                children: [
                  _SummaryChip(
                    label: '${report.results.length} results',
                    color: Colors.grey,
                  ),
                  if (abnormalCount > 0) ...[
                    const SizedBox(width: 8),
                    _SummaryChip(
                      label: '$abnormalCount abnormal',
                      color: criticalCount > 0 ? Colors.red : Colors.orange,
                    ),
                  ],
                  const Spacer(),
                  if (report.isVerified)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.green.shade50,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.verified,
                            size: 14,
                            color: Colors.green.shade600,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Verified',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.green.shade600,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              // Preview of key results
              if (report.results.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Divider(height: 1),
                const SizedBox(height: 12),
                _ResultsPreview(results: report.results),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  final String label;
  final MaterialColor color;

  const _SummaryChip({
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.shade50,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          color: color.shade700,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

class _ResultsPreview extends StatelessWidget {
  final List<LabResult> results;

  const _ResultsPreview({required this.results});

  @override
  Widget build(BuildContext context) {
    // Show up to 3 key results, prioritizing abnormal ones
    final sortedResults = [...results];
    sortedResults.sort((a, b) {
      // Critical first, then abnormal, then normal
      if (a.isCritical && !b.isCritical) return -1;
      if (!a.isCritical && b.isCritical) return 1;
      if (a.isAbnormal && !b.isAbnormal) return -1;
      if (!a.isAbnormal && b.isAbnormal) return 1;
      return 0;
    });

    final previewResults = sortedResults.take(3).toList();

    return Wrap(
      spacing: 16,
      runSpacing: 8,
      children: previewResults.map((result) {
        return _ResultPreviewItem(result: result);
      }).toList(),
    );
  }
}

class _ResultPreviewItem extends StatelessWidget {
  final LabResult result;

  const _ResultPreviewItem({required this.result});

  @override
  Widget build(BuildContext context) {
    Color textColor = Colors.grey.shade700;
    if (result.isCritical) {
      textColor = Colors.red.shade700;
    } else if (result.isAbnormal) {
      textColor = Colors.orange.shade700;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '${result.analyteName}: ',
          style: TextStyle(
            fontSize: 13,
            color: Colors.grey.shade600,
          ),
        ),
        Text(
          result.displayValue,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: textColor,
          ),
        ),
        if (result.flag != null) ...[
          const SizedBox(width: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            decoration: BoxDecoration(
              color: result.isCritical
                  ? Colors.red.shade100
                  : Colors.orange.shade100,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              result.flag!.shortName,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color:
                    result.isCritical ? Colors.red.shade700 : Colors.orange.shade700,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
