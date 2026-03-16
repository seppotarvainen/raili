#!/usr/bin/env bash
set -euo pipefail

# Move a ticket file whose name starts with $RAILI_VAR_ID
# Usage: move_ticket.sh <from> <to>
# Possible values for from/to: todo, doing, done

TODO_DIR=".issues/1_todo"
DOING_DIR=".issues/2_doing"
DONE_DIR=".issues/3_done"

: "${RAILI_VAR_ID:?Environment variable RAILI_VAR_ID must be set and non-empty}"

if [ $# -ne 2 ]; then
  echo "Usage: move_ticket.sh <from> <to>" >&2
  echo "Possible values: todo, doing, done" >&2
  exit 1
fi

resolve_dir() {
  case "$1" in
    todo)  echo "$TODO_DIR" ;;
    doing) echo "$DOING_DIR" ;;
    done)  echo "$DONE_DIR" ;;
    *)
      echo "Invalid directory name '$1'. Must be one of: todo, doing, done" >&2
      exit 1
      ;;
  esac
}

FROM_DIR=$(resolve_dir "$1")
TO_DIR=$(resolve_dir "$2")

# Allow pattern expansion but detect zero matches
shopt -s nullglob
matches=("$FROM_DIR"/"$RAILI_VAR_ID"*)
shopt -u nullglob

if [ "${#matches[@]}" -eq 0 ]; then
  echo "No file starting with '$RAILI_VAR_ID' found in $FROM_DIR" >&2
  exit 2
fi

if [ "${#matches[@]}" -gt 1 ]; then
  echo "Multiple files match '$RAILI_VAR_ID' in $FROM_DIR:" >&2
  for f in "${matches[@]}"; do
    echo "  $f" >&2
  done
  exit 3
fi

src="${matches[0]}"
mkdir -p -- "$TO_DIR"
dest="$TO_DIR/$(basename "$src")"

mv -- "$src" "$dest"

echo "Moved '$src' -> '$dest'"

exit 0
