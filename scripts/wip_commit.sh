#!/bin/bash
# Creates a WIP commit with timestamp

TICKET_ID="${RAILI_VAR_ID}"
TIMESTAMP=$(date '+%d.%m %H:%M')
MESSAGE="WIP: ${TICKET_ID}, attempt ${TIMESTAMP}"

git add -A
git commit -m "$MESSAGE"
