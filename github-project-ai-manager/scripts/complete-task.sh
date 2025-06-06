#!/bin/bash

# Complete a task by moving it to "Done" status and checking dependent tasks

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

if [ $# -eq 0 ]; then
    echo "❌ Usage: $0 <issue_number> [completion_comment]"
    echo "   Example: $0 39"
    echo "   Example: $0 39 'Data transformation utilities implemented and tested'"
    exit 1
fi

ISSUE_NUMBER=$1
COMPLETION_COMMENT=${2:-"Task completed via automation"}

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

print_header "Completing Task #$ISSUE_NUMBER"

echo -e "${BLUE}📊 Project ID: $PROJECT_ID${NC}"
echo ""

# Get issue details
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

echo -e "${GREEN}✅ Issue found: $ISSUE_TITLE${NC}"

# Get project item details
ITEM_ID=$(echo "$ISSUE_DATA" | jq -r '.data.repository.issue.projectItems.nodes[] | select(.project.id == "'$PROJECT_ID'") | .id')
CURRENT_STATUS=$(echo "$ISSUE_DATA" | jq -r '.data.repository.issue.projectItems.nodes[] | select(.project.id == "'$PROJECT_ID'") | .fieldValues.nodes[] | select(.field.name == "Status") | .name // "No Status"')

if [ "$ITEM_ID" = "null" ] || [ -z "$ITEM_ID" ]; then
    echo -e "${RED}❌ Issue #$ISSUE_NUMBER not found in project${NC}"
    exit 1
fi

echo "📋 Current Status: $CURRENT_STATUS"
echo ""

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
DONE_OPTION_ID=$(echo "$FIELDS_DATA" | jq -r '.data.node.fields.nodes[] | select(.name == "Status") | .options[] | select(.name == "Done") | .id')

if [ "$STATUS_FIELD_ID" = "null" ] || [ "$DONE_OPTION_ID" = "null" ]; then
    echo -e "${RED}❌ Status field or 'Done' option not found${NC}"
    echo "Available status options:"
    echo "$FIELDS_DATA" | jq -r '.data.node.fields.nodes[] | select(.name == "Status") | .options[] | "   - \(.name)"'
    exit 1
fi

# Move to Done
echo -e "${GREEN}✅ Moving issue #$ISSUE_NUMBER to 'Done'...${NC}"

# Update native Status field
UPDATE_RESULT=$(gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: "'$PROJECT_ID'"
        itemId: "'$ITEM_ID'"
        fieldId: "'$STATUS_FIELD_ID'"
        value: {
          singleSelectOptionId: "'$DONE_OPTION_ID'"
        }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }')

if echo "$UPDATE_RESULT" | jq -e '.data.updateProjectV2ItemFieldValue.projectV2Item.id' > /dev/null; then
    echo -e "${GREEN}✅ Successfully moved #$ISSUE_NUMBER to 'Done' (native status)${NC}"
else
    echo -e "${RED}❌ Failed to update issue status${NC}"
    echo "Error: $UPDATE_RESULT"
    exit 1
fi

# Also update Workflow Status field if it exists
if [ -f "project-info.json" ] && jq -e '.workflow_status_field_id' project-info.json > /dev/null; then
    WORKFLOW_STATUS_FIELD_ID=$(jq -r '.workflow_status_field_id' project-info.json)
    WORKFLOW_DONE_OPTION_ID=$(jq -r '.done_option_id' project-info.json)
    
    echo -e "${YELLOW}🔄 Syncing workflow status field...${NC}"
    gh api graphql -f query='
      mutation {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: "'$PROJECT_ID'"
            itemId: "'$ITEM_ID'"
            fieldId: "'$WORKFLOW_STATUS_FIELD_ID'"
            value: {
              singleSelectOptionId: "'$WORKFLOW_DONE_OPTION_ID'"
            }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }' > /dev/null
    echo -e "${GREEN}✅ Both status fields synced to 'Done'${NC}"
fi

# Add completion comment to issue
echo "💬 Adding completion comment..."
gh issue comment $ISSUE_NUMBER --body "✅ **Task Completed**

$COMPLETION_COMMENT

**Completion Details:**
- Status: Moved to Done
- Completed: $(date '+%Y-%m-%d %H:%M:%S')
- Automation: Project management script

🔄 Checking for dependent tasks that can now be unblocked..." || echo "⚠️ Could not add comment"

echo ""

# Check for dependent tasks that can now be unblocked
echo "🔍 Checking for dependent tasks..."

# Get all project items and check their dependencies
ALL_ITEMS=$(gh api graphql -f query='
  query {
    node(id: "'$PROJECT_ID'") {
      ... on ProjectV2 {
        items(first: 50) {
          nodes {
            id
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
            content {
              ... on Issue {
                number
                title
                state
              }
            }
          }
        }
      }
    }
  }')

echo "$ALL_ITEMS" | jq -r '
  .data.node.items.nodes[] |
  select(.content.number != null) |
  select(.content.state == "OPEN") |
  {
    issue_number: .content.number,
    title: .content.title,
    status: (.fieldValues.nodes[] | select(.field.name == "Status") | .name // "No Status"),
    dependencies: (.fieldValues.nodes[] | select(.field.name == "Dependencies") | .text // "")
  } |
  select(.dependencies | contains("#'$ISSUE_NUMBER'"))
' > /tmp/dependent_tasks.json

DEPENDENT_COUNT=$(jq length /tmp/dependent_tasks.json)

if [ "$DEPENDENT_COUNT" -gt 0 ]; then
    echo -e "${CYAN}🔓 Found $DEPENDENT_COUNT dependent tasks:${NC}"
    echo ""
    
    jq -r 'to_entries[] | "   #\(.value.issue_number) - \(.value.title | .[0:60])... (Status: \(.value.status))"' /tmp/dependent_tasks.json
    
    echo ""
    echo -e "${YELLOW}🔄 Checking if dependent tasks can be unblocked...${NC}"
    
    # For each dependent task, check if all its dependencies are now complete
    jq -r '.[].issue_number' /tmp/dependent_tasks.json | while read dependent_issue; do
        echo "   Checking #$dependent_issue dependencies..."
        
        # Get dependencies for this task
        TASK_DEPS=$(jq -r '.[] | select(.issue_number == '$dependent_issue') | .dependencies' /tmp/dependent_tasks.json)
        
        # Extract all blocking issue numbers
        BLOCKING_ISSUES=$(echo "$TASK_DEPS" | grep -o '#[0-9]\+' | tr -d '#' | sort -u || true)
        
        if [ ! -z "$BLOCKING_ISSUES" ]; then
            ALL_COMPLETE=true
            
            for blocking_issue in $BLOCKING_ISSUES; do
                # Check if this blocking issue is complete
                BLOCKING_STATUS=$(echo "$ALL_ITEMS" | jq -r '.data.node.items.nodes[] | select(.content.number == '$blocking_issue') | .fieldValues.nodes[] | select(.field.name == "Status") | .name // "Unknown"')
                
                if [ "$BLOCKING_STATUS" != "Done" ]; then
                    ALL_COMPLETE=false
                    break
                fi
            done
            
            if [ "$ALL_COMPLETE" = true ]; then
                echo -e "   ${GREEN}✅ #$dependent_issue is ready to move to 'Ready' status!${NC}"
                echo "      Run: ./move-to-ready.sh $dependent_issue"
            else
                echo -e "   ${YELLOW}⏳ #$dependent_issue still has incomplete dependencies${NC}"
            fi
        fi
    done
else
    echo -e "${CYAN}ℹ️  No dependent tasks found for #$ISSUE_NUMBER${NC}"
fi

print_header "🎉 Task #$ISSUE_NUMBER Completed!"

echo -e "${GREEN}📋 Issue: $ISSUE_TITLE${NC}"
echo -e "${GREEN}✅ Status: Done${NC}"
echo -e "${CYAN}💬 Comment: $COMPLETION_COMMENT${NC}"
echo ""

if [ "$DEPENDENT_COUNT" -gt 0 ]; then
    echo -e "${BLUE}🔧 Next Actions:${NC}"
    echo "   📊 Check status: ./query-project-status.sh"
    echo "   🔓 Check dependencies: ./check-dependencies.sh"
    echo "   🔵 Move ready tasks: ./move-to-ready.sh [issue_number]"
else
    echo -e "${BLUE}🔧 Next Actions:${NC}"
    echo "   📊 Check status: ./query-project-status.sh"
    echo "   🚀 Start next task: ./start-task.sh [issue_number]"
fi

echo ""
echo -e "${PURPLE}📋 Project Board: $(jq -r '.project_url' project-info.json)${NC}"
echo ""
echo "🎊 Great work on completing this task!"

# Cleanup
rm -f /tmp/dependent_tasks.json