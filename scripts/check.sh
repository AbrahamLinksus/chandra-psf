#!/usr/bin/env bash
# Runs every check from docs/CONVENTIONS.md section 6; exits 1 if any fails.
# CHECK_NO_COVERAGE=1 skips only the coverage threshold (empty-skeleton smoke check).
set -uo pipefail
cd "$(dirname "$0")/.."
export PLAYWRIGHT_HOST_PLATFORM_OVERRIDE="${PLAYWRIGHT_HOST_PLATFORM_OVERRIDE:-ubuntu24.04-x64}"
export PATH="$PWD/.tools:$PATH"

failed=()
run() {
  local name="$1"; shift
  echo "==> $name"
  if "$@"; then echo "    OK: $name"; else echo "    FAIL: $name"; failed+=("$name"); fi
}

run "eslint" pnpm exec eslint .
run "prettier" pnpm exec prettier --check .
run "tsc" pnpm exec tsc --noEmit
run "depcruise" pnpm exec depcruise src --config .dependency-cruiser.cjs
if [ "${CHECK_NO_COVERAGE:-0}" = "1" ]; then
  run "vitest (no coverage threshold)" pnpm exec vitest run --passWithNoTests
else
  run "vitest + coverage" pnpm exec vitest run --coverage --passWithNoTests
fi
if [ -f scripts/build-seed.ts ]; then
  run "seed fixture" pnpm exec tsx scripts/build-seed.ts --check
else
  echo "==> seed fixture: SKIPPED (scripts/build-seed.ts does not exist yet)"
fi
run "next build" pnpm exec next build
if find tests/e2e -type f \( -name '*.spec.ts' -o -name '*.spec.tsx' \) 2>/dev/null | grep -q .; then
  run "playwright" pnpm exec playwright test
else
  echo "==> playwright: SKIPPED (no specs in tests/e2e yet)"
fi
if command -v gitleaks >/dev/null 2>&1; then
  run "gitleaks" gitleaks detect --no-git --redact
else
  echo "==> gitleaks: NOT FOUND (put the binary in .tools/ or on PATH)"; failed+=("gitleaks")
fi

echo
if [ "${#failed[@]}" -gt 0 ]; then echo "CHECK FAILED: ${failed[*]}"; exit 1; fi
echo "CHECK PASSED"
