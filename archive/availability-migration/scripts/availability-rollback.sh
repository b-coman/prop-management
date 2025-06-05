#!/bin/bash

# Availability System Rollback Script
# This script provides quick rollback capabilities for the availability deduplication system

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔄 Availability System Rollback Script"
echo "======================================"

# Function to show current status
show_status() {
    echo ""
    echo "📊 Current Feature Flag Status:"
    echo "   AVAILABILITY_SINGLE_SOURCE: ${AVAILABILITY_SINGLE_SOURCE:-false}"
    echo "   AVAILABILITY_DUAL_CHECK: ${AVAILABILITY_DUAL_CHECK:-false}"
    echo "   AVAILABILITY_LEGACY_FALLBACK: ${AVAILABILITY_LEGACY_FALLBACK:-true}"
    echo ""
}

# Function to set environment variables for different modes
set_legacy_mode() {
    echo "🔙 Setting LEGACY mode (priceCalendars only)"
    export AVAILABILITY_SINGLE_SOURCE=false
    export AVAILABILITY_DUAL_CHECK=false
    export AVAILABILITY_LEGACY_FALLBACK=true
    
    cat > .env.rollback << EOF
# ROLLBACK: Legacy mode - priceCalendars only
AVAILABILITY_SINGLE_SOURCE=false
AVAILABILITY_DUAL_CHECK=false
AVAILABILITY_LEGACY_FALLBACK=true
EOF
}

set_dual_check_mode() {
    echo "👀 Setting DUAL CHECK mode (compare both sources)"
    export AVAILABILITY_SINGLE_SOURCE=false
    export AVAILABILITY_DUAL_CHECK=true
    export AVAILABILITY_LEGACY_FALLBACK=true
    
    cat > .env.rollback << EOF
# ROLLBACK: Dual check mode - compare sources
AVAILABILITY_SINGLE_SOURCE=false
AVAILABILITY_DUAL_CHECK=true
AVAILABILITY_LEGACY_FALLBACK=true
EOF
}

set_single_source_mode() {
    echo "🎯 Setting SINGLE SOURCE mode (availability collection only)"
    export AVAILABILITY_SINGLE_SOURCE=true
    export AVAILABILITY_DUAL_CHECK=false
    export AVAILABILITY_LEGACY_FALLBACK=true
    
    cat > .env.rollback << EOF
# ROLLBACK: Single source mode - availability collection only
AVAILABILITY_SINGLE_SOURCE=true
AVAILABILITY_DUAL_CHECK=false
AVAILABILITY_LEGACY_FALLBACK=true
EOF
}

# Function to test the current configuration
test_configuration() {
    echo "🧪 Testing current configuration..."
    
    if command -v curl &> /dev/null; then
        echo "📡 Testing check-pricing-v2 endpoint..."
        
        # Test with a sample request
        TEST_RESPONSE=$(curl -s -X POST http://localhost:3000/api/check-pricing-v2 \
            -H "Content-Type: application/json" \
            -d '{
                "propertyId": "prahova-mountain-chalet",
                "checkIn": "2025-07-01",
                "checkOut": "2025-07-03",
                "guests": 4
            }' 2>/dev/null || echo "ERROR")
        
        if [[ "$TEST_RESPONSE" == "ERROR" ]]; then
            echo "❌ Test failed - is the development server running?"
            echo "💡 Start server with: npm run dev"
        else
            echo "✅ Test endpoint responded"
            echo "🔍 Response summary:"
            echo "$TEST_RESPONSE" | jq -r '.meta.featureFlags // "No feature flags in response"' 2>/dev/null || echo "Response received (jq not available for parsing)"
        fi
    else
        echo "⚠️  curl not available, skipping endpoint test"
    fi
}

