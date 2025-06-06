#!/bin/bash

# GitHub Project Setup Script for Property Renderer Consolidation
# This script creates a GitHub Project with custom fields, views, and automation

set -e

echo "🚀 Setting up GitHub Project: Property Renderer Consolidation"

# Step 1: Create the project
echo "📋 Creating project..."
PROJECT_RESPONSE=$(gh api graphql -f query='
  mutation{
    createProjectV2(
      input: {
        ownerId: "U_kgDOCOLa3w",
        title: "Property Renderer Consolidation"
      }
    ){
      projectV2 {
        id
        url
        number
      }
     }
  }')

PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.data.createProjectV2.projectV2.id')
PROJECT_URL=$(echo $PROJECT_RESPONSE | jq -r '.data.createProjectV2.projectV2.url')
PROJECT_NUMBER=$(echo $PROJECT_RESPONSE | jq -r '.data.createProjectV2.projectV2.number')

echo "✅ Project created successfully!"
echo "   Project ID: $PROJECT_ID"
echo "   Project URL: $PROJECT_URL"
echo ""

# Step 2: Create custom fields
echo "🏷️  Creating custom fields..."

# Task Type field
echo "   Creating Task Type field..."
TASK_TYPE_RESPONSE=$(gh api graphql -f query='
  mutation {
    createProjectV2Field(input: {
      projectId: "'$PROJECT_ID'"
      dataType: SINGLE_SELECT
      name: "Task Type"
      singleSelectOptions: [
        {name: "🔍 Foundation", color: BLUE, description: "Analysis & Planning"},
        {name: "⚡ Enhancement", color: GREEN, description: "Building Capabilities"}, 
        {name: "🔄 Migration", color: ORANGE, description: "System Changes"},
        {name: "🧪 QA", color: PURPLE, description: "Testing & Validation"},
        {name: "📚 Documentation", color: GRAY, description: "Standards & Docs"}
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

TASK_TYPE_FIELD_ID=$(echo $TASK_TYPE_RESPONSE | jq -r '.data.createProjectV2Field.projectV2Field.id')
echo "   ✅ Task Type field created: $TASK_TYPE_FIELD_ID"

# Risk Level field  
echo "   Creating Risk Level field..."
RISK_LEVEL_RESPONSE=$(gh api graphql -f query='
  mutation {
    createProjectV2Field(input: {
      projectId: "'$PROJECT_ID'"
      dataType: SINGLE_SELECT
      name: "Risk Level"
      singleSelectOptions: [
        {name: "🚨 Critical", color: RED, description: "Revenue/booking impact"},
        {name: "🔴 High", color: ORANGE, description: "Core functionality"},
        {name: "🟡 Medium", color: YELLOW, description: "Developer experience"},
        {name: "🟢 Low", color: GREEN, description: "Nice to have"}
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

RISK_LEVEL_FIELD_ID=$(echo $RISK_LEVEL_RESPONSE | jq -r '.data.createProjectV2Field.projectV2Field.id')
echo "   ✅ Risk Level field created: $RISK_LEVEL_FIELD_ID"

# Effort field
echo "   Creating Effort field..."
EFFORT_RESPONSE=$(gh api graphql -f query='
  mutation {
    createProjectV2Field(input: {
      projectId: "'$PROJECT_ID'"
      dataType: SINGLE_SELECT
      name: "Effort"
      singleSelectOptions: [
        {name: "Small (1-2 days)", color: GREEN, description: "Quick tasks"},
        {name: "Medium (3-5 days)", color: YELLOW, description: "Standard tasks"},
        {name: "Large (1+ weeks)", color: RED, description: "Complex tasks"}
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

EFFORT_FIELD_ID=$(echo $EFFORT_RESPONSE | jq -r '.data.createProjectV2Field.projectV2Field.id')
echo "   ✅ Effort field created: $EFFORT_FIELD_ID"

# Dependencies field (text)
echo "   Creating Dependencies field..."
DEPENDENCIES_RESPONSE=$(gh api graphql -f query='
  mutation {
    createProjectV2Field(input: {
      projectId: "'$PROJECT_ID'"
      dataType: TEXT
      name: "Dependencies"
    }) {
      projectV2Field {
        ... on ProjectV2Field {
          id
          name
        }
      }
    }
  }')

DEPENDENCIES_FIELD_ID=$(echo $DEPENDENCIES_RESPONSE | jq -r '.data.createProjectV2Field.projectV2Field.id')
echo "   ✅ Dependencies field created: $DEPENDENCIES_FIELD_ID"

echo ""

# Step 3: Add all issues to the project
echo "📌 Adding issues to project..."

ISSUES=(39 40 41 42 43 44 45 46 47 48 49 50)

for issue_number in "${ISSUES[@]}"; do
    echo "   Adding issue #$issue_number..."
    
    # Get issue node ID
    ISSUE_RESPONSE=$(gh api graphql -f query='
      query {
        repository(owner: "b-coman", name: "prop-management") {
          issue(number: '$issue_number') {
            id
            title
          }
        }
      }')
    
    ISSUE_ID=$(echo $ISSUE_RESPONSE | jq -r '.data.repository.issue.id')
    ISSUE_TITLE=$(echo $ISSUE_RESPONSE | jq -r '.data.repository.issue.title')
    
    # Add issue to project
    ADD_RESPONSE=$(gh api graphql -f query='
      mutation {
        addProjectV2ItemById(input: {
          projectId: "'$PROJECT_ID'"
          contentId: "'$ISSUE_ID'"
        }) {
          item {
            id
          }
        }
      }')
    
    ITEM_ID=$(echo $ADD_RESPONSE | jq -r '.data.addProjectV2ItemById.item.id')
    echo "   ✅ Added #$issue_number: $ISSUE_TITLE (Item ID: $ITEM_ID)"
done

echo ""

# Step 4: Configure field values for each issue
echo "🎯 Configuring field values..."

# Get field option IDs
FIELDS_RESPONSE=$(gh api graphql -f query='
  query{
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

echo "   Field configuration data retrieved"

# Save project info for later use
cat > project-info.json << EOF
{
  "project_id": "$PROJECT_ID",
  "project_url": "$PROJECT_URL", 
  "project_number": $PROJECT_NUMBER,
  "task_type_field_id": "$TASK_TYPE_FIELD_ID",
  "risk_level_field_id": "$RISK_LEVEL_FIELD_ID",
  "effort_field_id": "$EFFORT_FIELD_ID",
  "dependencies_field_id": "$DEPENDENCIES_FIELD_ID"
}
EOF

echo ""
echo "🎉 GitHub Project setup completed successfully!"
echo ""
echo "📋 Project Details:"
echo "   URL: $PROJECT_URL"
echo "   Project ID: $PROJECT_ID"
echo ""
echo "🔧 Next Steps:"
echo "   1. Visit the project URL to see your configured project"
echo "   2. Run the field configuration script to set issue properties"
echo "   3. Set up project views and automation rules"
echo ""
echo "📁 Project configuration saved to: project-info.json"