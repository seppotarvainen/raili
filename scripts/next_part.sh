#!/usr/bin/env bash
set -euo pipefail

# Find the next (lowest-numbered) part file for the current ticket in .issues/1_todo/
# Outputs: next_part=pt<N>
# Exit 0 if found, exit 1 if none

: "${RAILI_VAR_ID:?RAILI_VAR_ID must be set}"

TODO_DIR=".issues/1_todo"

shopt -s nullglob
matches=("$TODO_DIR"/"$RAILI_VAR_ID"-pt*.md)
shopt -u nullglob

if [ "${#matches[@]}" -eq 0 ]; then
  echo "No remaining parts for $RAILI_VAR_ID"
  exit 1
fi

# Sort by part number (numeric) to find the lowest
lowest=""
lowest_num=999999

for f in "${matches[@]}"; do
  bn=$(basename "$f" .md)
  # Extract the number after the last '-pt'
  num="${bn##*-pt}"
  if [ "$num" -lt "$lowest_num" ] 2>/dev/null; then
    lowest_num=$num
    lowest=$f
  fi
done

if [ -z "$lowest" ]; then
  echo "No valid part files found"
  exit 1
fi

# Extract the suffix (e.g., "pt1") from the filename
suffix=$(basename "$lowest" .md)
suffix="${suffix#"${RAILI_VAR_ID}"-}"

echo "next_part=$suffix"
exit 0

