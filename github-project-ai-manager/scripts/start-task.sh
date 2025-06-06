#!/bin/bash

# Start a task by moving it to "In Progress" status

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'

if [ $# -eq 0 ]; then
    echo "❌ Usage: $0 <issue_number>"
    echo "   Example: $0 39"
    exit 1
fi

ISSUE_NUMBER=$1

print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
    echo ""
}

# Load project info
if [ ! -f "project-info.json" ]; then
    echo "❌ project-info.json not found. Run setup-github-project.sh first."
    exit 1
fi

PROJECT_ID=$(jq -r '.project_id' project-info.json)

print_header "Starting Task #$ISSUE_NUMBER"

echo -e "${BLUE}📊 Project ID: $PROJECT_ID${NC}"
echo ""

# Get issue details and check if it exists
echo "🔍 Checking issue #$ISSUE_NUMBER..."

ISSUE_DATA=$(gh api graphql -f query='
  query {
    repository(owner: "b-coman", name: "prop-management") {
      issue(number: '$ISSUE_NUMBER') {
        title
        state
        projectItems(first: 10) {
          nodes {
            id
            project {
              id
            }
            fieldValues(first: 10) {
              nodes {
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2FieldCommon {
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

ISSUE_TITLE=$(echo "$ISSUE_DATA" | jq -r '.data.repository.issue.title // "Not found"')
ISSUE_STATE=$(echo "$ISSUE_DATA" | jq -r '.data.repository.issue.state // "unknown"')

if [ "$ISSUE_TITLE" = "Not found" ]; then
    echo -e "${RED}❌ Issue #$ISSUE_NUMBER not found${NC}"
    exit 1
fi

if [ "$ISSUE_STATE" = "CLOSED" ]; then
    echo -e "${RED}❌ Issue #$ISSUE_NUMBER is already closed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Issue found: $ISSUE_TITLE${NC}"

# Get project item details
ITEM_ID=$(echo "$ISSUE_DATA" | jq -r '.data.repository.issue.projectItems.nodes[] | select(.project.id == "'$PROJECT_ID'") | .id')
CURRENT_STATUS=$(echo "$ISSUE_DATA" | jq -r '.data.repository.issue.projectItems.nodes[] | select(.project.id == "'$PROJECT_ID'") | .fieldValues.nodes[] | select(.field.name == "Status") | .name // "No Status"')
DEPENDENCIES=$(echo "$ISSUE_DATA" | jq -r '.data.repository.issue.projectItems.nodes[] | select(.project.id == "'$PROJECT_ID'") | .fieldValues.nodes[] | select(.field.name == "Dependencies") | .text // "No Dependencies"')

if [ "$ITEM_ID" = "null" ] || [ -z "$ITEM_ID" ]; then
    echo -e "${RED}❌ Issue #$ISSUE_NUMBER not found in project${NC}"
    exit 1
fi

echo "📋 Current Status: $CURRENT_STATUS"
echo "🔗 Dependencies: $DEPENDENCIES"
echo ""

# Check dependencies
if [[ "$DEPENDENCIES" == *"Blocked by"* ]]; then
    echo -e "${YELLOW}⚠️  Checking dependencies...${NC}"
    
    # Extract blocking issue numbers
    BLOCKING_ISSUES=$(echo "$DEPENDENCIES" | grep -o '#[0-9]\+' | tr -d '#' || true)
    
    if [ ! -z "$BLOCKING_ISSUES" ]; then
        echo "🔍 Checking blocking issues: $BLOCKING_ISSUES"
        
        for blocking_issue in $BLOCKING_ISSUES; do
            # Check if blocking issue is completed
            BLOCKING_STATUS=$(gh api graphql -f query='
              query {
                repository(owner: "b-coman", name: "prop-management") {
                  issue(number: '$blocking_issue') {
                    state
                    projectItems(first: 10) {
                      nodes {
                        project {
                          id
                        }
                        fieldValues(first: 10) {
                          nodes {
                            ... on ProjectV2ItemFieldSingleSelectValue {
                              name
                              field {
                                ... on ProjectV2FieldCommon {
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
              }' | jq -r '.data.repository.issue.projectItems.nodes[] | select(.project.id == "'$PROJECT_ID'") | .fieldValues.nodes[] | select(.field.name == "Status") | .name // "Unknown"')
            
            if [ "$BLOCKING_STATUS" != "Done" ]; then
                echo -e "${RED}❌ Blocking issue #$blocking_issue is not complete (Status: $BLOCKING_STATUS)${NC}"
                echo "   Cannot start #$ISSUE_NUMBER until dependencies are resolved."
                exit 1
            else
                echo -e "${GREEN}✅ Blocking issue #$blocking_issue is complete${NC}"
            fi
        done
    fi
fi

# Get project fields
echo "🔍 Getting project field information..."

FIELDS_DATA=$(gh api graphql -f query='
  query {
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

STATUS_FIELD_ID=$(echo "$FIELDS_DATA" | jq -r '.data.node.fields.nodes[] | select(.name == "Status") | .id')
IN_PROGRESS_OPTION_ID=$(echo "$FIELDS_DATA" | jq -r '.data.node.fields.nodes[] | select(.name == "Status") | .options[] | select(.name == "In Progress") | .id')

if [ "$STATUS_FIELD_ID" = "null" ] || [ "$IN_PROGRESS_OPTION_ID" = "null" ]; then
    echo -e "${RED}❌ Status field or 'In Progress' option not found${NC}"
    echo "Available status options:"
    echo "$FIELDS_DATA" | jq -r '.data.node.fields.nodes[] | select(.name == "Status") | .options[] | "   - \(.name)"'
    exit 1
fi

# Move to In Progress
echo -e "${YELLOW}🚀 Moving issue #$ISSUE_NUMBER to 'In Progress'...${NC}"

UPDATE_RESULT=$(gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: "'$PROJECT_ID'"
        itemId: "'$ITEM_ID'"
        fieldId: "'$STATUS_FIELD_ID'"
        value: {
          singleSelectOptionId: "'$IN_PROGRESS_OPTION_ID'"
        }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }')

if echo "$UPDATE_RESULT" | jq -e '.data.updateProjectV2ItemFieldValue.projectV2Item.id' > /dev/null; then
    echo -e "${GREEN}✅ Successfully moved #$ISSUE_NUMBER to 'In Progress'${NC}"
else
    echo -e "${RED}❌ Failed to update issue status${NC}"
    echo "Error: $UPDATE_RESULT"
    exit 1
fi

print_header "🎯 Task #$ISSUE_NUMBER Started!"

echo -e "${GREEN}📋 Issue: $ISSUE_TITLE${NC}"
echo -e "${YELLOW}🟡 Status: In Progress${NC}"
echo ""

# Show acceptance criteria from issue
echo "📝 Acceptance Criteria:"
gh issue view $ISSUE_NUMBER --json body --jq '.body' | grep -A 20 "## Acceptance Criteria" | head -20 || echo "   (Check issue #$ISSUE_NUMBER for detailed acceptance criteria)"

echo ""
echo -e "${BLUE}🔧 Development Commands:${NC}"
echo "   📊 Check status: ./query-project-status.sh"
echo "   ✅ Complete task: ./complete-task.sh $ISSUE_NUMBER"
echo "   🔗 View issue: gh issue view $ISSUE_NUMBER"
echo "   📝 Add comment: gh issue comment $ISSUE_NUMBER --body 'Your update'"
echo ""
echo -e "${PURPLE}📋 Project Board: $(jq -r '.project_url' project-info.json)${NC}"
echo ""
echo "🚀 Happy coding!"