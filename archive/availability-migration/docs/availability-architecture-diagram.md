# Availability System Architecture

## Current State (DUAL_CHECK Mode)

```mermaid
graph TB
    subgraph "Client Layer"
        UI[Booking UI]
        Admin[Admin UI]
    end
    
    subgraph "API Layer"
        CheckPricing["/api/check-pricing"]
        AdminAPI["Admin Actions"]
        Monitoring["/api/monitoring/availability"]
    end
    
    subgraph "Service Layer"
        AvailService["Availability Service<br/>(Feature Flags)"]
        PricingService["Pricing Service"]
    end
    
    subgraph "Data Layer"
        Availability["availability<br/>Collection<br/>(Real-time)"]
        PriceCalendars["priceCalendars<br/>Collection<br/>(Batch)"]
    end
    
    subgraph "Automation"
        Scheduler["Cloud Scheduler<br/>(Every Hour)"]
        CronAPI["/api/cron/release-holds"]
    end
    
    %% Client to API connections
    UI --> CheckPricing
    Admin --> AdminAPI
    Admin --> Monitoring
    
    %% API to Service connections
    CheckPricing --> AvailService
    AdminAPI --> AvailService
    Monitoring --> AvailService
    
    %% Service to Data connections
    AvailService -->|"DUAL_CHECK"| Availability
    AvailService -->|"DUAL_CHECK"| PriceCalendars
    AvailService -->|"Compare & Report"| Monitoring
    PricingService --> PriceCalendars
    
    %% Admin updates both collections
    AdminAPI -->|"Update"| Availability
    AdminAPI -->|"Update"| PriceCalendars
    
    %% Automation flow
    Scheduler --> CronAPI
    CronAPI --> Availability
    
    style AvailService fill:#f9f,stroke:#333,stroke-width:4px
    style Monitoring fill:#9f9,stroke:#333,stroke-width:2px
```

## Feature Flag Modes

### 1. LEGACY Mode (Original)
- Uses only `priceCalendars` collection
- No awareness of `availability` collection
- Current production behavior before changes

### 2. DUAL_CHECK Mode (Current)
- Reads from both collections
- Compares results
- Reports discrepancies
- Uses `priceCalendars` for final decision (safe)

### 3. SINGLE_SOURCE Mode (Target)
- Uses only `availability` collection
- `priceCalendars` becomes pricing-only
- Cleaner architecture
- Better performance

## Data Flow

### Booking Flow:
1. User selects dates in UI
2. UI calls `/api/check-pricing`
3. API uses Availability Service
4. Service checks both collections (DUAL_CHECK)
5. Returns availability + pricing
6. Logs any discrepancies

### Admin Flow:
1. Admin toggles date availability
2. Updates both collections
3. Maintains consistency
4. Changes visible immediately

### Hold Cleanup Flow:
1. Cloud Scheduler triggers hourly
2. Finds expired holds
3. Updates booking status
4. Releases availability
5. Logs all actions

## Key Benefits

1. **Zero Downtime Migration**
   - Feature flags enable gradual rollout
   - Instant rollback capability
   - No code deployment needed for mode changes

2. **Data Integrity**
   - DUAL_CHECK catches inconsistencies
   - Monitoring provides visibility
   - Admin updates maintain sync

3. **Operational Safety**
   - Comprehensive logging
   - Real-time monitoring
   - Automated hold cleanup

## Migration Path

```
LEGACY → DUAL_CHECK → Data Cleanup → SINGLE_SOURCE
         (Week 1)      (Week 2)       (Week 3)
         ✅ DONE       IN PROGRESS    PLANNED
```