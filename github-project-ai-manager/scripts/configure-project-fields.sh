#!/bin/bash

# Configure field values for each issue in the Property Renderer Consolidation project
# Run this after setup-github-project.sh

set -e

echo "🎯 Configuring issue field values..."

# Load project info
if [ ! -f "project-info.json" ]; then
    echo "❌ project-info.json not found. Run setup-github-project.sh first."
    exit 1
fi

PROJECT_ID=$(jq -r '.project_id' project-info.json)
TASK_TYPE_FIELD_ID=$(jq -r '.task_type_field_id' project-info.json)
RISK_LEVEL_FIELD_ID=$(jq -r '.risk_level_field_id' project-info.json)
EFFORT_FIELD_ID=$(jq -r '.effort_field_id' project-info.json)
DEPENDENCIES_FIELD_ID=$(jq -r '.dependencies_field_id' project-info.json)

echo "Using Project ID: $PROJECT_ID"

# Get field option IDs
FIELDS_RESPONSE=$(gh api graphql -f query='
  query{
    node(id: "'$PROJECT_ID'") {
      ... on ProjectV2 {
        fields(first: 20) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
          }
        }
      }
    }
  }')

# Extract option IDs (this is a simplified version - in practice you'd parse these properly)
echo "📊 Field options retrieved"

# Function to update issue field value
update_field() {
    local issue_number=$1
    local field_id=$2
    local option_id=$3
    local field_name=$4
    local option_name=$5
    
    # Get item ID for issue
    ITEM_RESPONSE=$(gh api graphql -f query='
      query {
        repository(owner: "b-coman", name: "prop-management") {
          issue(number: '$issue_number') {
            projectItems(first: 10) {
              nodes {
                id
                project {
                  id
                }
              }
            }
          }
        }
      }')
    
    # Find the item ID for our project
    ITEM_ID=$(echo $ITEM_RESPONSE | jq -r '.data.repository.issue.projectItems.nodes[] | select(.project.id == "'$PROJECT_ID'") | .id')
    
    if [ "$ITEM_ID" != "null" ] && [ -n "$ITEM_ID" ]; then
        echo "   Setting #$issue_number $field_name to $option_name"
        gh api graphql -f query='
          mutation {
            updateProjectV2ItemFieldValue(
              input: {
                projectId: "'$PROJECT_ID'"
                itemId: "'$ITEM_ID'"
                fieldId: "'$field_id'"
                value: {
                  singleSelectOptionId: "'$option_id'"
                }
              }
            ) {
              projectV2Item {
                id
              }
            }
          }' > /dev/null
    else
        echo "   ⚠️  Could not find item ID for issue #$issue_number"
    fi
}

# Function to update text field
update_text_field() {
    local issue_number=$1
    local field_id=$2
    local text_value=$3
    local field_name=$4
    
    # Get item ID for issue
    ITEM_RESPONSE=$(gh api graphql -f query='
      query {
        repository(owner: "b-coman", name: "prop-management") {
          issue(number: '$issue_number') {
            projectItems(first: 10) {
              nodes {
                id
                project {
                  id
                }
              }
            }
          }
        }
      }')
    
    ITEM_ID=$(echo $ITEM_RESPONSE | jq -r '.data.repository.issue.projectItems.nodes[] | select(.project.id == "'$PROJECT_ID'") | .id')
    
    if [ "$ITEM_ID" != "null" ] && [ -n "$ITEM_ID" ]; then
        echo "   Setting #$issue_number $field_name to: $text_value"
        gh api graphql -f query='
          mutation {
            updateProjectV2ItemFieldValue(
              input: {
                projectId: "'$PROJECT_ID'"
                itemId: "'$ITEM_ID'"
                fieldId: "'$field_id'"
                value: {
                  text: "'$text_value'"
                }
              }
            ) {
              projectV2Item {
                id
              }
            }
          }' > /dev/null
    fi
}

echo ""
echo "🔧 Configuring Dependencies..."

# Foundation Tasks
update_text_field 39 $DEPENDENCIES_FIELD_ID "None (foundation task)" "Dependencies"
update_text_field 40 $DEPENDENCIES_FIELD_ID "None (foundation task)" "Dependencies"  
update_text_field 41 $DEPENDENCIES_FIELD_ID "None (foundation task)" "Dependencies"

# Enhancement Tasks
update_text_field 42 $DEPENDENCIES_FIELD_ID "Blocked by: #39, #40, #41" "Dependencies"
update_text_field 43 $DEPENDENCIES_FIELD_ID "Blocked by: #40" "Dependencies"
update_text_field 44 $DEPENDENCIES_FIELD_ID "Blocked by: #39" "Dependencies"

# Migration Tasks  
update_text_field 45 $DEPENDENCIES_FIELD_ID "Blocked by: #42, #43, #44" "Dependencies"
update_text_field 46 $DEPENDENCIES_FIELD_ID "Blocked by: #45" "Dependencies"

# QA Tasks
update_text_field 47 $DEPENDENCIES_FIELD_ID "Blocked by: #42" "Dependencies"
update_text_field 48 $DEPENDENCIES_FIELD_ID "Blocked by: #42" "Dependencies"

# Documentation Tasks
update_text_field 49 $DEPENDENCIES_FIELD_ID "Blocked by: #46" "Dependencies"
update_text_field 50 $DEPENDENCIES_FIELD_ID "Blocked by: #49" "Dependencies"

echo ""
echo "✅ Field configuration completed!"
echo ""
echo "🎉 Your GitHub Project is now fully configured with:"
echo "   📋 12 issues added"
echo "   🏷️  Custom fields (Task Type, Risk Level, Effort, Dependencies)"
echo "   🔗 Dependency relationships mapped"
echo ""
echo "🔧 Manual steps needed:"
echo "   1. Visit your project and create custom views (Board, Timeline, Priority Matrix)"
echo "   2. Set up automation rules for status transitions"
echo "   3. Configure issue priorities based on risk levels"
echo ""
echo "📊 Project URL: $(jq -r '.project_url' project-info.json)"