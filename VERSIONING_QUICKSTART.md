# Provider API Versioning - Quick Start Guide

## 5-Minute Setup

### 1. Enable Versioning in Environment

```bash
# .env or environment variables
PROVIDER_VERSIONING_ENABLED=true
PROVIDER_VERSIONING_METRICS_ENABLED=true

# For MTN (example)
MTN_ENABLED_VERSIONS=v1,v2
MTN_PRIMARY_VERSION=v1
MTN_SECONDARY_VERSION=v2
MTN_ROUTING_STRATEGY=canary
MTN_CANARY_TRAFFIC_PERCENTAGE=5
MTN_CANARY_MAX_ERROR_RATE=0.05
```

### 2. Import and Initialize

```typescript
import {
  CompatibilityAdapter,
  VersionAdapterFactory,
  VersionedProviderLoader,
  ProviderApiVersion,
  VersionRoutingStrategy,
  registerAllCompatibilityBridges,
} from './services/mobilemoney/versioning';

// Create instances
const adapter = new CompatibilityAdapter();
const factory = new VersionAdapterFactory(adapter);
const loader = new VersionedProviderLoader(adapter, factory);

// Register provider-specific transformations
registerAllCompatibilityBridges(adapter);
```

### 3. Register Providers

```typescript
// Register V1 and V2 instances
loader.registerProviderVersion('mtn', ProviderApiVersion.V1, mtnV1Client);
loader.registerProviderVersion('mtn', ProviderApiVersion.V2, mtnV2Client);

// Configure routing (start with FIXED on V1)
loader.registerRoutingConfig('mtn', {
  provider: 'mtn',
  strategy: VersionRoutingStrategy.FIXED,
  primaryVersion: ProviderApiVersion.V1,
  secondaryVersion: ProviderApiVersion.V2,
});
```

### 4. Execute Transactions

```typescript
const result = await loader.executeWithFallback(
  'mtn',
  {
    provider: 'mtn',
    phoneNumber: '237123456789',
    amount: 5000,
    userId: 'user123',
    sessionId: 'session123'
  },
  async (instance, version) => {
    return instance.sendPayout(phoneNumber, amount);
  }
);

console.log({
  success: result.success,
  apiVersion: result.apiVersion,
  fallbackUsed: result.fallbackUsed,
  executionTimeMs: result.executionTimeMs,
});
```

## Migration Timeline

### Week 1: Planning & Testing
```typescript
// Keep FIXED strategy on V1
strategy: VersionRoutingStrategy.FIXED,
primaryVersion: ProviderApiVersion.V1,
```

### Week 2: Internal Testing
```typescript
// Switch to FIXED on V2 for internal traffic only
strategy: VersionRoutingStrategy.FIXED,
primaryVersion: ProviderApiVersion.V2,

// Then revert for production:
primaryVersion: ProviderApiVersion.V1,
```

### Week 3: Canary (5%)
```typescript
// Start canary rollout
strategy: VersionRoutingStrategy.CANARY,
primaryVersion: ProviderApiVersion.V1,
secondaryVersion: ProviderApiVersion.V2,
canaryConfig: {
  trafficPercentage: 5,
  sessionAffinity: true,
  maxErrorRate: 0.05,
},
```

### Weeks 4-5: Expand Canary
```typescript
// Monitor metrics, then increase
loader.getRouter('mtn')?.updateCanaryTraffic(25); // 25%
loader.getRouter('mtn')?.updateCanaryTraffic(50); // 50%
loader.getRouter('mtn')?.updateCanaryTraffic(100); // 100%
```

### Week 6: Complete
```typescript
// Switch to FIXED on V2
strategy: VersionRoutingStrategy.FIXED,
primaryVersion: ProviderApiVersion.V2,
```

## Monitoring

```typescript
import { MigrationProgressTracker } from './versioning/migration-strategy';

// Create tracker
const tracker = new MigrationProgressTracker(
  'mtn',
  ProviderApiVersion.V1,
  ProviderApiVersion.V2
);

// Start automatic metrics collection
tracker.startMetricsCollection(60000); // Every 60 seconds

// Record transactions
tracker.recordTransaction(result.success, result.executionTimeMs, userId);

// Check status
const status = tracker.getStatus();
console.log(`Error rate: ${(status.metrics.errorRate * 100).toFixed(2)}%`);
console.log(`Avg latency: ${status.metrics.avgLatencyMs.toFixed(0)}ms`);

// Check if rollback needed
if (tracker.shouldRollback(0.05)) {
  console.log('ERROR THRESHOLD EXCEEDED - ROLLING BACK');
  tracker.recordRollback();
  // Switch back to V1
}

// Stop collection when done
tracker.stopMetricsCollection();
```

## Routing Strategies Quick Reference

| Strategy | Use Case | Risk | Duration |
|----------|----------|------|----------|
| **FIXED** | Hardcoded version | Low (one version) | N/A |
| **CANARY** | Production migration | Very Low (gradual) | Weeks |
| **FAILOVER** | API maintenance | Low (has backup) | Hours |
| **SHADOW** | Pre-validation | None (read-only) | Days |
| **CONDITIONAL** | Test by type | Medium (rule-based) | Variable |

## Common Issues & Fixes

### Error Rate Spike
1. Check V2 API status
2. Verify compatibility mapping is correct
3. Reduce canary percentage
4. Check network connectivity

### Latency Degradation
1. Compare V1 vs V2 timeout settings
2. Check V2 API performance
3. Reduce load if needed
4. Check for database issues

### Session Affinity Not Working
1. Verify `sessionAffinity: true` in config
2. Check session ID is in context
3. Verify session ID consistency

### Rollback Triggered
1. Review error logs for failures
2. Check compatibility mappings
3. Increase error threshold temporarily
4. Contact provider for API issues

## Advanced: Custom Routing

```typescript
// Route based on user tier
{
  strategy: VersionRoutingStrategy.CONDITIONAL,
  conditionalRules: [
    {
      condition: ctx => ctx.userId?.startsWith('premium_'),
      version: ProviderApiVersion.V2,
      priority: 100,
    },
    {
      condition: ctx => true, // Default
      version: ProviderApiVersion.V1,
      priority: 0,
    },
  ],
}
```

## Testing

```bash
# Run versioning tests
npm test -- versioning.test.ts

# Specific strategy
npm test -- versioning.test.ts -t "CANARY"

# With coverage
npm test -- versioning.test.ts --coverage
```

## Documentation

- **Full Guide**: `docs/PROVIDER_API_VERSIONING.md`
- **Implementation Details**: `VERSIONING_IMPLEMENTATION.md`
- **API Reference**: `src/services/mobilemoney/versioning/index.ts`
- **Tests**: `src/services/mobilemoney/versioning/__tests__/versioning.test.ts`

## Need Help?

1. Check `docs/PROVIDER_API_VERSIONING.md` for detailed guides
2. Review test examples in `versioning.test.ts`
3. See provider-specific mappings in `bridges.ts`
4. Check migration strategies in `migration-strategy.ts`
