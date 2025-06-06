#!/bin/bash
# Enhance Status field with Ready, Blocked, Review options

set -e

# Load project info
PROJECT_ID=$(jq -r '.project_id' project-info.json)
STATUS_FIELD_ID="PVTSSF_lAHOCOLa384A62Y9zgvUrgM"

echo "🔧 Enhancing Status field with Ready, Blocked, Review options..."

# Add new status options to existing Status field
echo "   Adding 'Ready' option..."
READY_RESPONSE=$(gh api graphql -f query='
  mutation {
    updateProjectV2FieldOptions(input: {
      fieldId: "'$STATUS_FIELD_ID'"
      options: [
        {id: "f75ad846", name: "📋 Todo", color: GRAY},
        {id: "47fc9ee4", name: "🟡 In Progress", color: YELLOW},
        {id: "98236657", name: "✅ Done", color: GREEN},
        {name: "🔵 Ready", color: BLUE},
        {name: "🔒 Blocked", color: RED},
        {name: "🟣 Review", color: PURPLE}
      ]
    }) {
      projectV2Field {
        ... on ProjectV2SingleSelectField {
          options {
            id
            name
            color
          }
        }
      }
    }
  }')

echo "✅ Status field enhanced with new options"

# Extract new option IDs
READY_OPTION_ID=$(echo $READY_RESPONSE | jq -r '.data.updateProjectV2FieldOptions.projectV2Field.options[] | select(.name=="🔵 Ready") | .id')
BLOCKED_OPTION_ID=$(echo $READY_RESPONSE | jq -r '.data.updateProjectV2FieldOptions.projectV2Field.options[] | select(.name=="🔒 Blocked") | .id')
REVIEW_OPTION_ID=$(echo $READY_RESPONSE | jq -r '.data.updateProjectV2FieldOptions.projectV2Field.options[] | select(.name=="🟣 Review") | .id')

echo "   🔵 Ready Option ID: $READY_OPTION_ID"
echo "   🔒 Blocked Option ID: $BLOCKED_OPTION_ID" 
echo "   🟣 Review Option ID: $REVIEW_OPTION_ID"

# Update project-info.json with new option IDs
jq --arg ready_option_id "$READY_OPTION_ID" \
   --arg blocked_option_id "$BLOCKED_OPTION_ID" \
   --arg review_option_id "$REVIEW_OPTION_ID" \
   '. + {
     "ready_option_id": $ready_option_id,
     "blocked_option_id": $blocked_option_id,
     "review_option_id": $review_option_id
   }' project-info.json > project-info-updated.json

mv project-info-updated.json project-info.json

echo "✅ Enhanced status options saved to project-info.json"
echo ""
echo "🎉 Status field enhancement complete!"
echo "📊 New workflow: Todo → Ready → In Progress → Review → Done"
echo "🔒 Blocked status for dependency management"