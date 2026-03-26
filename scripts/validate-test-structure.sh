#!/bin/bash

# Validates that test files in __tests__/unit/** have corresponding source files
# and that they import from those source files.
#
# Exit codes:
#   0 - All tests valid
#   1 - Issues found

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TESTS_DIR="$REPO_ROOT/__tests__/unit"
SRC_DIR="$REPO_ROOT/src"

ISSUES_FOUND=0
declare -a ISSUE_LIST

# Output format (piped to array for later formatting):
# test_file|issue_type|message
output_issue() {
  local test_file=$1
  local issue_type=$2
  local message=$3
  ISSUE_LIST+=("${test_file}|${issue_type}|${message}")
  ISSUES_FOUND=$((ISSUES_FOUND + 1))
}

# Find all test files
while IFS= read -r test_file; do
  # Extract relative path from __tests__/unit/
  rel_path="${test_file#$TESTS_DIR/}"
  
  # Remove .test suffix to get the base name
  base_name="${rel_path%.test.ts}"
  
  # Derive module name as the first path segment (before any slash) and strip after first dot
  module_name="${base_name%%/*}"
  module_name="${module_name%%.*}"
  
  # Construct the expected source file path.
  # Rule: if directory has a top-level re-export (src/<dir>.ts), use that for all tests in that directory
  # Otherwise, match directory structure
  dir_path=$(dirname "$base_name")

  if [ "$dir_path" = "." ]; then
    # Top-level: run.test.ts -> src/run.ts
    expected_src="$SRC_DIR/${base_name}.ts"
  else
    # Check if there's a top-level re-export for this directory
    reexport_path="$SRC_DIR/${dir_path}.ts"
    if [ -f "$reexport_path" ]; then
      # Use the re-export: cli/* -> src/cli.ts
      expected_src="$reexport_path"
    else
      # Use directory structure: workflow/fieldValidator.test.ts -> src/workflow/fieldValidator.ts
      expected_src="$SRC_DIR/${base_name}.ts"
    fi
  fi
  
  # Check if source file exists
  if [ ! -f "$expected_src" ]; then
    output_issue "$rel_path" "missing_source" "No matching source file at ${expected_src#$REPO_ROOT/}"
    continue
  fi
  
  # Check if test file imports from the expected source
  # Build source_module_path (used for import checking)
  if [ "$dir_path" = "." ]; then
    source_module_path="src/${base_name}"
  else
    # Check if there's a top-level re-export for this directory
    reexport_path="$SRC_DIR/${dir_path}.ts"
    if [ -f "$reexport_path" ]; then
      source_module_path="src/${dir_path}"
    else
      source_module_path="src/${base_name}"
    fi
  fi
  
  # Check for imports from the source file (case-sensitive)
  # Match patterns like: from "../../src/run" or require("../../src/run")
  if ! grep -qE "(from\s+['\"]|require\s*\(\s*['\"]).*${source_module_path}['\"]" "$test_file"; then
    output_issue "$rel_path" "missing_import" "Doesn't import from ${source_module_path}"
  fi
  
done < <(find "$TESTS_DIR" -name "*.test.ts" -type f | sort)

# Format and print results
if [ $ISSUES_FOUND -eq 0 ]; then
  echo "✅ All test files have valid structure and imports."
  exit 0
else
  echo "❌ Test structure validation failed: $ISSUES_FOUND issue(s) found"
  echo ""
  for issue in "${ISSUE_LIST[@]}"; do
    IFS='|' read -r test_file issue_type message <<< "$issue"
    echo "$test_file | $message"
  done
  exit 1
fi

