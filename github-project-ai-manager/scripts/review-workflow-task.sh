#!/bin/bash
# Move a task to Review status for human approval

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
RED='\033[0;31m'
NC='\033[0m'

if [ $# -eq 0 ]; then
    echo "Usage: $0 <issue-number> [review-message]"
    echo "Example: $0 39 'Implementation complete, ready for architectural review'"
    exit 1
fi

ISSUE_NUMBER=$1
REVIEW_MESSAGE=${2:-"Implementation complete, ready for human review"}

# Load project info
if [ ! -f "project-info.json" ]; then
    echo "❌ project-info.json not found. Run setup script first."
    exit 1
fi

PROJECT_ID=$(jq -r '.project_id' project-info.json)
WORKFLOW_STATUS_FIELD_ID=$(jq -r '.workflow_status_field_id' project-info.json)
REVIEW_OPTION_ID=$(jq -r '.review_option_id' project-info.json)
STATUS_FIELD_ID=$(jq -r '.status_field_id' project-info.json)
NATIVE_IN_PROGRESS_ID="47fc9ee4"  # Keep native status as In Progress during review

echo -e "${PURPLE}🟣 Moving Task #$ISSUE_NUMBER to Review${NC}"
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

# Validate task can be moved to review
if [ "$CURRENT_STATUS" != "🟡 In Progress" ]; then
    echo -e "${RED}❌ Task #$ISSUE_NUMBER is not in 'In Progress' status${NC}"
    echo -e "${RED}   Current status: $CURRENT_STATUS${NC}"
    echo -e "${RED}   Only tasks in 'In Progress' can be moved to Review${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Task validation passed${NC}"

# Move task to Review
echo ""
echo -e "${YELLOW}🔄 Moving task to 'Review' status...${NC}"

# Update Workflow Status field to Review
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(input: {
      projectId: "'$PROJECT_ID'"
      itemId: "'$PROJECT_ITEM_ID'"
      fieldId: "'$WORKFLOW_STATUS_FIELD_ID'"
      value: {
        singleSelectOptionId: "'$REVIEW_OPTION_ID'"
      }
    }) {
      projectV2Item {
        id
      }
    }
  }' > /dev/null

# Keep native Status as In Progress (review is still technically in progress)
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

echo -e "${GREEN}✅ Task #$ISSUE_NUMBER moved to 'Review' status${NC}"

# Add review comment to issue
echo ""
echo "💬 Adding review request comment..."
gh issue comment $ISSUE_NUMBER --body "## 🟣 Ready for Review

$REVIEW_MESSAGE

### 📋 Review Request
This task has been completed and is ready for human review and approval.

### 🔍 What to Review
- Implementation meets all acceptance criteria
- Code quality and standards compliance
- Integration with existing systems
- Documentation completeness

### 🎯 Next Steps for Reviewer
- **✅ Approve**: \`./scripts/approve-task.sh $ISSUE_NUMBER\` - Move to Done
- **🔄 Request Changes**: \`./scripts/request-rework.sh $ISSUE_NUMBER \"specific feedback\"\` - Return to In Progress
- **🔒 Block**: \`./scripts/block-task.sh $ISSUE_NUMBER \"reason\"\` - Block for dependencies

### 📊 Review Status
- **Status**: 🟣 Review (Awaiting human approval)
- **Submitted**: $(date '+%Y-%m-%d %H:%M:%S')
- **Reviewer**: Human oversight required

---
*Automated review request from AI-assisted project management system*"

echo ""
echo -e "${PURPLE}================================${NC}"
echo -e "${PURPLE}🟣 TASK #$ISSUE_NUMBER IN REVIEW${NC}"
echo -e "${PURPLE}================================${NC}"
echo ""
echo -e "${GREEN}Title: $ISSUE_TITLE${NC}"
echo -e "${PURPLE}Status: 🟣 Review (Awaiting human approval)${NC}"
echo ""
echo -e "${BLUE}🎯 Awaiting Human Review:${NC}"
echo "   The task implementation is complete and ready for approval"
echo "   A human reviewer should assess the work and provide feedback"
echo ""
echo -e "${BLUE}🛠️ Available Commands for Reviewer:${NC}"
echo "   ✅ ./scripts/approve-task.sh $ISSUE_NUMBER - Approve and mark Done"
echo "   🔄 ./scripts/request-rework.sh $ISSUE_NUMBER \"feedback\" - Request changes"
echo "   🔒 ./scripts/block-task.sh $ISSUE_NUMBER \"reason\" - Block for dependencies"
echo "   📊 ./scripts/query-workflow-status.sh - Check project status"
echo ""
echo -e "${PURPLE}📋 Project Board: $(jq -r '.project_url' project-info.json)${NC}"