#!/bin/bash
# Query project status using the new Workflow Status field

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
    echo ""
}

# Load project info
if [ ! -f "project-info.json" ]; then
    echo "❌ project-info.json not found. Run setup script first."
    exit 1
fi

PROJECT_ID=$(jq -r '.project_id' project-info.json)
PROJECT_URL=$(jq -r '.project_url' project-info.json)
WORKFLOW_STATUS_FIELD_ID=$(jq -r '.workflow_status_field_id' project-info.json)

print_header "Property Renderer Consolidation - Workflow Status"

echo -e "${CYAN}📊 Project: $PROJECT_URL${NC}"
echo -e "${CYAN}🆔 Project ID: $PROJECT_ID${NC}"
echo ""

# Query project with workflow status
echo "🔍 Querying workflow status..."

PROJECT_DATA=$(gh api graphql -f query='
  query {
    node(id: "'$PROJECT_ID'") {
      ... on ProjectV2 {
        title
        items(first: 50) {
          nodes {
            id
            content {
              ... on Issue {
                number
                title
              }
            }
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2SingleSelectField {
                      id
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field {
                    ... on ProjectV2Field {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }')

echo "✅ Project data retrieved"
echo ""

# Parse and organize tasks by workflow status
READY_TASKS=""
BLOCKED_TASKS=""
IN_PROGRESS_TASKS=""
REVIEW_TASKS=""
DONE_TASKS=""
BACKLOG_TASKS=""

# Process each item
echo "$PROJECT_DATA" | jq -r '.data.node.items.nodes[] | @base64' | while read item; do
    ITEM_DATA=$(echo $item | base64 --decode)
    ISSUE_NUMBER=$(echo $ITEM_DATA | jq -r '.content.number')
    ISSUE_TITLE=$(echo $ITEM_DATA | jq -r '.content.title')
    
    # Get workflow status
    WORKFLOW_STATUS=$(echo $ITEM_DATA | jq -r ".fieldValues.nodes[] | select(.field.id == \"$WORKFLOW_STATUS_FIELD_ID\") | .name")
    
    # Get task type
    TASK_TYPE=$(echo $ITEM_DATA | jq -r '.fieldValues.nodes[] | select(.field.name == "Task Type") | .name')
    
    # Get dependencies  
    DEPENDENCIES=$(echo $ITEM_DATA | jq -r '.fieldValues.nodes[] | select(.field.name == "Dependencies") | .text')
    
    echo "Issue #$ISSUE_NUMBER: $WORKFLOW_STATUS | $TASK_TYPE"
    echo "  Title: $ISSUE_TITLE"
    if [ "$DEPENDENCIES" != "null" ] && [ ! -z "$DEPENDENCIES" ]; then
        echo "  Dependencies: $DEPENDENCIES"
    fi
    echo ""
done

print_header "📊 Workflow Status Summary"

# Count tasks by status
READY_COUNT=$(echo "$PROJECT_DATA" | jq -r ".data.node.items.nodes[] | select(.fieldValues.nodes[] | select(.field.id == \"$WORKFLOW_STATUS_FIELD_ID\" and .name == \"🔵 Ready\")) | .content.number" | wc -l)
BLOCKED_COUNT=$(echo "$PROJECT_DATA" | jq -r ".data.node.items.nodes[] | select(.fieldValues.nodes[] | select(.field.id == \"$WORKFLOW_STATUS_FIELD_ID\" and .name == \"🔒 Blocked\")) | .content.number" | wc -l)
IN_PROGRESS_COUNT=$(echo "$PROJECT_DATA" | jq -r ".data.node.items.nodes[] | select(.fieldValues.nodes[] | select(.field.id == \"$WORKFLOW_STATUS_FIELD_ID\" and .name == \"🟡 In Progress\")) | .content.number" | wc -l)
DONE_COUNT=$(echo "$PROJECT_DATA" | jq -r ".data.node.items.nodes[] | select(.fieldValues.nodes[] | select(.field.id == \"$WORKFLOW_STATUS_FIELD_ID\" and .name == \"✅ Done\")) | .content.number" | wc -l)

echo -e "${BLUE}🔵 Ready: $READY_COUNT tasks${NC}"
echo -e "${RED}🔒 Blocked: $BLOCKED_COUNT tasks${NC}"  
echo -e "${YELLOW}🟡 In Progress: $IN_PROGRESS_COUNT tasks${NC}"
echo -e "${GREEN}✅ Done: $DONE_COUNT tasks${NC}"

echo ""

# Show ready tasks (available to start)
echo -e "${BLUE}🔵 READY TO START:${NC}"
echo "$PROJECT_DATA" | jq -r ".data.node.items.nodes[] | select(.fieldValues.nodes[] | select(.field.id == \"$WORKFLOW_STATUS_FIELD_ID\" and .name == \"🔵 Ready\")) | \"   #\" + (.content.number | tostring) + \": \" + .content.title"

echo ""

# Show blocked tasks with dependencies
echo -e "${RED}🔒 BLOCKED (Waiting for dependencies):${NC}"
echo "$PROJECT_DATA" | jq -r ".data.node.items.nodes[] | select(.fieldValues.nodes[] | select(.field.id == \"$WORKFLOW_STATUS_FIELD_ID\" and .name == \"🔒 Blocked\")) | \"   #\" + (.content.number | tostring) + \": \" + .content.title"

echo ""

print_header "🎯 AI Recommendations"

if [ "$READY_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Ready to start work!${NC}"
    echo "   Foundation tasks are available:"
    echo "$PROJECT_DATA" | jq -r ".data.node.items.nodes[] | select(.fieldValues.nodes[] | select(.field.id == \"$WORKFLOW_STATUS_FIELD_ID\" and .name == \"🔵 Ready\")) | \"   • Start #\" + (.content.number | tostring)"
    echo ""
    echo "   Recommended first task: #39 (Data transformation utilities)"
    echo "   Command: ./scripts/start-workflow-task.sh 39"
else
    echo "   No tasks currently ready to start"
fi

print_header "🛠️ Available Commands"

echo "   📊 ./scripts/query-workflow-status.sh - This enhanced status report"
echo "   🚀 ./scripts/start-workflow-task.sh [issue] - Start task (moves to In Progress)"
echo "   ✅ ./scripts/complete-workflow-task.sh [issue] - Complete task (moves to Done)"
echo "   🔍 ./scripts/check-workflow-dependencies.sh - Check for newly ready tasks"
echo ""