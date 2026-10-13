#!/usr/bin/env bash
# Assembles the landing page into _site/ for GitHub Pages (and local preview).
# Source lives in site/; screenshots and the demo video are reused from docs/media/ instead of duplicated.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf _site
mkdir -p _site/media/screenshots
cp -R site/. _site/
cp docs/media/screenshots/*.png _site/media/screenshots/
cp docs/media/lifetrack-demo.mp4 docs/media/download-apk-qr.png _site/media/
touch _site/.nojekyll

echo "Built _site/ ($(du -sh _site | cut -f1))"
