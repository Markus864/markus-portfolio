#!/bin/bash
# Iron Strike Trading - Deployment Script
# This script updates the deployment log and prepares a local deployment workflow.
#
# Usage: ./deploy.sh "Description of changes"
# Example: ./deploy.sh "new version update"

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_LOG="${ROOT_DIR}/docs/DEPLOYMENT_LOG.md"

# Check if description was provided
if [ -z "${1:-}" ]; then
    echo -e "${RED}Error: Please provide a description of changes${NC}"
    echo "Usage: ./deploy.sh \"Description of changes\""
    exit 1
fi

DESCRIPTION="$1"
DATE=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
SHORT_COMMIT=$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "N/A")
BRANCH_NAME=$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

mkdir -p "$(dirname "$DEPLOY_LOG")"
touch "$DEPLOY_LOG"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Iron Strike Trading Deployment Log   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get the next deployment number
DEPLOY_NUM=$(grep -c "## Deployment #" "$DEPLOY_LOG" 2>/dev/null || echo "0")
DEPLOY_NUM=$((DEPLOY_NUM + 1))

echo -e "${YELLOW}Deployment #${DEPLOY_NUM}${NC}"
echo -e "Date: ${DATE}"
echo -e "Commit: ${SHORT_COMMIT}"
echo -e "Branch: ${BRANCH_NAME}"
echo -e "Description: ${DESCRIPTION}"
echo ""

# Get changed files since last commit if available
echo -e "${YELLOW}Getting changed files...${NC}"
if git -C "$ROOT_DIR" rev-parse HEAD~1 >/dev/null 2>&1; then
    CHANGED_LIST=$(git -C "$ROOT_DIR" diff --name-only HEAD~1..HEAD | head -20)
else
    CHANGED_LIST="Initial snapshot"
fi

echo -e "Files:\n${CHANGED_LIST}"
echo ""

DEPLOYMENT_ENTRY="
## Deployment #${DEPLOY_NUM} - ${DESCRIPTION}
**Date:** ${DATE}  
**Author:** Markus864  
**Commit:** \`${SHORT_COMMIT}\`  
**Branch:** \`${BRANCH_NAME}\`  
**Status:** Logged

### Notes
${DESCRIPTION}

### Files Changed
\`\`\`
${CHANGED_LIST}
\`\`\`

### Rollback Notes
Review git history and restore a known-good commit if needed.

---
"

if [ ! -s "$DEPLOY_LOG" ]; then
    cat > "$DEPLOY_LOG" <<'EOF'
# Deployment Log

This file tracks local deployment notes for portfolio documentation.

---
EOF
fi

TMP_FILE="$(mktemp)"
head -n 4 "$DEPLOY_LOG" > "$TMP_FILE"
printf "%b\n" "$DEPLOYMENT_ENTRY" >> "$TMP_FILE"
tail -n +5 "$DEPLOY_LOG" >> "$TMP_FILE"
mv "$TMP_FILE" "$DEPLOY_LOG"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment log updated successfully   ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Log file: $DEPLOY_LOG"
