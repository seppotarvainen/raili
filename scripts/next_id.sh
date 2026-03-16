#!/usr/bin/env bash
set -euo pipefail

ISSUES_DIR=".issues"

# Find files under .issues and extract numeric suffix from filenames like RAI-<num>-...
if [ -d "$ISSUES_DIR" ]; then
  files=$(find "$ISSUES_DIR" -type f -exec basename {} \; 2>/dev/null) || true
else
  files=""
fi

max=0
if [ -n "$files" ]; then
  while IFS= read -r fname; do
    if [[ $fname =~ ^RAI-([0-9]+) ]]; then
      n="${BASH_REMATCH[1]}"
      # remove leading zeros
      n="$(echo "$n" | sed 's/^0*//')"
      n=${n:-0}
      if [ "$n" -gt "$max" ]; then
        max=$n
      fi
    fi
  done <<< "$files"
fi

next=$((max+1))
new_id="RAI-${next}"

export "RAILI_VAR_ID=${new_id}"

# Print the exported variable in Raili's expected format (name=value on stdout)
echo "id=${new_id}"
# Also print a human-friendly message to stderr for logs
echo "Next id: ${new_id}" >&2

exit 0
