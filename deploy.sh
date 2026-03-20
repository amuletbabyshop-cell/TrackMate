#!/bin/bash
# TrackMate Web デプロイスクリプト
# 使い方: ./deploy.sh

set -e
cd "$(dirname "$0")"

echo "🔨 1/3 ビルド中..."
npx expo export --platform web

echo "🔤 2/3 フォント注入中..."
cp dist/index.html dist/200.html
echo "/* /index.html 200" > dist/_redirects
node scripts/inject-fonts.js

echo "🚀 3/3 デプロイ中..."
NPM_CONFIG_CACHE=/tmp/npm-cache-surge npx surge dist/ trackmate-fojpl.surge.sh

echo ""
echo "✅ 完了! https://trackmate-fojpl.surge.sh"
