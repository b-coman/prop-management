# Availability Data Analysis & Cleanup Implementation

**Status**: ✅ IMPLEMENTED  
**Issue**: [#11 Data migration and cleanup for availability](https://github.com/b-coman/prop-management/issues/11)  
**Date**: June 3, 2025  

## Overview

Comprehensive data analysis and cleanup system for identifying and resolving availability discrepancies between `availability` and `priceCalendars` collections before migrating to single source of truth architecture.

## System Components

### Analysis Engine (`analyze-availability-data.ts`)

**Purpose**: Deep analysis of availability data consistency across both collections

**Features**:
- Cross-collection discrepancy detection
- Expired hold identification
- Orphaned hold analysis
- Revenue impact estimation
- Property health scoring
- Detailed reporting with recommendations

**Analysis Coverage**:
- 12 months historical data
- 6 months future data
- All properties or targeted subset
- Date-by-date comparison
- Hold validity verification

### Cleanup Engine (`cleanup-availability-data.ts`)

**Purpose**: Safe data cleanup with comprehensive backup and rollback capabilities

**Features**:
- Dry run mode (default)
- Expired hold cleanup
- Orphaned hold removal
- Discrepancy resolution
- Automatic backups
- Batch processing
- Rollback instructions

**Safety Mechanisms**:
- Always defaults to dry run
- Creates backups before changes
- Validates business rules
- Provides rollback procedures
- Detailed operation logging

### Management Interface (`manage-availability-data.sh`)

**Purpose**: User-friendly interface for running analysis and cleanup operations

**Features**:
- Interactive menu system
- Command-line modes
- Complete workflow automation
- Report viewing
- Prerequisite validation

### Backup System (`restore-availability-backup.ts`)

**Purpose**: Restore capability for cleanup operations

**Features**:
- Individual document restoration
- Bulk restoration
- Backup inspection
- Collection filtering
- Dry run testing

## Implementation Files

```
scripts/
├── analyze-availability-data.ts        # Core analysis engine
├── cleanup-availability-data.ts        # Data cleanup with safety
├── manage-availability-data.sh         # User interface
└── restore-availability-backup.ts     # Backup restoration

docs/implementation/
└── availability-data-analysis.md      # This documentation
```

## Data Analysis Process

### 1. Property Discovery

```typescript
// Analyzes all properties or targeted subset
const properties = await getPropertiesToAnalyze(db);

// Configurable analysis scope
const ANALYSIS_CONFIG = {
  MONTHS_TO_ANALYZE: 12,    // Historical months
  MONTHS_FORWARD: 6,        // Future months
  AVERAGE_NIGHTLY_RATE: 200, // For revenue estimation
  SPECIFIC_PROPERTIES: []    // Empty = all properties
};
```

### 2. Month-by-Month Analysis

For each property and month:
- Fetch `availability` collection document
- Fetch `priceCalendars` collection document
- Compare day-by-day availability states
- Identify discrepancies and categorize severity
- Check for orphaned holds (holds without bookings)

### 3. Expired Hold Detection

```typescript
// Query bookings collection for expired holds
const expiredHoldsQuery = db.collection('bookings')
  .where('status', '==', 'on-hold')
  .where('holdUntil', '<=', now);
```

### 4. Health Scoring

```typescript
function calculatePropertyHealthScore(
  discrepancies: AvailabilityDiscrepancy[],
  orphanedHolds: OrphanedHold[],
  monthsAnalyzed: number
): number {
  const totalIssues = discrepancies.length + orphanedHolds.length;
  const maxPossibleIssues = monthsAnalyzed * 31;
  return Math.max(0, 100 - (totalIssues / maxPossibleIssues) * 100);
}
```

## Data Cleanup Process

### 1. Analysis-Driven Cleanup

```typescript
// Run fresh analysis to get current state
const analysisReport = await analyzeAvailabilityData();

// Process each type of issue found
if (config.operations.cleanupExpiredHolds) {
  await cleanupExpiredHolds(db, analysisReport, config);
}
```

### 2. Expired Hold Cleanup

**Process**:
1. Query expired holds from bookings collection
2. Create backup of booking document
3. Update booking status to 'expired'
4. Release dates in `availability` collection
5. Log all operations

**Business Rules**:
- Holds expire after 24 hours (configurable)
- Dates become available immediately
- Audit trail maintained

### 3. Orphaned Hold Removal

**Process**:
1. Identify holds in `availability` without corresponding bookings
2. Verify booking doesn't exist
3. Remove hold reference from availability document
4. Log removal for audit

### 4. Discrepancy Resolution

**Process**:
1. Determine correct availability state using business rules
2. Check for confirmed bookings on date
3. Validate hold status
4. Update `availability` collection to correct state

**Business Rules**:
```typescript
// 1. Confirmed booking exists → unavailable
// 2. Valid hold exists → unavailable  
// 3. No booking/hold → available
// 4. Inconsistent data → manual review
```

## Safety Features

### Backup System

```typescript
// Automatic backup before any changes
const backupRef = await backupDocument(
  backupLocation, 
  'availability', 
  docId, 
  originalData
);
```

**Backup Structure**:
```
logs/availability-cleanup-backups/
└── 2025-06-03_14-30-15/
    ├── availability_property1_2025-06.json
    ├── bookings_booking123.json
    └── ...
```

### Rollback Procedures

```typescript
// Generated automatically for each cleanup
const rollbackInstructions = [
  'Restore backed up documents from: /path/to/backup',
  'Revert 5 expired hold status changes',
  'Restore 3 orphaned holds using backup documents'
];
```

### Validation & Verification

- **Pre-cleanup analysis**: Understand current state
- **Dry run mode**: Test all operations without changes
- **Post-cleanup verification**: Confirm improvements
- **Data consistency scoring**: Measure system health

## Usage Instructions

### Interactive Mode

```bash
# Start interactive management interface
./scripts/manage-availability-data.sh

# Menu options:
# 1) Run Analysis Only
# 2) Run Cleanup (Dry Run)  
# 3) Run Cleanup (LIVE)
# 4) Complete Workflow
# 5) Show Recent Reports
```

### Command Line Mode

```bash
# Individual operations
./scripts/manage-availability-data.sh analysis
./scripts/manage-availability-data.sh dryrun
./scripts/manage-availability-data.sh live

# Complete workflow
./scripts/manage-availability-data.sh workflow
```

### Direct Script Usage

```bash
# Analysis only
npx tsx scripts/analyze-availability-data.ts

# Cleanup (dry run)
npx tsx scripts/cleanup-availability-data.ts

# Cleanup (live)
npx tsx scripts/cleanup-availability-data.ts -- --live
```

## Report Structure

### Analysis Report

```typescript
interface AnalysisReport {
  timestamp: string;
  properties: PropertyAnalysis[];
  summary: {
    totalProperties: number;
    propertiesWithDiscrepancies: number;
    totalDiscrepancies: number;
    expiredHolds: number;
    orphanedHolds: number;
    affectedDateRanges: number;
    estimatedRevenueLoss: number;
  };
  recommendations: string[];
}
```

### Cleanup Report

```typescript
interface CleanupReport {
  timestamp: string;
  config: CleanupConfig;
  operations: CleanupOperation[];
  summary: {
    totalOperations: number;
    successful: number;
    failed: number;
    skipped: number;
    documentsBackedUp: number;
    dataConsistencyScore: number;
  };
  backupLocation?: string;
  rollbackInstructions: string[];
}
```

## Report Locations

```
logs/
├── availability-analysis-YYYY-MM-DD_HH-mm-ss.json     # Detailed JSON report
├── availability-analysis-summary-YYYY-MM-DD_HH-mm-ss.txt  # Human-readable summary
├── availability-cleanup-dryrun-YYYY-MM-DD_HH-mm-ss.json   # Dry run results
├── availability-cleanup-YYYY-MM-DD_HH-mm-ss.json          # Live cleanup results
└── availability-cleanup-backups/
    └── YYYY-MM-DD_HH-mm-ss/
        ├── availability_*.json
        └── bookings_*.json
```

## Business Rules

### Discrepancy Resolution Priority

1. **High Severity**: Near-future dates (next 30 days) with conflicting availability
2. **Medium Severity**: Dates with holds or distant future conflicts
3. **Low Severity**: Past dates or minor inconsistencies

### Data Sources of Truth

1. **Bookings Collection**: Authoritative for booking status
2. **Availability Collection**: Real-time availability updates
3. **PriceCalendars Collection**: Batch-updated pricing data

### Cleanup Decision Matrix

| Availability | PriceCalendars | Booking Exists | Action |
|-------------|---------------|----------------|---------|
| false | true | Yes | Keep unavailable |
| false | true | No | Make available |
| true | false | Yes | Make unavailable |
| true | false | No | Keep available |

## Performance Considerations

### Batch Processing

```typescript
// Process in configurable batches
const BATCH_SIZE = 10;
for (let i = 0; i < docs.length; i += BATCH_SIZE) {
  const batch = docs.slice(i, i + BATCH_SIZE);
  await processBatch(batch);
}
```

### Memory Management

- Stream large datasets
- Process one property at a time
- Release references after processing
- Limit concurrent operations

### Error Handling

- Continue processing on individual failures
- Log all errors with context
- Provide partial success reporting
- Enable retry mechanisms

## Integration with Migration

### Pre-Migration Validation

```bash
# Run complete analysis
./scripts/manage-availability-data.sh analysis

# Check data consistency score
# Target: 95%+ consistency before migration
```

### Migration Prerequisites

1. **Data Consistency**: > 95% health score across all properties
2. **No Expired Holds**: All holds properly cleaned up
3. **No Orphaned Data**: All holds have valid bookings
4. **Backup Verified**: Restoration procedures tested

### Post-Migration Verification

```bash
# Verify single source consistency
./scripts/manage-availability-data.sh analysis

# Should show 100% consistency after migration
```

## Monitoring & Alerting

### Key Metrics

- **Data consistency score**: Overall system health
- **Expired hold count**: Operational efficiency
- **Discrepancy rate**: Data quality trend
- **Revenue impact**: Business cost of inconsistencies

### Recommended Alerts

- Consistency score drops below 90%
- More than 10 expired holds detected
- Revenue loss exceeds $1000
- Cleanup operations fail

## Troubleshooting

### Common Issues

1. **Permission Errors**: Check Firebase Admin SDK credentials
2. **Timeout Errors**: Reduce batch size or increase timeout
3. **Memory Issues**: Process fewer properties concurrently
4. **Data Corruption**: Use backup restoration

### Debug Commands

```bash
# Detailed logging
DEBUG=1 npx tsx scripts/analyze-availability-data.ts

# Single property analysis
SPECIFIC_PROPERTIES=property-id npx tsx scripts/analyze-availability-data.ts

# Backup inspection
npx tsx scripts/restore-availability-backup.ts inspect <backup-path>
```

## Related Documentation

- [Availability Deduplication Plan](availability-deduplication-plan.md)
- [Availability Feature Flags](availability-feature-flags.md)
- [Availability Testing Strategy](availability-testing-strategy.md)

---

**Success Criteria**: Clean, consistent data with 95%+ health scores across all properties, enabling safe migration to single source of truth architecture.