#!/bin/bash

# Comprehensive test runner for availability deduplication system
# This script runs all test suites and generates reports

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🧪 Availability Deduplication Test Suite"
echo "========================================"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to run test suite
run_test_suite() {
    local suite_name=$1
    local test_pattern=$2
    local description=$3
    
    print_status $BLUE "📋 Running $suite_name"
    echo "   $description"
    echo ""
    
    if npm test -- --testPathPattern="$test_pattern" --verbose; then
        print_status $GREEN "✅ $suite_name PASSED"
    else
        print_status $RED "❌ $suite_name FAILED"
        return 1
    fi
    echo ""
}

# Function to run performance tests
run_performance_tests() {
    print_status $BLUE "⚡ Running Performance Tests"
    echo "   Testing response times and load handling"
    echo ""
    
    # Run with longer timeout for performance tests
    if npm test -- --testPathPattern="performance" --testTimeout=60000 --verbose; then
        print_status $GREEN "✅ Performance Tests PASSED"
    else
        print_status $RED "❌ Performance Tests FAILED"
        return 1
    fi
    echo ""
}

# Function to run coverage analysis
run_coverage() {
    print_status $BLUE "📊 Running Coverage Analysis"
    echo "   Analyzing test coverage for availability system"
    echo ""
    
    if npm test -- --coverage --coverageReporters=text --coverageReporters=html; then
        print_status $GREEN "✅ Coverage Analysis COMPLETED"
        echo "   📈 Coverage report: ./coverage/index.html"
    else
        print_status $YELLOW "⚠️  Coverage Analysis had issues (tests may still pass)"
    fi
    echo ""
}

# Function to validate feature flags
validate_feature_flags() {
    print_status $BLUE "🚩 Validating Feature Flag Tests"
    echo "   Testing all three modes: LEGACY, DUAL_CHECK, SINGLE_SOURCE"
    echo ""
    
    # Test legacy mode
    export AVAILABILITY_SINGLE_SOURCE=false
    export AVAILABILITY_DUAL_CHECK=false
    export AVAILABILITY_LEGACY_FALLBACK=true
    
    if npm test -- --testPathPattern="availability-service.test" --testNamePattern="Legacy Mode" --verbose; then
        print_status $GREEN "✅ Legacy Mode Tests PASSED"
    else
        print_status $RED "❌ Legacy Mode Tests FAILED"
        return 1
    fi
    
    # Test dual check mode  
    export AVAILABILITY_DUAL_CHECK=true
    
    if npm test -- --testPathPattern="availability-service.test" --testNamePattern="Dual Check" --verbose; then
        print_status $GREEN "✅ Dual Check Mode Tests PASSED"
    else
        print_status $RED "❌ Dual Check Mode Tests FAILED"
        return 1
    fi
    
    # Test single source mode
    export AVAILABILITY_SINGLE_SOURCE=true
    export AVAILABILITY_DUAL_CHECK=false
    
    if npm test -- --testPathPattern="availability-service.test" --testNamePattern="Single Source" --verbose; then
        print_status $GREEN "✅ Single Source Mode Tests PASSED"
    else
        print_status $RED "❌ Single Source Mode Tests FAILED"
        return 1
    fi
    
    # Reset to defaults
    export AVAILABILITY_SINGLE_SOURCE=false
    export AVAILABILITY_DUAL_CHECK=false
    export AVAILABILITY_LEGACY_FALLBACK=true
    
    echo ""
}

# Main test execution
main() {
    local test_mode=${1:-"all"}
    local failed_tests=0
    
    print_status $YELLOW "🔧 Test Configuration:"
    echo "   Mode: $test_mode"
    echo "   Node version: $(node --version)"
    echo "   Jest version: $(npx jest --version)"
    echo ""
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status $YELLOW "📦 Installing dependencies..."
        npm install
        echo ""
    fi
    
    case $test_mode in
        "unit")
            run_test_suite "Unit Tests" "availability-service.test" "Testing availability service logic with feature flags" || ((failed_tests++))
            ;;
            
        "integration")
            run_test_suite "Integration Tests" "check-pricing-integration.test" "Testing API endpoints with availability service" || ((failed_tests++))
            ;;
            
        "e2e")
            run_test_suite "End-to-End Tests" "booking-flow.test" "Testing complete booking workflows" || ((failed_tests++))
            ;;
            
        "performance")
            run_performance_tests || ((failed_tests++))
            ;;
            
        "flags")
            validate_feature_flags || ((failed_tests++))
            ;;
            
        "coverage")
            run_coverage || ((failed_tests++))
            ;;
            
        "all")
            print_status $YELLOW "🎯 Running Complete Test Suite"
            echo ""
            
            # Run all test suites
            run_test_suite "Unit Tests" "availability-service.test" "Testing availability service logic" || ((failed_tests++))
            run_test_suite "Integration Tests" "check-pricing-integration.test" "Testing API endpoints" || ((failed_tests++))
            run_test_suite "End-to-End Tests" "booking-flow.test" "Testing booking workflows" || ((failed_tests++))
            run_performance_tests || ((failed_tests++))
            validate_feature_flags || ((failed_tests++))
            run_coverage || ((failed_tests++))
            ;;
            
        *)
            print_status $RED "❌ Unknown test mode: $test_mode"
            echo ""
            echo "Available modes:"
            echo "  unit        - Run unit tests only"
            echo "  integration - Run integration tests only"
            echo "  e2e         - Run end-to-end tests only"
            echo "  performance - Run performance tests only"
            echo "  flags       - Run feature flag validation only"
            echo "  coverage    - Run coverage analysis only"
            echo "  all         - Run all tests (default)"
            exit 1
            ;;
    esac
    
    # Generate test report
    if [ -f "test-reports/availability-test-report.html" ]; then
        print_status $BLUE "📋 Test report generated: ./test-reports/availability-test-report.html"
    fi
    
    # Final summary
    echo ""
    print_status $YELLOW "📊 Test Summary"
    echo "==================="
    
    if [ $failed_tests -eq 0 ]; then
        print_status $GREEN "🎉 ALL TESTS PASSED!"
        echo ""
        echo "✅ Availability deduplication system is ready for deployment"
        echo "🚀 Safe to proceed with implementation phases"
    else
        print_status $RED "❌ $failed_tests TEST SUITE(S) FAILED"
        echo ""
        echo "🔧 Please fix failing tests before proceeding"
        echo "📋 Check test reports for detailed information"
        exit 1
    fi
    
    echo ""
    echo "📚 Next Steps:"
    echo "   1. Review test coverage: ./coverage/index.html"
    echo "   2. Check test report: ./test-reports/availability-test-report.html"
    echo "   3. Run './scripts/availability-rollback.sh' to test rollback procedures"
    echo "   4. Deploy feature flags with './scripts/deploy-hold-cleanup.sh'"
    echo ""
}

# Show usage if help requested
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Usage: $0 [mode]"
    echo ""
    echo "Test modes:"
    echo "  all         - Run complete test suite (default)"
    echo "  unit        - Run unit tests only"
    echo "  integration - Run integration tests only"
    echo "  e2e         - Run end-to-end tests only"
    echo "  performance - Run performance tests only"
    echo "  flags       - Run feature flag validation only"
    echo "  coverage    - Run coverage analysis only"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run all tests"
    echo "  $0 unit              # Run unit tests only"
    echo "  $0 performance       # Run performance tests only"
    echo ""
    exit 0
fi

# Run main function
main "$1"