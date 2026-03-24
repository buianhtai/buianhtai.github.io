#!/bin/bash
set -eo pipefail

cd /Users/BuiAnhTai/GitHub/Blogs

echo "Validating frontmatter..."
npm run blog:validate
echo ""

echo "Building..."
npx astro build 2>&1 | tail -5
EXIT=$?
if [ $EXIT -eq 0 ]; then
  echo "✅ Build passed"
else
  echo "❌ Build failed with exit code $EXIT"
fi
exit $EXIT