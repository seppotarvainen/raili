#!/usr/bin/env bash
set -euo pipefail

# Move a ticket file whose name starts with $RAILI_VAR_ID
# Usage: move_ticket.sh <from> <to> [suffix]
# Possible values for from/to: todo, doing, done
# If suffix is provided (e.g., "pt1"), matches $RAILI_VAR_ID-<suffix>*
# If suffix is omitted, matches $RAILI_VAR_ID* excluding part files (-pt<N>)

TODO_DIR=".issues/1_todo"
DOING_DIR=".issues/2_doing"
DONE_DIR=".issues/3_done"

: "${RAILI_VAR_ID:?Environment variable RAILI_VAR_ID must be set and non-empty}"

if [ $# -lt 2 ] || [ $# -gt 3 ]; then
  echo "Usage: move_ticket.sh <from> <to> [suffix]" >&2
  echo "Possible values for from/to: todo, doing, done" >&2
  echo "Optional suffix narrows match, e.g. 'pt1' matches ${RAILI_VAR_ID}-pt1*" >&2
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
SUFFIX="${3:-}"

# Match files based on whether a suffix was provided
shopt -s nullglob
if [ -n "$SUFFIX" ]; then
  # Suffix given: match $RAILI_VAR_ID-<suffix>* specifically
  matches=("$FROM_DIR"/"$RAILI_VAR_ID"-"$SUFFIX"*)
else
  # No suffix: match $RAILI_VAR_ID* but exclude part files (-pt<N>)
  all_matches=("$FROM_DIR"/"$RAILI_VAR_ID"*)
  matches=()
  for f in "${all_matches[@]}"; do
    if ! [[ "$(basename "$f")" =~ -pt[0-9]+ ]]; then
      matches+=("$f")
    fi
  done
  # Fall back to all matches if no non-part files found
  if [ "${#matches[@]}" -eq 0 ]; then
    matches=("${all_matches[@]}")
  fi
fi
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
