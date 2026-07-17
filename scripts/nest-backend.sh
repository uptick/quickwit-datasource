#!/usr/bin/env bash
# The Go backend belongs to the nested datasource plugin. Mage now builds it
# straight into dist/datasources/quickwit (see Magefile.go); this script only
# migrates binaries left at the dist root by older builds.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p dist/datasources/quickwit
for artifact in dist/gpx_quickwit* dist/go_plugin_build_manifest; do
  [ -e "$artifact" ] && mv "$artifact" dist/datasources/quickwit/
done
exit 0
