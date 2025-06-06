#!/bin/bash

# Master Setup Script for Property Renderer Consolidation GitHub Project
# This script orchestrates the complete project setup process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Functions for colored output
print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

print_header "GitHub Project Setup for Property Renderer Consolidation"

print_info "This script will:"
print_info "  1. Verify GitHub CLI authentication and permissions"
print_info "  2. Create the GitHub Project with custom fields"
print_info "  3. Add all issues to the project"
print_info "  4. Configure field values and dependencies"
print_info "  5. Provide manual setup instructions for views and automation"
echo ""

# Step 1: Check prerequisites
print_step "Checking prerequisites..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed. Please install it first:"
    print_info "  Visit: https://cli.github.com/"
    exit 1
fi

print_success "GitHub CLI found: $(gh --version | head -n1)"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    print_error "jq is not installed. Please install it first:"
    print_info "  macOS: brew install jq"
    print_info "  Ubuntu: sudo apt-get install jq"
    exit 1
fi

print_success "jq found: $(jq --version)"

# Check GitHub authentication
print_step "Checking GitHub authentication..."

if ! gh auth status &> /dev/null; then
    print_error "GitHub CLI is not authenticated. Please run:"
    print_info "  gh auth login"
    exit 1
fi

print_success "GitHub CLI is authenticated"

# Check for project permissions
print_step "Checking GitHub permissions..."

# Try a simple GraphQL query to test permissions
PERM_TEST=$(gh api graphql -f query='query { viewer { login } }' 2>&1) || {
    print_error "GitHub API access failed. Please check your authentication."
    exit 1
}

# Test project permissions by trying to list projects
PROJECT_PERM_TEST=$(gh api graphql -f query='query { viewer { projectsV2(first: 1) { totalCount } } }' 2>/dev/null) || {
    print_warning "Project permissions not available. Attempting to refresh..."
    print_info "You may need to authenticate with project permissions:"
    print_info "  gh auth refresh -s project,read:project --hostname github.com"
    print_info ""
    read -p "Have you authenticated with project permissions? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Please run the auth refresh command above and try again."
        exit 1
    fi
}

print_success "GitHub permissions verified"
echo ""

# Step 2: Check if scripts exist
print_step "Verifying setup scripts..."

SETUP_SCRIPT="$SCRIPT_DIR/setup-github-project.sh"
CONFIG_SCRIPT="$SCRIPT_DIR/configure-project-fields.sh"

if [ ! -f "$SETUP_SCRIPT" ]; then
    print_error "Setup script not found: $SETUP_SCRIPT"
    exit 1
fi

if [ ! -f "$CONFIG_SCRIPT" ]; then
    print_error "Configuration script not found: $CONFIG_SCRIPT"
    exit 1
fi

# Make scripts executable
chmod +x "$SETUP_SCRIPT"
chmod +x "$CONFIG_SCRIPT"

print_success "Setup scripts found and executable"
echo ""

# Step 3: Check if project already exists
print_step "Checking for existing project..."

if [ -f "$SCRIPT_DIR/project-info.json" ]; then
    print_warning "project-info.json already exists. Project may already be set up."
    print_info "Contents:"
    cat "$SCRIPT_DIR/project-info.json" | jq '.'
    echo ""
    read -p "Do you want to continue and potentially recreate the project? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Exiting. Remove project-info.json if you want to start fresh."
        exit 0
    fi
    rm -f "$SCRIPT_DIR/project-info.json"
fi

# Step 4: Run the setup script
print_step "Running GitHub Project setup..."
echo ""

cd "$SCRIPT_DIR"

if ! bash "$SETUP_SCRIPT"; then
    print_error "Project setup failed. Check the output above for details."
    exit 1
fi

echo ""
print_success "Project setup completed successfully!"
echo ""

# Step 5: Run the configuration script
print_step "Configuring project fields and dependencies..."
echo ""

if ! bash "$CONFIG_SCRIPT"; then
    print_error "Project configuration failed. Check the output above for details."
    print_warning "The project was created but field configuration failed."
    print_info "You can manually configure fields or fix issues and re-run:"
    print_info "  ./scripts/configure-project-fields.sh"
    exit 1
fi

echo ""
print_success "Project configuration completed successfully!"
echo ""

# Step 6: Display final information and next steps
if [ -f "$SCRIPT_DIR/project-info.json" ]; then
    PROJECT_URL=$(jq -r '.project_url' "$SCRIPT_DIR/project-info.json")
    PROJECT_ID=$(jq -r '.project_id' "$SCRIPT_DIR/project-info.json")
    
    print_header "Setup Complete! 🎉"
    
    print_success "GitHub Project successfully created and configured!"
    echo ""
    print_info "📊 Project Details:"
    print_info "   URL: $PROJECT_URL"
    print_info "   Project ID: $PROJECT_ID"
    print_info "   Issues Added: 12 (Foundation → Enhancement → Migration → QA → Documentation)"
    print_info "   Custom Fields: Task Type, Risk Level, Effort, Dependencies"
    print_info "   Dependencies: Mapped with blocking relationships"
    echo ""
    
    print_step "Manual Setup Steps (do these in GitHub web interface):"
    echo ""
    print_info "1. 📋 Create Custom Views:"
    print_info "   • Board View: Backlog → Ready → In Progress → Review → Done"
    print_info "   • Timeline View: Gantt-style dependency tracking"
    print_info "   • Priority Matrix: Risk Level vs Effort"
    print_info "   • Dependency View: Table showing blocking relationships"
    echo ""
    
    print_info "2. ⚙️  Set Up Automation (Project Settings → Workflows):"
    print_info "   • Auto-move to 'In Progress' when issue assigned"
    print_info "   • Auto-move to 'Review' when PR created"
    print_info "   • Auto-move to 'Done' when issue closed"
    echo ""
    
    print_info "3. 🎯 Set Issue Priorities:"
    print_info "   • Review Risk Level assignments (Critical items first)"
    print_info "   • Validate Effort estimates"
    print_info "   • Confirm dependency relationships"
    echo ""
    
    print_step "Ready to Start Development:"
    print_info "✅ Foundation tasks (#39, #40, #41) are ready to begin"
    print_info "🔒 Enhancement tasks blocked until foundation complete"
    print_info "🔒 Migration task (#45) blocked until enhancements ready"
    print_info "📊 All dependencies mapped for proper sequencing"
    echo ""
    
    print_header "Next: Visit Your Project!"
    print_info "🌐 Open: $PROJECT_URL"
    print_info "📚 Documentation: /docs/guides/architectural-migration-methodology.md"
    print_info "🎯 Milestone: Property Renderer Consolidation (Due: Jan 15, 2025)"
    
else
    print_error "project-info.json not found. Setup may have failed."
    exit 1
fi

echo ""
print_success "🚀 Ready to consolidate those property page renderers!"