# Function to deploy environment variables (for production)
deploy_env_vars() {
    echo "🚀 Deploying environment variables..."
    
    if [ -f ".env.rollback" ]; then
        echo "📋 Environment variables to deploy:"
        cat .env.rollback
        echo ""
        
        if command -v gcloud &> /dev/null; then
            echo "🌐 Would you like to deploy these to Cloud Run? (y/N)"
            read -r DEPLOY_RESPONSE
            
            if [[ $DEPLOY_RESPONSE =~ ^[Yy]$ ]]; then
                echo "🔧 Deploying to Cloud Run..."
                # Note: Adjust service name as needed
                gcloud run services update rentalspot-builder \
                    --update-env-vars "$(cat .env.rollback | tr '\n' ',' | sed 's/,$//' | sed 's/# [^=]*//g' | grep -v '^$')" \
                    --region=us-central1 || echo "❌ Deployment failed"
            fi
        else
            echo "💡 gcloud CLI not available. Manual deployment needed:"
            echo "   Set these environment variables in your deployment environment:"
            cat .env.rollback
        fi
    else
        echo "❌ No .env.rollback file found. Run a mode command first."
    fi
}

# Main menu
show_menu() {
    echo ""
    echo "🎛️  Rollback Options:"
    echo "   1) Legacy Mode (priceCalendars only)"
    echo "   2) Dual Check Mode (compare both sources)"
    echo "   3) Single Source Mode (availability collection only)"
    echo "   4) Test Current Configuration"
    echo "   5) Deploy Environment Variables"
    echo "   6) Show Current Status"
    echo "   7) Emergency Rollback (immediate legacy mode)"
    echo "   q) Quit"
    echo ""
}

# Emergency rollback function
emergency_rollback() {
    echo "🚨 EMERGENCY ROLLBACK INITIATED"
    echo "================================="
    
    set_legacy_mode
    
    echo "✅ Environment variables set to legacy mode"
    echo "📝 Created .env.rollback file"
    
    if command -v gcloud &> /dev/null && [ -n "$GOOGLE_CLOUD_PROJECT" ]; then
        echo "🚀 Attempting automatic deployment to Cloud Run..."
        
        # Deploy with a simple command
        gcloud run services update rentalspot-builder \
            --update-env-vars "AVAILABILITY_SINGLE_SOURCE=false,AVAILABILITY_DUAL_CHECK=false,AVAILABILITY_LEGACY_FALLBACK=true" \
            --region=us-central1 \
            --project="$GOOGLE_CLOUD_PROJECT" || echo "❌ Auto-deployment failed, manual intervention needed"
    else
        echo "⚠️  Automatic deployment not available"
        echo "📋 MANUAL ACTION REQUIRED:"
        echo "   Set these environment variables in your deployment:"
        echo "   AVAILABILITY_SINGLE_SOURCE=false"
        echo "   AVAILABILITY_DUAL_CHECK=false"
        echo "   AVAILABILITY_LEGACY_FALLBACK=true"
    fi
    
    echo ""
    echo "✅ Emergency rollback completed"
    echo "🔍 The system should now use the legacy priceCalendars approach"
}

# Check if this is being run as emergency rollback
if [[ "$1" == "--emergency" ]]; then
    emergency_rollback
    exit 0
fi

# Main interactive loop
show_status

while true; do
    show_menu
    read -p "Choose an option: " choice
    
    case $choice in
        1)
            set_legacy_mode
            show_status
            echo "✅ Legacy mode configured"
            ;;
        2)
            set_dual_check_mode
            show_status
            echo "✅ Dual check mode configured"
            ;;
        3)
            set_single_source_mode
            show_status
            echo "✅ Single source mode configured"
            ;;
        4)
            test_configuration
            ;;
        5)
            deploy_env_vars
            ;;
        6)
            show_status
            ;;
        7)
            emergency_rollback
            ;;
        q|Q)
            echo "👋 Goodbye!"
            break
            ;;
        *)
            echo "❌ Invalid option. Please try again."
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
done

echo ""
echo "📋 Summary:"
echo "   - Environment variables saved to .env.rollback"
echo "   - Use option 5 to deploy to production"
echo "   - For emergency rollback: $0 --emergency"
echo ""
echo "🎉 Rollback script completed!"