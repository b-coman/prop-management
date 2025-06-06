#!/bin/bash
# Approve a task in Review status and move to Done

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
RED='\033[0;31m'
NC='\033[0m'

if [ $# -eq 0 ]; then
    echo "Usage: $0 <issue-number> [approval-message]"
    echo "Example: $0 39 'Excellent implementation, meets all requirements'"
    exit 1
fi

ISSUE_NUMBER=$1
APPROVAL_MESSAGE=${2:-"Implementation approved"}

# Load project info
if [ ! -f "project-info.json" ]; then
    echo "❌ project-info.json not found. Run setup script first."
    exit 1
fi

PROJECT_ID=$(jq -r '.project_id' project-info.json)
WORKFLOW_STATUS_FIELD_ID=$(jq -r '.workflow_status_field_id' project-info.json)
DONE_OPTION_ID=$(jq -r '.done_option_id' project-info.json)
STATUS_FIELD_ID=$(jq -r '.status_field_id' project-info.json)
NATIVE_DONE_ID="98236657"  # Built-in "Done" option ID

echo -e "${GREEN}✅ Approving Task #$ISSUE_NUMBER${NC}"
echo ""

# Get issue details and current status
echo "🔍 Checking task status..."

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
              }
            }
          }
        }
      }
    }
  }')

ISSUE_TITLE=$(echo $ISSUE_DATA | jq -r '.data.repository.issue.title')

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

# Validate task is in Review status
if [ "$CURRENT_STATUS" != "🟣 Review" ]; then
    echo -e "${RED}❌ Task #$ISSUE_NUMBER is not in 'Review' status${NC}"
    echo -e "${RED}   Current status: $CURRENT_STATUS${NC}"
    echo -e "${RED}   Only tasks in 'Review' can be approved${NC}"
    echo ""
    echo -e "${YELLOW}💡 Available actions based on current status:${NC}"
    case "$CURRENT_STATUS" in
        "🟡 In Progress")
            echo "   Use: ./scripts/review-workflow-task.sh $ISSUE_NUMBER"
            ;;
        "✅ Done")
            echo "   Task is already completed"
            ;;
        "🔵 Ready")
            echo "   Use: ./scripts/start-workflow-task.sh $ISSUE_NUMBER"
            ;;
        "🔒 Blocked")
            echo "   Resolve dependencies first"
            ;;
    esac
    exit 1
fi

echo -e "${GREEN}✅ Task validation passed${NC}"

# Move task to Done
echo ""
echo -e "${YELLOW}🔄 Approving and moving to 'Done'...${NC}"

# Update Workflow Status field to Done
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "'$PROJECT_ID'"
      itemId: "'$PROJECT_ITEM_ID'"
      fieldId: "'$WORKFLOW_STATUS_FIELD_ID'"
      value: {
        singleSelectOptionId: "'$DONE_OPTION_ID'"
      }
    }) {
      projectV2Item {
        id
      }
    }
  }' > /dev/null

# Update native Status field to Done
echo -e "${YELLOW}🔄 Syncing native Status field...${NC}"
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "'$PROJECT_ID'"
      itemId: "'$PROJECT_ITEM_ID'"
      fieldId: "'$STATUS_FIELD_ID'"
      value: {
        singleSelectOptionId: "'$NATIVE_DONE_ID'"
      }
    }) {
      projectV2Item {
        id
      }
    }
  }' > /dev/null

echo -e "${GREEN}✅ Task #$ISSUE_NUMBER approved and moved to 'Done'${NC}"

# Add approval comment to issue
echo ""
echo "💬 Adding approval comment..."
gh issue comment $ISSUE_NUMBER --body "## ✅ Task Approved and Completed

$APPROVAL_MESSAGE

### 🎉 Approval Details
- **Status**: ✅ Done
- **Approved by**: Human reviewer
- **Approved at**: $(date '+%Y-%m-%d %H:%M:%S')

### 📊 Completion Summary
This task has been reviewed, approved, and marked as complete. The implementation meets all requirements and is ready for production use.

### 🔗 Impact
Dependent tasks may now become available for work.

---
*Task approved through AI-assisted project management review workflow*"

# Check for dependent tasks that might become unblocked
echo ""
echo "🔍 Checking for dependent tasks..."

# Simple dependency check - look for issues that reference this one
DEPENDENT_ISSUES=$(gh issue list --repo b-coman/prop-management --state open --search "in:body #$ISSUE_NUMBER" --json number,title --jq '.[] | "   #\(.number): \(.title)"')

if [ ! -z "$DEPENDENT_ISSUES" ]; then
    echo -e "${BLUE}📋 Issues that may be affected:${NC}"
    echo "$DEPENDENT_ISSUES"
    echo ""
    echo -e "${YELLOW}💡 Check if any dependent tasks can now move to Ready status${NC}"
    echo "   Run: ./scripts/query-workflow-status.sh"
else
    echo -e "${GREEN}ℹ️ No dependent tasks found for #$ISSUE_NUMBER${NC}"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}🎉 TASK #$ISSUE_NUMBER APPROVED!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${GREEN}📋 Issue: $ISSUE_TITLE${NC}"
echo -e "${GREEN}✅ Status: Done (Approved)${NC}"
echo -e "${GREEN}👤 Approved by: Human reviewer${NC}"
echo ""
echo -e "${BLUE}🔧 Next Actions:${NC}"
echo "   📊 Check status: ./scripts/query-workflow-status.sh"
echo "   🚀 Start next task: ./scripts/start-workflow-task.sh [issue_number]"
echo "   🔍 Check dependencies: ./scripts/check-workflow-dependencies.sh"
echo ""
echo -e "${GREEN}📋 Project Board: $(jq -r '.project_url' project-info.json)${NC}"