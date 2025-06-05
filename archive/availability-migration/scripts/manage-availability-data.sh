#!/bin/bash

# Comprehensive availability data management script
# Handles analysis, cleanup, and verification of availability data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "📊 Availability Data Management Tool"
echo "===================================="
echo ""

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

# Function to run analysis
run_analysis() {
    print_status $BLUE "🔍 Running Availability Data Analysis"
    echo "   Analyzing discrepancies between availability and priceCalendars collections"
    echo ""
    
    if npx tsx scripts/analyze-availability-data.ts; then
        print_status $GREEN "✅ Analysis completed successfully"
        
        # Show latest analysis summary
        local latest_summary=$(ls -t logs/availability-analysis-summary-*.txt 2>/dev/null | head -n1)
        if [ -n "$latest_summary" ]; then
            echo ""
            print_status $YELLOW "📋 Latest Analysis Summary:"
            echo "=========================="
            head -n 20 "$latest_summary"
            echo ""
            echo "📄 Full summary: $latest_summary"
        fi
    else
        print_status $RED "❌ Analysis failed"
        return 1
    fi
    echo ""
}

# Function to run cleanup (dry run)
run_cleanup_dryrun() {
    print_status $BLUE "🧹 Running Cleanup (Dry Run)"
    echo "   Testing cleanup operations without making changes"
    echo ""
    
    if npx tsx scripts/cleanup-availability-data.ts; then
        print_status $GREEN "✅ Dry run completed successfully"
        
        # Show latest cleanup summary
        local latest_report=$(ls -t logs/availability-cleanup-dryrun-*.json 2>/dev/null | head -n1)
        if [ -n "$latest_report" ]; then
            echo ""
            print_status $YELLOW "📋 Cleanup Dry Run Summary:"
            echo "==========================="
            echo "Operations planned: $(jq -r '.summary.totalOperations' "$latest_report" 2>/dev/null || echo "N/A")"
            echo "Would succeed: $(jq -r '.summary.successful' "$latest_report" 2>/dev/null || echo "N/A")"
            echo "Would fail: $(jq -r '.summary.failed' "$latest_report" 2>/dev/null || echo "N/A")"
            echo "Would skip: $(jq -r '.summary.skipped' "$latest_report" 2>/dev/null || echo "N/A")"
            echo ""
            echo "📄 Full report: $latest_report"
        fi
    else
        print_status $RED "❌ Cleanup dry run failed"
        return 1
    fi
    echo ""
}

# Function to run live cleanup
run_cleanup_live() {
    print_status $YELLOW "⚠️  LIVE CLEANUP MODE"
    echo "   This will make actual changes to production data!"
    echo ""
    
    read -p "🤔 Are you sure you want to proceed with live cleanup? (y/N): " CONFIRM
    if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
        print_status $YELLOW "❌ Live cleanup cancelled by user"
        return 1
    fi
    
    print_status $BLUE "🚀 Running Live Cleanup"
    echo "   Making actual changes to availability data"
    echo ""
    
    if npx tsx scripts/cleanup-availability-data.ts -- --live; then
        print_status $GREEN "✅ Live cleanup completed successfully"
        
        # Show latest cleanup summary
        local latest_report=$(ls -t logs/availability-cleanup-[0-9]*.json 2>/dev/null | head -n1)
        if [ -n "$latest_report" ]; then
            echo ""
            print_status $YELLOW "📋 Live Cleanup Summary:"
            echo "======================="
            echo "Operations completed: $(jq -r '.summary.totalOperations' "$latest_report" 2>/dev/null || echo "N/A")"
            echo "Successful: $(jq -r '.summary.successful' "$latest_report" 2>/dev/null || echo "N/A")"
            echo "Failed: $(jq -r '.summary.failed' "$latest_report" 2>/dev/null || echo "N/A")"
            echo "Skipped: $(jq -r '.summary.skipped' "$latest_report" 2>/dev/null || echo "N/A")"
            echo "Documents backed up: $(jq -r '.summary.documentsBackedUp' "$latest_report" 2>/dev/null || echo "N/A")"
            echo "Data consistency score: $(jq -r '.summary.dataConsistencyScore' "$latest_report" 2>/dev/null || echo "N/A")%"
            echo ""
            echo "📄 Full report: $latest_report"
            
            # Show backup location
            local backup_location=$(jq -r '.backupLocation // "None"' "$latest_report" 2>/dev/null)
            if [ "$backup_location" != "None" ] && [ "$backup_location" != "null" ]; then
                echo "💾 Backups saved to: $backup_location"
            fi
        fi
    else
        print_status $RED "❌ Live cleanup failed"
        return 1
    fi
    echo ""
}

