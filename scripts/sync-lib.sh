#!/usr/bin/env sh
# Copy shared/claw-lib.js into every Claw mod. Mods may only import files inside
# their own plugin folder, so each one carries a copy. Edit shared/, then run this.
set -e
cd "$(dirname "$0")/.."
for dir in plugins/claw-*/hooks; do
  cp shared/claw-lib.js "$dir/lib.js"
  echo "synced $dir/lib.js"
done
