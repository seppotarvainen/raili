#!/usr/bin/env bash
set -euo pipefail

TODODIR=".issues/1_todo"

if ! command -v pandoc >/dev/null; then
  echo "ERROR: pandoc is not installed or not on PATH" >&2
  exit 1
fi

# Convert each .md to the same basename .pdf next to the source; do not delete .md files
while IFS= read -r -d '' file; do
  out="${file%.md}.pdf"
  echo "Converting: $file -> $out"
  if ! pandoc "$file" -o "$out"; then
    echo "ERROR: conversion failed for $file" >&2
    exit 1
  fi
done < <(find "$TODODIR" -maxdepth 1 -type f -name '*.md' -print0)

echo "Done: PDFs created next to source markdown files."
