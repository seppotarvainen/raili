#!/bin/bash

# Validates test structure:
# 1. Tests should be in directory matching their primary source import
# 2. Tests should use dot notation (runner.group.test.ts not runner-group.test.ts)
# 3. Tests should have an obvious import from a source file
# 4. Flags duplicate test files in different directories
# 5. Allows behavior-based naming: context.flattened.test.ts, run.runCommand.test.ts
#
# Exit codes:
#   0 - All tests valid
#   1 - Issues found

set -eo pipefail

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

# Check if a test has ANY import from src/
has_src_import() {
  local test_file=$1
  grep -qE "(from\s+['\"]|require\s*\(\s*['\"]).*src/" "$test_file" || return 1
}

# Extract primary source import path from test file
# Returns path like "src/workflow/schemaValidator" or "src/run"
get_primary_import() {
  local test_file=$1
  # Extract the import path starting from src/
  grep -oE "src/[a-zA-Z0-9/_.-]+" "$test_file" | head -1
}

# Track duplicates in a temporary file
seen_tests_file=$(mktemp)
trap "rm -f $seen_tests_file" EXIT

# Find all test files
while IFS= read -r test_file; do
  # Extract relative path from __tests__/unit/
  rel_path="${test_file#$TESTS_DIR/}"
  base_name="${rel_path%.test.ts}"
  dir_path=$(dirname "$base_name")
  file_name=$(basename "$base_name")

  # Extract core filename (before first dot for dot-notation tests)
  core_name="${file_name%%.*}"

  # Issue 1: Check for dash in test file names (should use dot notation)
  base_filename=$(basename "$rel_path" .test.ts)
  if [[ "$base_filename" == *"-"* ]]; then
    output_issue "$rel_path" "bad_naming" "Should use dot notation: $(echo "$base_filename" | sed 's/-/./g').test.ts"
  fi

  # Issue 2: Check if test imports from src at all
  if ! has_src_import "$test_file"; then
    output_issue "$rel_path" "no_imports" "Doesn't import from any src/ module"
    continue
  fi

  # Issue 3: Verify test directory matches its source import location
  primary_import=$(get_primary_import "$test_file")
  if [ -n "$primary_import" ]; then
    # Extract directory and filename from import: "src/workflow/schemaValidator" -> "workflow", "schemaValidator"
    # or "src/cli" -> ".", "cli"
    import_path="${primary_import#src/}"

    if [[ "$import_path" == *"/"* ]]; then
      # Has a directory: src/workflow/schemaValidator
      expected_dir=$(dirname "$import_path")
      expected_file=$(basename "$import_path")
    else
      # Top-level: src/cli
      expected_dir="."
      expected_file="$import_path"
    fi

    # Check if a re-export exists (src/cli.ts) alongside directory (src/cli/)
    # If so, tests can import from either location
    reexport_file="$SRC_DIR/${expected_file}.ts"
    subdir="$SRC_DIR/${expected_file}"

    # If this is a re-export with a subdirectory, tests in subdir or root are both ok
    if [ -f "$reexport_file" ] && [ -d "$subdir" ]; then
      # For re-export patterns, tests can be in:
      # 1. __tests__/unit/<dirname>/ (matching the import path)
      # 2. __tests__/unit/<dirname>/ where dirname is a submodule directory
      # We only check if the test is in a completely wrong location
      :  # This is fine, no location check needed
    else
      # Normal case: test should match import location
      core_name="${file_name%%.*}"  # Get name before first dot

      # Only check location if the test name matches the import
      if [ "$core_name" = "$expected_file" ] || [[ "$file_name" == "$expected_file"* ]]; then
        if [ "$expected_dir" != "$dir_path" ]; then
          if [ "$expected_dir" = "." ]; then
            output_issue "$rel_path" "wrong_location" "Should be at __tests__/unit/$base_filename.test.ts (not in subdirectory)"
          else
            output_issue "$rel_path" "wrong_location" "Should be at __tests__/unit/$expected_dir/$base_filename.test.ts"
          fi
        fi
      fi
    fi
  fi

  # Issue 4: Check for duplicate test basenames (same file name in different directories)
  if grep -q "^$file_name$" "$seen_tests_file" 2>/dev/null; then
    prev_location=$(grep -A1 "^$file_name$" "$seen_tests_file" 2>/dev/null | tail -1)
    output_issue "$rel_path" "duplicate" "Also exists at: $prev_location"
  else
    echo "$file_name" >> "$seen_tests_file"
    echo "$rel_path" >> "$seen_tests_file"
  fi
  
done < <(find "$TESTS_DIR" -name "*.test.ts" -type f | sort)

# Format and print results
if [ $ISSUES_FOUND -eq 0 ]; then
  echo "✅ All test files have valid structure."
  exit 0
else
  echo "❌ Test structure validation found: $ISSUES_FOUND issue(s)"
  echo ""

  # Print all issues
  for issue in "${ISSUE_LIST[@]}"; do
    IFS='|' read -r test_file issue_type message <<< "$issue"
    echo "$test_file | $message"
  done

  exit 1
fi







