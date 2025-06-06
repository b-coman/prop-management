#!/bin/bash
# Configure initial status for all project items

set -e

# Load project info
PROJECT_ID=$(jq -r '.project_id' project-info.json)

# Status field configuration from the query above
STATUS_FIELD_ID="PVTSSF_lAHOCOLa384A62Y9zgvUrgM"
TODO_OPTION_ID="f75ad846"
IN_PROGRESS_OPTION_ID="47fc9ee4"
DONE_OPTION_ID="98236657"

echo "🔧 Configuring initial project status..."

# Update project-info.json with Status field info
jq --arg status_field_id "$STATUS_FIELD_ID" \
   --arg todo_option_id "$TODO_OPTION_ID" \
   --arg in_progress_option_id "$IN_PROGRESS_OPTION_ID" \
   --arg done_option_id "$DONE_OPTION_ID" \
   '. + {
     "status_field_id": $status_field_id,
     "todo_option_id": $todo_option_id,
     "in_progress_option_id": $in_progress_option_id,
     "done_option_id": $done_option_id
   }' project-info.json > project-info-updated.json

mv project-info-updated.json project-info.json

echo "✅ Status field configuration saved to project-info.json"

# Get all project items
echo "📊 Getting project items..."
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
                title
              }
            }
          }
        }
      }
    }
  }')

# Set foundation tasks (39, 40, 41) to "Todo" (ready to start)
# Set all other tasks to "Todo" as well (but they're blocked by dependencies)
echo ""
echo "🚀 Setting foundation tasks (#39, #40, #41) to 'Todo' status (ready to start)..."

for issue_num in 39 40 41; do
  ITEM_ID=$(echo "$ITEMS_RESPONSE" | jq -r ".data.node.items.nodes[] | select(.content.number == $issue_num) | .id")
  ISSUE_TITLE=$(echo "$ITEMS_RESPONSE" | jq -r ".data.node.items.nodes[] | select(.content.number == $issue_num) | .content.title")
  
  if [ "$ITEM_ID" != "null" ] && [ ! -z "$ITEM_ID" ]; then
    echo "   Setting #$issue_num '$ISSUE_TITLE' to Todo..."
    gh api graphql -f query='
      mutation {
        updateProjectV2ItemFieldValue(input: {
          projectId: "'$PROJECT_ID'"
          itemId: "'$ITEM_ID'"
          fieldId: "'$STATUS_FIELD_ID'"
          value: {
            singleSelectOptionId: "'$TODO_OPTION_ID'"
          }
        }) {
          projectV2Item {
            id
          }
        }
      }' > /dev/null
  fi
done

echo ""
echo "📋 Setting remaining tasks to 'Todo' status (blocked by dependencies)..."

for issue_num in 42 43 44 45 46 47 48 49 50; do
  ITEM_ID=$(echo "$ITEMS_RESPONSE" | jq -r ".data.node.items.nodes[] | select(.content.number == $issue_num) | .id")
  ISSUE_TITLE=$(echo "$ITEMS_RESPONSE" | jq -r ".data.node.items.nodes[] | select(.content.number == $issue_num) | .content.title")
  
  if [ "$ITEM_ID" != "null" ] && [ ! -z "$ITEM_ID" ]; then
    echo "   Setting #$issue_num to Todo (blocked)..."
    gh api graphql -f query='
      mutation {
        updateProjectV2ItemFieldValue(input: {
          projectId: "'$PROJECT_ID'"
          itemId: "'$ITEM_ID'"
          fieldId: "'$STATUS_FIELD_ID'"
          value: {
            singleSelectOptionId: "'$TODO_OPTION_ID'"
          }
        }) {
          projectV2Item {
            id
          }
        }
      }' > /dev/null
  fi
done

echo ""
echo "🎉 Initial status configuration complete!"
echo "📊 Foundation tasks are ready to start"
echo "🔗 Other tasks are in Todo but blocked by dependencies"
echo ""
echo "📋 Visit your project: $(jq -r '.project_url' project-info.json)"