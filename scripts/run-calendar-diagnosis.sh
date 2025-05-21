#!/bin/bash

# Helper script to run the calendar structure diagnosis

# Default values
PROPERTY_ID="prahova-mountain-chalet"
YEAR="2025"
MONTH="05"

# Usage information
function show_usage {
  echo "Usage: $0 [property_id] [year] [month]"
  echo ""
  echo "Diagnoses the price calendar structure in Firestore"
  echo ""
  echo "Arguments:"
  echo "  property_id    Property ID (default: prahova-mountain-chalet)"
  echo "  year           Calendar year (default: 2025)"
  echo "  month          Calendar month (default: 05)"
  echo ""
  echo "Example:"
  echo "  $0 prahova-mountain-chalet 2025 05"
}

# Check if help was requested
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
  show_usage
  exit 0
fi

# Override with provided arguments
if [[ -n "$1" ]]; then
  PROPERTY_ID="$1"
fi

if [[ -n "$2" ]]; then
  YEAR="$2"
fi

if [[ -n "$3" ]]; then
  MONTH="$3"
fi

# Execute the TypeScript script with the provided arguments
echo "Running price calendar structure diagnosis for ${PROPERTY_ID}, ${YEAR}-${MONTH}..."
npx tsx scripts/diagnose-production-calendar-structure.ts "$PROPERTY_ID" "$YEAR" "$MONTH"

# Show instructions for next steps
if [ $? -eq 0 ]; then
  echo ""
  echo "Next steps:"
  echo "1. Review the diagnosis results and calendar-structure-analysis.json"
  echo "2. Based on the findings, implement the recommended fix for the data structure mismatch"
  echo "   - Update the API endpoint to handle both structures (short-term fix)"
  echo "   - Create a migration to standardize all calendars (long-term fix)"
  echo ""
fi