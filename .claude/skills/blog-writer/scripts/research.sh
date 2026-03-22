#!/bin/bash
REPO=$1

if [ -z "$REPO" ]; then
  echo "Usage: bash research.sh owner/repo"
  exit 1
fi

echo "=== README ==="
gh api repos/$REPO/readme -q .content 2>/dev/null | base64 -d

echo "=== STRUCTURE ==="
gh api repos/$REPO/git/trees/HEAD?recursive=1 -q '.tree[] | select(.type=="blob") | .path' 2>/dev/null | head -50

echo "=== LANGUAGES ==="
gh api repos/$REPO/languages 2>/dev/null

echo "=== STATS ==="
gh api repos/$REPO -q '{stars: .stargazers_count, license: .license.spdx_id, language: .language, description: .description}' 2>/dev/null
