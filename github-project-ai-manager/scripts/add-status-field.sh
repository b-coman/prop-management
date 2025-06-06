#!/bin/bash
# Add Status field to existing GitHub Project

set -e

# Load project info
if [ ! -f "project-info.json" ]; then
    echo "❌ project-info.json not found. Run setup-github-project.sh first."
    exit 1
fi

PROJECT_ID=$(jq -r '.project_id' project-info.json)

echo "🏷️  Adding Status field to project..."

# Create Status field with workflow states
STATUS_RESPONSE=$(gh api graphql -f query='
  mutation {
    createProjectV2Field(input: {
      projectId: "'$PROJECT_ID'"
      dataType: SINGLE_SELECT
      name: "Status"
      singleSelectOptions: [
        {name: "📋 Backlog", color: GRAY, description: "Not yet started"},
        {name: "🔵 Ready", color: BLUE, description: "Can begin work"},
        {name: "🟡 In Progress", color: YELLOW, description: "Currently active"},
        {name: "🟣 Review", color: PURPLE, description: "Awaits review"},
        {name: "✅ Done", color: GREEN, description: "Complete and tested"}
      ]
    }) {
      projectV2Field {
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
  }')

STATUS_FIELD_ID=$(echo $STATUS_RESPONSE | jq -r '.data.createProjectV2Field.projectV2Field.id')
echo "✅ Status field created: $STATUS_FIELD_ID"

# Get the option IDs
BACKLOG_OPTION_ID=$(echo $STATUS_RESPONSE | jq -r '.data.createProjectV2Field.projectV2Field.options[] | select(.name=="📋 Backlog") | .id')
READY_OPTION_ID=$(echo $STATUS_RESPONSE | jq -r '.data.createProjectV2Field.projectV2Field.options[] | select(.name=="🔵 Ready") | .id')

echo "   Backlog Option ID: $BACKLOG_OPTION_ID"
echo "   Ready Option ID: $READY_OPTION_ID"

# Update project-info.json with Status field info
jq --arg status_field_id "$STATUS_FIELD_ID" \
   --arg backlog_option_id "$BACKLOG_OPTION_ID" \
   --arg ready_option_id "$READY_OPTION_ID" \
   '. + {
     "status_field_id": $status_field_id,
     "backlog_option_id": $backlog_option_id,
     "ready_option_id": $ready_option_id
   }' project-info.json > project-info-updated.json

mv project-info-updated.json project-info.json

echo "✅ Status field configuration saved to project-info.json"

# Now set all issues to Backlog initially
echo ""
echo "🔧 Setting all issues to Backlog status..."

# Get all project items
ITEMS_RESPONSE=$(gh api graphql -f query='
  query {
    node(id: "'$PROJECT_ID'") {
      ... on ProjectV2 {
        items(first: 50) {
          nodes {
            id
            content {
              ... on Issue {
                number
              }
            }
          }
        }
      }
    }
  }')

# Set each item to Backlog status
echo "$ITEMS_RESPONSE" | jq -r '.data.node.items.nodes[] | "\(.id)|\(.content.number)"' | while IFS='|' read -r item_id issue_number; do
  echo "   Setting #$issue_number to Backlog..."
  gh api graphql -f query='
    mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "'$PROJECT_ID'"
        itemId: "'$item_id'"
        fieldId: "'$STATUS_FIELD_ID'"
        value: {
          singleSelectOptionId: "'$BACKLOG_OPTION_ID'"
        }
      }) {
        projectV2Item {
          id
        }
      }
    }' > /dev/null
done

echo "✅ All issues set to Backlog status"

# Now move foundation tasks to Ready
echo ""
echo "🚀 Moving foundation tasks to Ready status..."

# Foundation tasks are #39, #40, #41
for issue_num in 39 40 41; do
  # Find the item ID for this issue
  ITEM_ID=$(echo "$ITEMS_RESPONSE" | jq -r ".data.node.items.nodes[] | select(.content.number == $issue_num) | .id")
  
  if [ "$ITEM_ID" != "null" ] && [ ! -z "$ITEM_ID" ]; then
    echo "   Moving #$issue_num to Ready..."
    gh api graphql -f query='
      mutation {
        updateProjectV2ItemFieldValue(input: {
          projectId: "'$PROJECT_ID'"
          itemId: "'$ITEM_ID'"
          fieldId: "'$STATUS_FIELD_ID'"
          value: {
            singleSelectOptionId: "'$READY_OPTION_ID'"
          }
        }) {
          projectV2Item {
            id
          }
        }
      }' > /dev/null
  fi
done

echo "✅ Foundation tasks moved to Ready status"

echo ""
echo "🎉 Status field setup complete!"
echo "📊 Visit your project to see the board view: $(jq -r '.project_url' project-info.json)"