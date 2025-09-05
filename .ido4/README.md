# ido4 Project Infrastructure

This directory contains ido4 project management configuration.

## About This Directory

This directory contains configuration files that connect your project to ido4's project management capabilities.
These files enable ido4 commands to interact with your GitHub Project board and manage workflow automation.

## Files

**`project-info.json`** - GitHub Project configuration including field IDs, status mappings, and workflow rules

## Important Notes

These files are automatically managed by ido4 commands
**Do not edit manually** - use `ido4` commands instead to ensure consistency
Configuration is synchronized with your GitHub Project board
Changes made through ido4 commands will update these files automatically

## Common Commands

`ido4 project:init` - Initialize project configuration
`ido4 task:start <issue>` - Start working on a task
`ido4 task:complete <issue>` - Mark task as complete
`ido4 wave:status` - Check current wave progress

## Learn More

[ido4 Documentation](https://docs.ido4.dev)
[Project Management Guide](https://docs.ido4.dev/project-management)
[Wave-Based Development](https://docs.ido4.dev/waves)