# Function to show recent reports
show_reports() {
    print_status $BLUE "📋 Recent Reports"
    echo "   Showing latest analysis and cleanup reports"
    echo ""
    
    echo "📊 Analysis Reports:"
    ls -t logs/availability-analysis-summary-*.txt 2>/dev/null | head -n 3 | while read file; do
        echo "   - $(basename "$file")"
    done
    
    echo ""
    echo "🧹 Cleanup Reports (Dry Run):"
    ls -t logs/availability-cleanup-dryrun-*.json 2>/dev/null | head -n 3 | while read file; do
        echo "   - $(basename "$file")"
    done
    
    echo ""
    echo "🚀 Cleanup Reports (Live):"
    ls -t logs/availability-cleanup-[0-9]*.json 2>/dev/null | head -n 3 | while read file; do
        echo "   - $(basename "$file")"
    done
    
    echo ""
}

# Function to validate prerequisites
validate_prerequisites() {
    print_status $BLUE "🔧 Validating Prerequisites"
    echo ""
    
    # Check if TypeScript is available
    if ! command -v npx &> /dev/null; then
        print_status $RED "❌ npx not found. Please install Node.js and npm."
        return 1
    fi
    
    # Check if required files exist
    if [ ! -f "$PROJECT_ROOT/scripts/analyze-availability-data.ts" ]; then
        print_status $RED "❌ Analysis script not found"
        return 1
    fi
    
    if [ ! -f "$PROJECT_ROOT/scripts/cleanup-availability-data.ts" ]; then
        print_status $RED "❌ Cleanup script not found"
        return 1
    fi
    
    # Ensure logs directory exists
    mkdir -p "$PROJECT_ROOT/logs"
    
    # Check for jq (optional but helpful)
    if ! command -v jq &> /dev/null; then
        print_status $YELLOW "⚠️  jq not found. Report summaries will be limited."
        echo "   Install jq for better report formatting: apt-get install jq"
    fi
    
    print_status $GREEN "✅ Prerequisites validated"
    echo ""
}

# Function to run complete workflow
run_complete_workflow() {
    print_status $BLUE "🔄 Running Complete Data Management Workflow"
    echo "   Analysis → Dry Run Cleanup → Manual Approval → Live Cleanup"
    echo ""
    
    # Step 1: Analysis
    if ! run_analysis; then
        print_status $RED "❌ Workflow failed at analysis step"
        return 1
    fi
    
    # Step 2: Dry run cleanup
    if ! run_cleanup_dryrun; then
        print_status $RED "❌ Workflow failed at dry run step"
        return 1
    fi
    
    # Step 3: Ask for approval
    echo ""
    print_status $YELLOW "🤔 Review the dry run results above."
    read -p "Do you want to proceed with live cleanup? (y/N): " PROCEED
    
    if [[ $PROCEED =~ ^[Yy]$ ]]; then
        # Step 4: Live cleanup
        if ! run_cleanup_live; then
            print_status $RED "❌ Workflow failed at live cleanup step"
            return 1
        fi
        
        # Step 5: Final verification
        print_status $BLUE "🔍 Running final verification analysis..."
        if ! run_analysis; then
            print_status $YELLOW "⚠️  Final verification analysis failed, but cleanup completed"
        fi
        
        print_status $GREEN "🎉 Complete workflow finished successfully!"
    else
        print_status $YELLOW "⏭️  Live cleanup skipped by user choice"
        print_status $GREEN "✅ Workflow completed (analysis and dry run only)"
    fi
}

