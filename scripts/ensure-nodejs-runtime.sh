#!/bin/bash

# Script to ensure Node.js runtime is used for all admin routes
# This script adds "export const runtime = 'nodejs';" to all admin page and layout files

echo "🔧 Ensuring Node.js runtime for all admin routes..."

# Find all page.tsx and layout.tsx files in the admin directory
FILES=$(find ./src/app/admin -name "page.tsx" -o -name "layout.tsx")

# Add runtime declaration to each file if it's missing
for FILE in $FILES
do
  # Check if the file already has a runtime declaration
  if ! grep -q "export const runtime = 'nodejs'" "$FILE"; then
    echo "📝 Adding Node.js runtime to $FILE"
    # Add after the first line that's not a comment
    sed -i '' '1,/^[^\/]/ s/^[^\/].*$/&\n\n\/\/ Force Node.js runtime\nexport const runtime = "nodejs";/' "$FILE"
  else
    echo "✅ $FILE already has Node.js runtime declaration"
  fi
done

echo "✨ Done! All admin routes now use Node.js runtime"