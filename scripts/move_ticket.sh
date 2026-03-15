#!/usr/bin/env bash
set -euo pipefail

# Move a ticket file whose name starts with $RAILI_VAR_ID
# From: .issues/1_todo
# To:   .issues/2_doing

TODO_DIR=".issues/1_todo"
DOING_DIR=".issues/2_doing"
DONE_DIR=".issues/3_done"

: "${RAILI_VAR_ID:?Environment variable RAILI_VAR_ID must be set and non-empty}" 

# Allow pattern expansion but detect zero matches
shopt -s nullglob
matches=("$TODO_DIR"/"$RAILI_VAR_ID"*)
shopt -u nullglob

if [ "${#matches[@]}" -eq 0 ]; then
  echo "No file starting with '$RAILI_VAR_ID' found in $TODO_DIR" >&2
  exit 2
fi

if [ "${#matches[@]}" -gt 1 ]; then
  echo "Multiple files match '$RAILI_VAR_ID' in $TODO_DIR:" >&2
  for f in "${matches[@]}"; do
    echo "  $f" >&2
  done
  exit 3
fi

src="${matches[0]}"
mkdir -p -- "$DOING_DIR"
dest="$DOING_DIR/$(basename "$src")"

mv -- "$src" "$dest"

echo "Moved '$src' -> '$dest'"

exit 0