# Main menu
show_menu() {
    echo ""
    print_status $YELLOW "🎛️  Available Operations:"
    echo "   1) Run Analysis Only"
    echo "   2) Run Cleanup (Dry Run)"
    echo "   3) Run Cleanup (LIVE - Makes Changes!)"
    echo "   4) Complete Workflow (Analysis → Dry Run → Live)"
    echo "   5) Show Recent Reports"
    echo "   6) Validate Prerequisites"
    echo "   h) Help"
    echo "   q) Quit"
    echo ""
}

# Help function
show_help() {
    echo ""
    print_status $BLUE "📚 Help - Availability Data Management"
    echo "====================================="
    echo ""
    echo "This tool helps manage availability data consistency across collections:"
    echo ""
    echo "🔍 ANALYSIS:"
    echo "   - Compares 'availability' and 'priceCalendars' collections"
    echo "   - Identifies expired holds and orphaned data"
    echo "   - Generates detailed reports with recommendations"
    echo ""
    echo "🧹 CLEANUP:"
    echo "   - Fixes expired holds (marks as expired, releases dates)"
    echo "   - Removes orphaned holds (holds without bookings)"
    echo "   - Resolves availability discrepancies"
    echo "   - Creates backups before making changes"
    echo ""
    echo "📊 REPORTS:"
    echo "   - Analysis reports: logs/availability-analysis-*.txt"
    echo "   - Cleanup reports: logs/availability-cleanup-*.json"
    echo "   - Backups: logs/availability-cleanup-backups/"
    echo ""
    echo "🔧 SAFETY:"
    echo "   - Always starts with dry run mode"
    echo "   - Creates backups before live changes"
    echo "   - Provides rollback instructions"
    echo "   - Validates data before and after operations"
    echo ""
    echo "📋 WORKFLOW:"
    echo "   1. Run analysis to understand current state"
    echo "   2. Run dry run cleanup to plan changes"
    echo "   3. Review results and backups"
    echo "   4. Run live cleanup if satisfied"
    echo "   5. Verify results with final analysis"
    echo ""
}

# Main execution
main() {
    local mode=${1:-"interactive"}
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Validate prerequisites
    if ! validate_prerequisites; then
        exit 1
    fi
    
    case $mode in
        "analysis")
            run_analysis
            ;;
        "dryrun")
            run_cleanup_dryrun
            ;;
        "live")
            run_cleanup_live
            ;;
        "workflow")
            run_complete_workflow
            ;;
        "reports")
            show_reports
            ;;
        "interactive")
            # Interactive mode
            while true; do
                show_menu
                read -p "Choose an option: " choice
                
                case $choice in
                    1)
                        run_analysis
                        ;;
                    2)
                        run_cleanup_dryrun
                        ;;
                    3)
                        run_cleanup_live
                        ;;
                    4)
                        run_complete_workflow
                        ;;
                    5)
                        show_reports
                        ;;
                    6)
                        validate_prerequisites
                        ;;
                    h|H)
                        show_help
                        ;;
                    q|Q)
                        print_status $GREEN "👋 Goodbye!"
                        break
                        ;;
                    *)
                        print_status $RED "❌ Invalid option. Please try again."
                        ;;
                esac
                
                if [ "$choice" != "h" ] && [ "$choice" != "H" ]; then
                    echo ""
                    read -p "Press Enter to continue..."
                fi
            done
            ;;
        *)
            echo "Usage: $0 [mode]"
            echo ""
            echo "Modes:"
            echo "  analysis     - Run analysis only"
            echo "  dryrun       - Run cleanup dry run only"
            echo "  live         - Run live cleanup only"
            echo "  workflow     - Run complete workflow"
            echo "  reports      - Show recent reports"
            echo "  interactive  - Interactive menu (default)"
            echo ""
            exit 1
            ;;
    esac
}

# Run main function
main "$1"