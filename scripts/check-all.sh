#!/usr/bin/env sh
# Validate every plugin and run every test. Needs Claude Code v2.1.287 or later.
set -e
cd "$(dirname "$0")/.."
node scripts/test-lib.mjs
claude plugin validate .
for dir in plugins/*/; do
  claude plugin validate "$dir"
  if ls "$dir"tests/*.test.ts >/dev/null 2>&1; then (cd "$dir" && claude plugin test); fi
done
# Every mod must carry an up-to-date copy of the shared library
for lib in plugins/claw-*/hooks/lib.js; do
  cmp -s shared/claw-lib.js "$lib" || { echo "$lib is out of date: run scripts/sync-lib.sh"; exit 1; }
done
echo "All checks passed."
