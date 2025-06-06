#!/bin/bash
# Start a workflow task by moving it to "In Progress" status

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

if [ $# -eq 0 ]; then
    echo "Usage: $0 <issue-number>"
    echo "Example: $0 39"
    exit 1
fi

ISSUE_NUMBER=$1

# Load project info
if [ ! -f "project-info.json" ]; then
    echo "❌ project-info.json not found. Run setup script first."
    exit 1
fi

PROJECT_ID=$(jq -r '.project_id' project-info.json)
WORKFLOW_STATUS_FIELD_ID=$(jq -r '.workflow_status_field_id' project-info.json)
IN_PROGRESS_OPTION_ID=$(jq -r '.in_progress_option_id' project-info.json)
READY_OPTION_ID=$(jq -r '.ready_option_id' project-info.json)

echo -e "${BLUE}🚀 Starting Task #$ISSUE_NUMBER${NC}"
echo ""

# Get issue details and current status
echo "🔍 Checking task status and dependencies..."

ISSUE_DATA=$(gh api graphql -f query='
  query {
    repository(owner: "b-coman", name: "prop-management") {
      issue(number: '$ISSUE_NUMBER') {
        id
        title
        body
        projectItems(first: 10) {
          nodes {
            id
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  optionId
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

ISSUE_TITLE=$(echo $ISSUE_DATA | jq -r '.data.repository.issue.title')
ISSUE_BODY=$(echo $ISSUE_DATA | jq -r '.data.repository.issue.body')

# Find the project item in our project
PROJECT_ITEM_DATA=$(echo $ISSUE_DATA | jq -r ".data.repository.issue.projectItems.nodes[] | select(.fieldValues.nodes[] | select(.field.id == \"$WORKFLOW_STATUS_FIELD_ID\"))")

if [ -z "$PROJECT_ITEM_DATA" ] || [ "$PROJECT_ITEM_DATA" = "null" ]; then
    echo -e "${RED}❌ Task #$ISSUE_NUMBER not found in project${NC}"
    exit 1
fi

PROJECT_ITEM_ID=$(echo $PROJECT_ITEM_DATA | jq -r '.id')
CURRENT_STATUS=$(echo $PROJECT_ITEM_DATA | jq -r ".fieldValues.nodes[] | select(.field.id == \"$WORKFLOW_STATUS_FIELD_ID\") | .name")

echo -e "${BLUE}📋 Task: $ISSUE_TITLE${NC}"
echo -e "${BLUE}📊 Current Status: $CURRENT_STATUS${NC}"

# Validate task can be started
if [ "$CURRENT_STATUS" != "🔵 Ready" ]; then
    echo -e "${RED}❌ Task #$ISSUE_NUMBER is not ready to start${NC}"
    echo -e "${RED}   Current status: $CURRENT_STATUS${NC}"
    echo -e "${RED}   Only tasks in 'Ready' status can be started${NC}"
    
    if [ "$CURRENT_STATUS" = "🔒 Blocked" ]; then
        echo ""
        echo -e "${YELLOW}💡 This task is blocked by dependencies.${NC}"
        echo -e "${YELLOW}   Complete the blocking tasks first, then this will become Ready.${NC}"
    fi
    
    exit 1
fi

# Check if any other task is already in progress
echo ""
echo "🔍 Checking for other tasks in progress..."

OTHER_IN_PROGRESS=$(gh api graphql -f query='
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
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2SingleSelectField {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }' | jq -r ".data.node.items.nodes[] | select(.fieldValues.nodes[] | select(.field.id == \"$WORKFLOW_STATUS_FIELD_ID\" and .name == \"🟡 In Progress\")) | .content.number")

if [ ! -z "$OTHER_IN_PROGRESS" ]; then
    echo -e "${RED}❌ Another task is already in progress: #$OTHER_IN_PROGRESS${NC}"
    echo -e "${RED}   Only one task can be active at a time${NC}"
    echo -e "${YELLOW}💡 Complete task #$OTHER_IN_PROGRESS first, or use ./scripts/complete-workflow-task.sh $OTHER_IN_PROGRESS${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Task validation passed${NC}"

# Move task to In Progress
echo ""
echo -e "${YELLOW}🔄 Moving task to 'In Progress' status...${NC}"

# Update Workflow Status field
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "'$PROJECT_ID'"
      itemId: "'$PROJECT_ITEM_ID'"
      fieldId: "'$WORKFLOW_STATUS_FIELD_ID'"
      value: {
        singleSelectOptionId: "'$IN_PROGRESS_OPTION_ID'"
      }
    }) {
      projectV2Item {
        id
      }
    }
  }' > /dev/null

# Also update native Status field to In Progress
STATUS_FIELD_ID=$(jq -r '.status_field_id' project-info.json)
NATIVE_IN_PROGRESS_ID="47fc9ee4"  # This is the built-in "In Progress" option ID

echo -e "${YELLOW}🔄 Syncing native Status field...${NC}"
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "'$PROJECT_ID'"
      itemId: "'$PROJECT_ITEM_ID'"
      fieldId: "'$STATUS_FIELD_ID'"
      value: {
        singleSelectOptionId: "'$NATIVE_IN_PROGRESS_ID'"
      }
    }) {
      projectV2Item {
        id
      }
    }
  }' > /dev/null

echo -e "${GREEN}✅ Task #$ISSUE_NUMBER moved to 'In Progress' (both status fields synced)${NC}"

# Display task details and next steps
echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}📋 TASK #$ISSUE_NUMBER NOW ACTIVE${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo -e "${GREEN}Title: $ISSUE_TITLE${NC}"
echo ""
echo -e "${YELLOW}📄 Task Description:${NC}"
echo "$ISSUE_BODY"
echo ""
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo "   1. Implement the requirements according to acceptance criteria"
echo "   2. Create/modify necessary files and tests"
echo "   3. Validate implementation meets all requirements"
echo "   4. Run: ./scripts/complete-workflow-task.sh $ISSUE_NUMBER"
echo ""
echo -e "${BLUE}📊 Project Status:${NC}"
echo "   • This task is now the active work item"
echo "   • No other tasks can be started until this completes"
echo "   • Dependent tasks will become Ready when this is Done"
echo ""
echo -e "${BLUE}🛠️ Available Commands:${NC}"
echo "   📊 ./scripts/query-workflow-status.sh - Check project status"
echo "   ✅ ./scripts/complete-workflow-task.sh $ISSUE_NUMBER - Mark task complete"
echo "   📋 Visit project: $(jq -r '.project_url' project-info.json)"