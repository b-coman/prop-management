#!/bin/bash

# Query current project status - comprehensive project dashboard

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

print_status() {
    case $1 in
        "Todo"|"Backlog") echo -e "${CYAN}📋 $1${NC}" ;;
        "Ready") echo -e "${BLUE}🔵 $1${NC}" ;;
        "In Progress") echo -e "${YELLOW}🟡 $1${NC}" ;;
        "Review") echo -e "${PURPLE}🟣 $1${NC}" ;;
        "Done") echo -e "${GREEN}✅ $1${NC}" ;;
        *) echo -e "${CYAN}$1${NC}" ;;
    esac
}

# Load project info
if [ ! -f "project-info.json" ]; then
    echo "❌ project-info.json not found. Run setup-github-project.sh first."
    exit 1
fi

PROJECT_ID=$(jq -r '.project_id' project-info.json)
PROJECT_URL=$(jq -r '.project_url' project-info.json)

print_header "Property Renderer Consolidation - Project Status"

echo -e "${CYAN}📊 Project: $PROJECT_URL${NC}"
echo -e "${CYAN}🆔 Project ID: $PROJECT_ID${NC}"
echo ""

# Query all project items with their field values
echo "🔍 Querying project status..."

PROJECT_DATA=$(gh api graphql -f query='
  query {
    node(id: "'$PROJECT_ID'") {
      ... on ProjectV2 {
        title
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
                assignees(first: 5) {
                  nodes {
                    login
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

# Parse and display project status
echo "$PROJECT_DATA" | jq -r '
  .data.node.items.nodes[] |
  select(.content.number != null) |
  {
    issue_number: .content.number,
    title: .content.title,
    state: .content.state,
    assignees: [.content.assignees.nodes[].login],
    status: (.fieldValues.nodes[] | select(.field.name == "Status") | .name // "No Status"),
    task_type: (.fieldValues.nodes[] | select(.field.name == "Task Type") | .name // "No Type"),
    risk_level: (.fieldValues.nodes[] | select(.field.name == "Risk Level") | .name // "No Risk"),
    effort: (.fieldValues.nodes[] | select(.field.name == "Effort") | .name // "No Effort"),
    dependencies: (.fieldValues.nodes[] | select(.field.name == "Dependencies") | .text // "No Dependencies")
  }
' > /tmp/project_status.json

# Display organized status report
print_header "📋 Current Project Status"

# Group by task type and show status
echo -e "${BLUE}🔍 FOUNDATION TASKS${NC}"
jq -r 'select(.task_type | contains("Foundation")) | 
  "#\(.issue_number) - \(.title | .[0:60])... - Status: \(.status) - Risk: \(.risk_level)"' /tmp/project_status.json | while read line; do
    echo "   $line"
done
echo ""

echo -e "${GREEN}⚡ ENHANCEMENT TASKS${NC}"
jq -r 'select(.task_type | contains("Enhancement")) | 
  "#\(.issue_number) - \(.title | .[0:60])... - Status: \(.status) - Risk: \(.risk_level)"' /tmp/project_status.json | while read line; do
    echo "   $line"
done
echo ""

echo -e "${ORANGE}🔄 MIGRATION TASKS${NC}"
jq -r 'select(.task_type | contains("Migration")) | 
  "#\(.issue_number) - \(.title | .[0:60])... - Status: \(.status) - Risk: \(.risk_level)"' /tmp/project_status.json | while read line; do
    echo "   $line"
done
echo ""

echo -e "${PURPLE}🧪 QA TASKS${NC}"
jq -r 'select(.task_type | contains("QA")) | 
  "#\(.issue_number) - \(.title | .[0:60])... - Status: \(.status) - Risk: \(.risk_level)"' /tmp/project_status.json | while read line; do
    echo "   $line"
done
echo ""

echo -e "${CYAN}📚 DOCUMENTATION TASKS${NC}"
jq -r 'select(.task_type | contains("Documentation")) | 
  "#\(.issue_number) - \(.title | .[0:60])... - Status: \(.status) - Risk: \(.risk_level)"' /tmp/project_status.json | while read line; do
    echo "   $line"
done
echo ""

# Status summary
print_header "📊 Status Summary"

TOTAL_ISSUES=$(jq length /tmp/project_status.json)
TODO_COUNT=$(jq '[.[] | select(.status == "Todo" or .status == "No Status")] | length' /tmp/project_status.json)
READY_COUNT=$(jq '[.[] | select(.status == "Ready")] | length' /tmp/project_status.json)
IN_PROGRESS_COUNT=$(jq '[.[] | select(.status == "In Progress")] | length' /tmp/project_status.json)
REVIEW_COUNT=$(jq '[.[] | select(.status == "Review")] | length' /tmp/project_status.json)
DONE_COUNT=$(jq '[.[] | select(.status == "Done")] | length' /tmp/project_status.json)

echo "📊 Total Issues: $TOTAL_ISSUES"
echo "📋 Todo/Backlog: $TODO_COUNT"
echo "🔵 Ready: $READY_COUNT"
echo "🟡 In Progress: $IN_PROGRESS_COUNT"
echo "🟣 Review: $REVIEW_COUNT"
echo "✅ Done: $DONE_COUNT"
echo ""

# Progress percentage
COMPLETED_WORK=$((DONE_COUNT))
PROGRESS_PCT=$(( (COMPLETED_WORK * 100) / TOTAL_ISSUES ))
echo "📈 Progress: $PROGRESS_PCT% complete ($DONE_COUNT/$TOTAL_ISSUES tasks)"
echo ""

# Dependency analysis
print_header "🔗 Dependency Analysis"

echo "🔍 Foundation Tasks (Ready to Start):"
jq -r 'select(.dependencies == "None (foundation task)" or (.dependencies | contains("None"))) | 
  "   #\(.issue_number) - \(.title | .[0:50])... (\(.status))"' /tmp/project_status.json

echo ""
echo "🔒 Blocked Tasks:"
jq -r 'select(.dependencies | contains("Blocked by")) | 
  "   #\(.issue_number) - \(.dependencies) (\(.status))"' /tmp/project_status.json

echo ""

# Recommendations
print_header "🎯 Recommendations"

if [ "$READY_COUNT" -eq 0 ] && [ "$TODO_COUNT" -gt 0 ]; then
    echo "🚀 Action Needed: Move foundation tasks (#39, #40, #41) to 'Ready' status"
    echo "   Run: ./move-foundation-tasks-ready.sh"
fi

if [ "$IN_PROGRESS_COUNT" -eq 0 ] && [ "$READY_COUNT" -gt 0 ]; then
    echo "🔥 Ready to Start: Foundation tasks are ready for development"
    echo "   Run: ./start-task.sh [issue_number]"
fi

if [ "$DONE_COUNT" -gt 0 ]; then
    echo "✅ Progress: $DONE_COUNT tasks completed - check for unblocked dependent tasks"
    echo "   Run: ./check-dependencies.sh"
fi

echo ""
print_header "🛠️ Available Commands"
echo "   📊 ./query-project-status.sh - This status report"
echo "   🔵 ./move-foundation-tasks-ready.sh - Move foundation tasks to ready"
echo "   🚀 ./start-task.sh [issue] - Move task to in progress"
echo "   ✅ ./complete-task.sh [issue] - Move task to done"
echo "   🔗 ./check-dependencies.sh - Analyze dependency readiness"
echo "   📋 ./update-project-field.sh [issue] [field] [value] - Update custom fields"

# Cleanup
rm -f /tmp/project_status.json