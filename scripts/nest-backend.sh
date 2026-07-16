#!/usr/bin/env bash
# The Go backend (built by mage into dist/) belongs to the nested datasource
# plugin — copy the binaries next to its plugin.json.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p dist/datasources/quickwit
for artifact in dist/gpx_quickwit* dist/go_plugin_build_manifest; do
  [ -e "$artifact" ] && cp "$artifact" dist/datasources/quickwit/
done
exit 0
