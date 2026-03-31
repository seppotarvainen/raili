#!/usr/bin/env bash
# check-test-hygiene.sh
# Detects test anti-patterns that can cause cross-file pollution:
#   1. Direct mutation of module properties instead of jest.spyOn
#   2. Missing mock cleanup (spyOn without restoreAllMocks/mockRestore)
#   3. process.env assignments without cleanup
#   4. jest.resetModules() in unit tests (breaks fake FS injection)
#   5. setupFakeFs() without a restore call in the same file

set -euo pipefail

ERRORS=0
TEST_GLOB="__tests__/**/*.ts"

echo "🔍 Checking test hygiene..."

# ── 1. Direct module property mutation (the bug we just fixed) ────────────────
# Pattern: (someModule.someMethod as any) = jest.fn(
# This permanently mutates a shared module singleton and is not restored by jest.
MATCHES=$(grep -rn --include="*.ts" \
  -E '\([a-zA-Z_$][a-zA-Z0-9_.]*\s+as\s+any\)\s*=\s*jest\.fn\(' \
  __tests__/ 2>/dev/null || true)

if [[ -n "$MATCHES" ]]; then
  echo ""
  echo "❌ FAIL: Direct module property mutation found (not restored after tests)."
  echo "   Use jest.spyOn(module, 'method').mockImplementation(...) instead."
  echo ""
  echo "$MATCHES" | while IFS= read -r line; do
    echo "   $line"
  done
  ERRORS=$((ERRORS + 1))
fi

# ── 2. Direct assignment variant without cast ─────────────────────────────────
# Pattern: someImport.someMethod = jest.fn(  (without spyOn)
MATCHES2=$(grep -rn --include="*.ts" \
  -E '^[[:space:]]*[a-zA-Z_$][a-zA-Z0-9_]*\.[a-zA-Z_$][a-zA-Z0-9_]*\s*=\s*jest\.fn\(' \
  __tests__/ 2>/dev/null || true)

if [[ -n "$MATCHES2" ]]; then
  echo ""
  echo "❌ FAIL: Direct mock assignment to module property found."
  echo "   Use jest.spyOn(module, 'method').mockImplementation(...) instead."
  echo ""
  echo "$MATCHES2" | while IFS= read -r line; do
    echo "   $line"
  done
  ERRORS=$((ERRORS + 1))
fi

# ── 3. process.env mutation without cleanup ───────────────────────────────────
# Warn when process.env is set in tests but no afterEach/afterAll cleanup seen in the same file.
while IFS= read -r file; do
  if grep -q 'process\.env\.' "$file" && \
     grep -q '= ' "$file" && \
     ! grep -q 'delete process\.env\|cleanupRailiEnvVars\|afterEach\|afterAll' "$file"; then
    echo ""
    echo "⚠️  WARN: $file sets process.env but has no cleanup (afterEach/afterAll or delete)."
    ERRORS=$((ERRORS + 1))
  fi
done < <(grep -rl 'process\.env\.' __tests__/ --include="*.ts" 2>/dev/null || true)

# ── 4. beforeAll with filesystem side-effects but no afterAll ────────────────
# Only flag when beforeAll contains fs operations (mkdtemp, mkdirSync, writeFile, etc.)
while IFS= read -r file; do
  has_afterAll=$(grep -c 'afterAll' "$file" || true)
  if [[ "$has_afterAll" -eq 0 ]]; then
    if grep -A 10 'beforeAll' "$file" | grep -qE 'mkdtemp|mkdirSync|writeFile|writeFileSync|rmSync|mkdir'; then
      echo ""
      echo "⚠️  WARN: $file uses beforeAll with filesystem side-effects but has no afterAll cleanup."
      ERRORS=$((ERRORS + 1))
    fi
  fi
done < <(grep -rl 'beforeAll' __tests__/ --include="*.ts" 2>/dev/null || true)

# ── 5. jest.resetModules() combined with fake FS in unit tests ───────────────
# jest.resetModules() inside a unit test breaks fake FS injection when the same
# file also uses setupFakeFs()/getFileSystem() — the re-required module gets a
# fresh fileSystemProvider with NodeFileSystem, not the installed fake.
# (Legitimate uses of jest.resetModules() without fake FS are allowed.)
while IFS= read -r file; do
  if grep -q 'setupFakeFs\|getFileSystem' "$file"; then
    echo ""
    echo "❌ FAIL: $file uses jest.resetModules() alongside fake FS injection."
    echo "   This breaks the fake: re-required modules load a fresh NodeFileSystem."
    echo "   Use top-level jest.mock() + static imports instead. See run.test.ts."
    ERRORS=$((ERRORS + 1))
  fi
done < <(grep -rl 'jest\.resetModules' __tests__/unit/ --include="*.ts" 2>/dev/null || true)

# ── 6. setupFakeFs() without restore ─────────────────────────────────────────
# Every file that CALLS setupFakeFs() must also call restoreFs (or equivalent)
# in afterEach/afterAll. Excludes the definition file itself.
while IFS= read -r file; do
  # skip the definition file
  [[ "$file" == *"fsFake.util.ts" ]] && continue
  if ! grep -q 'restoreFs\|restore()' "$file"; then
    echo ""
    echo "❌ FAIL: $file calls setupFakeFs() but has no restore call."
    echo "   Add: afterEach(() => restoreFs());"
    ERRORS=$((ERRORS + 1))
  fi
done < <(grep -rl 'setupFakeFs' __tests__/unit/ --include="*.ts" 2>/dev/null || true)

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [[ "$ERRORS" -eq 0 ]]; then
  echo "✅ All test hygiene checks passed."
  exit 0
else
  echo "❌ $ERRORS hygiene issue(s) found. Fix before merging."
  exit 1
fi

