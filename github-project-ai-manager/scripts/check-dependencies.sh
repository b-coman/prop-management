#!/bin/bash

# Check dependencies and suggest tasks that can be moved to Ready

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

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

print_header "Dependency Analysis"

echo -e "${BLUE}📊 Project ID: $PROJECT_ID${NC}"
echo ""

# Get all project items with their current status and dependencies
echo "🔍 Analyzing all project dependencies..."

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

# Parse project data
echo "$ALL_ITEMS" | jq -r '
  .data.node.items.nodes[] |
  select(.content.number != null) |
  select(.content.state == "OPEN") |
  {
    issue_number: .content.number,
    title: .content.title,
    status: (.fieldValues.nodes[] | select(.field.name == "Workflow Status") | .name // "No Status"),
    task_type: (.fieldValues.nodes[] | select(.field.name == "Task Type") | .name // "No Type"),
    dependencies: (.fieldValues.nodes[] | select(.field.name == "Dependencies") | .text // "No Dependencies")
  }
' > /tmp/all_project_tasks.json

echo "✅ Project data analyzed"
echo ""

# Show current status summary
TOTAL_TASKS=$(jq length /tmp/all_project_tasks.json)
DONE_TASKS=$(jq '[.[] | select(.status == "✅ Done")] | length' /tmp/all_project_tasks.json)
IN_PROGRESS_TASKS=$(jq '[.[] | select(.status == "🟡 In Progress")] | length' /tmp/all_project_tasks.json)
READY_TASKS=$(jq '[.[] | select(.status == "🔵 Ready")] | length' /tmp/all_project_tasks.json)
BLOCKED_TASKS=$(jq '[.[] | select(.status == "🔒 Blocked")] | length' /tmp/all_project_tasks.json)
TODO_TASKS=$(jq '[.[] | select(.status == "📋 Backlog" or .status == "No Status")] | length' /tmp/all_project_tasks.json)

print_header "📊 Current Status Overview"

echo "📋 Total Tasks: $TOTAL_TASKS"
echo -e "${GREEN}✅ Done: $DONE_TASKS${NC}"
echo -e "${YELLOW}🟡 In Progress: $IN_PROGRESS_TASKS${NC}"
echo -e "${BLUE}🔵 Ready: $READY_TASKS${NC}"
echo -e "${RED}🔒 Blocked: $BLOCKED_TASKS${NC}"
echo -e "${CYAN}📋 Todo/Backlog: $TODO_TASKS${NC}"
echo ""

# Analyze dependency chains
print_header "🔗 Dependency Analysis"

echo -e "${GREEN}✅ COMPLETED TASKS:${NC}"
jq -r '.[] | select(.status == "✅ Done") | "   #\(.issue_number) - \(.title | .[0:60])..."' /tmp/all_project_tasks.json
echo ""

echo -e "${YELLOW}🟡 IN PROGRESS TASKS:${NC}"
jq -r '.[] | select(.status == "🟡 In Progress") | "   #\(.issue_number) - \(.title | .[0:60])..."' /tmp/all_project_tasks.json
echo ""

echo -e "${BLUE}🔵 READY TASKS:${NC}"
jq -r '.[] | select(.status == "🔵 Ready") | "   #\(.issue_number) - \(.title | .[0:60])..."' /tmp/all_project_tasks.json
echo ""

echo -e "${CYAN}🔒 BLOCKED TASKS:${NC}"

# For each blocked task, analyze its dependencies
jq -r '.[] | select(.dependencies | contains("Blocked by")) | {issue_number, title, dependencies, status}' /tmp/all_project_tasks.json | jq -s '.[]' | while read -r task; do
    TASK_NUMBER=$(echo "$task" | jq -r '.issue_number')
    TASK_TITLE=$(echo "$task" | jq -r '.title')
    TASK_DEPS=$(echo "$task" | jq -r '.dependencies')
    TASK_STATUS=$(echo "$task" | jq -r '.status')
    
    echo "   #$TASK_NUMBER - ${TASK_TITLE:0:50}... (Status: $TASK_STATUS)"
    
    # Extract blocking issue numbers
    BLOCKING_ISSUES=$(echo "$TASK_DEPS" | grep -o '#[0-9]\+' | tr -d '#' | sort -u || true)
    
    if [ ! -z "$BLOCKING_ISSUES" ]; then
        ALL_COMPLETE=true
        INCOMPLETE_DEPS=""
        
        for blocking_issue in $BLOCKING_ISSUES; do
            # Check status of blocking issue
            BLOCKING_STATUS=$(jq -r '.[] | select(.issue_number == '$blocking_issue') | .status' /tmp/all_project_tasks.json)
            
            if [ "$BLOCKING_STATUS" = "null" ] || [ -z "$BLOCKING_STATUS" ]; then
                BLOCKING_STATUS="Unknown"
            fi
            
            if [ "$BLOCKING_STATUS" != "✅ Done" ]; then
                ALL_COMPLETE=false
                INCOMPLETE_DEPS="$INCOMPLETE_DEPS #$blocking_issue($BLOCKING_STATUS)"
            fi
        done
        
        if [ "$ALL_COMPLETE" = true ]; then
            echo -e "      ${GREEN}🔓 READY TO UNBLOCK! All dependencies complete${NC}"
        else
            echo -e "      ${RED}🔒 Waiting for:$INCOMPLETE_DEPS${NC}"
        fi
    fi
    
    echo ""
done

# Show tasks that can be moved to Ready
print_header "🚀 Actionable Items"

echo "🔍 Tasks ready to move to 'Ready' status:"
echo ""

READY_TO_UNBLOCK=0

jq -r '.[] | select(.dependencies | contains("Blocked by")) | select(.status != "🔵 Ready" and .status != "🟡 In Progress" and .status != "✅ Done") | {issue_number, title, dependencies}' /tmp/all_project_tasks.json | jq -s '.[]' | while read -r task; do
    TASK_NUMBER=$(echo "$task" | jq -r '.issue_number')
    TASK_TITLE=$(echo "$task" | jq -r '.title')
    TASK_DEPS=$(echo "$task" | jq -r '.dependencies')
    
    # Extract blocking issue numbers
    BLOCKING_ISSUES=$(echo "$TASK_DEPS" | grep -o '#[0-9]\+' | tr -d '#' | sort -u || true)
    
    if [ ! -z "$BLOCKING_ISSUES" ]; then
        ALL_COMPLETE=true
        
        for blocking_issue in $BLOCKING_ISSUES; do
            BLOCKING_STATUS=$(jq -r '.[] | select(.issue_number == '$blocking_issue') | .status' /tmp/all_project_tasks.json)
            
            if [ "$BLOCKING_STATUS" != "✅ Done" ]; then
                ALL_COMPLETE=false
                break
            fi
        done
        
        if [ "$ALL_COMPLETE" = true ]; then
            echo -e "${GREEN}✅ #$TASK_NUMBER - ${TASK_TITLE:0:60}...${NC}"
            echo "   Command: ./move-to-ready.sh $TASK_NUMBER"
            echo ""
            READY_TO_UNBLOCK=$((READY_TO_UNBLOCK + 1))
        fi
    fi
done

if [ "$READY_TO_UNBLOCK" -eq 0 ]; then
    echo -e "${CYAN}ℹ️  No tasks ready to unblock at this time${NC}"
    echo ""
fi

# Show next steps
print_header "🔧 Recommended Actions"

if [ "$READY_TASKS" -gt 0 ]; then
    echo -e "${BLUE}🚀 Start working on ready tasks:${NC}"
    jq -r '.[] | select(.status == "🔵 Ready") | "   ./start-task.sh \(.issue_number) - \(.title | .[0:50])..."' /tmp/all_project_tasks.json
    echo ""
fi

if [ "$IN_PROGRESS_TASKS" -gt 0 ]; then
    echo -e "${YELLOW}⏳ Complete in-progress tasks:${NC}"
    jq -r '.[] | select(.status == "🟡 In Progress") | "   ./complete-task.sh \(.issue_number) - \(.title | .[0:50])..."' /tmp/all_project_tasks.json
    echo ""
fi

if [ "$READY_TO_UNBLOCK" -gt 0 ]; then
    echo -e "${GREEN}🔓 Unblock ready tasks:${NC}"
    echo "   Run the move-to-ready.sh commands shown above"
    echo ""
fi

echo -e "${PURPLE}📊 Monitor progress:${NC}"
echo "   ./query-project-status.sh - Full project dashboard"
echo "   $(jq -r '.project_url' project-info.json) - GitHub project board"
echo ""

# Cleanup
rm -f /tmp/all_project_tasks.json