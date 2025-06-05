# Availability Deduplication Deployment Checklist

This checklist ensures a safe and successful deployment of the availability deduplication system.

## Pre-Deployment Phase

### Code Review
- [ ] All changes reviewed and approved
- [ ] No hardcoded values or test data
- [ ] Proper error handling in all new code
- [ ] Logging added for debugging

### Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing completed in development
- [ ] Edge cases tested (cross-month bookings, etc.)

### Documentation
- [ ] Technical documentation updated
- [ ] API documentation updated
- [ ] Admin guide updated
- [ ] Rollback procedures documented

## Deployment Phase

### 1. Enable DUAL_CHECK Mode (Week 1)
```bash
# Add to .env.local and production environment
AVAILABILITY_SINGLE_SOURCE=false
AVAILABILITY_DUAL_CHECK=true
AVAILABILITY_LEGACY_FALLBACK=true
```

### 2. Deploy Monitoring
- [ ] Deploy monitoring endpoint (`/api/monitoring/availability`)
- [ ] Deploy admin monitoring dashboard
- [ ] Verify monitoring is working
- [ ] Set up alerts for critical issues

### 3. Deploy Hold Cleanup Automation
```bash
# Run the setup script
./scripts/setup-hold-cleanup-scheduler.sh
```
- [ ] Cloud Scheduler job created
- [ ] Test manual trigger
- [ ] Verify logs

### 4. Monitor for Discrepancies
- [ ] Check monitoring dashboard daily
- [ ] Document any discrepancies found
- [ ] Investigate root causes
- [ ] Fix data inconsistencies

### 5. Clean Up Data (Week 2)
- [ ] Run data analysis script
- [ ] Backup current data
- [ ] Execute cleanup script
- [ ] Verify data integrity

### 6. Switch to SINGLE_SOURCE Mode (Week 3)
```bash
# Update environment variables
AVAILABILITY_SINGLE_SOURCE=true
AVAILABILITY_DUAL_CHECK=false
AVAILABILITY_LEGACY_FALLBACK=true  # Keep for safety
```

## Post-Deployment Phase

### Verification
- [ ] All API endpoints working correctly
- [ ] Admin UI functioning properly
- [ ] No performance degradation
- [ ] No increase in errors

### Monitoring (First 48 hours)
- [ ] Check system health every 4 hours
- [ ] Monitor error logs
- [ ] Track performance metrics
- [ ] Verify hold cleanup is working

### Documentation
- [ ] Update deployment notes
- [ ] Document any issues encountered
- [ ] Update runbooks
- [ ] Close GitHub issues

## Rollback Procedure

If issues are detected, rollback is instant:

```bash
# Revert to legacy mode
AVAILABILITY_SINGLE_SOURCE=false
AVAILABILITY_DUAL_CHECK=false
AVAILABILITY_LEGACY_FALLBACK=true
```

No code deployment needed - just update environment variables and restart the service.

## Success Criteria

- Zero data loss
- No increase in error rates
- Performance maintained or improved
- All features working correctly
- Successful automatic hold cleanup
- No manual intervention required

## Emergency Contacts

- On-call engineer: [Contact]
- Product owner: [Contact]
- DevOps lead: [Contact]

## Sign-offs

- [ ] Engineering lead
- [ ] Product owner
- [ ] QA lead
- [ ] DevOps approval