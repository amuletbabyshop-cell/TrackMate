#!/usr/bin/env node
// scripts/inject-fonts.js — Ioniconsフォントをシンプルなパスにコピーして注入

const fs   = require('fs')
const path = require('path')

const distDir  = path.join(__dirname, '../dist')
const fontsDir = path.join(distDir, 'fonts')

// fonts/ ディレクトリ作成
if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true })

// Ionicons TTF を dist/fonts/ に探してコピー
function findAndCopy(pattern, destName) {
  const assetsDir = path.join(distDir, 'assets')
  if (!fs.existsSync(assetsDir)) return null

  function walk(dir) {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f)
      if (fs.statSync(full).isDirectory()) {
        const found = walk(full)
        if (found) return found
      } else if (f.startsWith(pattern) && f.endsWith('.ttf')) {
        return full
      }
    }
    return null
  }

  const src = walk(assetsDir)
  if (!src) return null
  const dest = path.join(fontsDir, destName)
  fs.copyFileSync(src, dest)
  console.log(`✅ Copied ${f => path.basename(src)} → /fonts/${destName}`)
  return `/fonts/${destName}`
}

const ioniconsPath = findAndCopy('Ionicons', 'Ionicons.ttf')

if (!ioniconsPath) {
  console.warn('⚠️  Ionicons not found, skipping font injection')
  process.exit(0)
}

// CSS + FontFace API スクリプトを両方注入（確実にロードするため）
const injection = `
<style id="icon-fonts">
@font-face {
  font-family: 'Ionicons';
  src: url('${ioniconsPath}') format('truetype');
  font-display: block;
}
</style>
<script>
(function() {
  try {
    var ff = new FontFace('Ionicons', 'url(${ioniconsPath})');
    ff.load().then(function(f) {
      document.fonts.add(f);
    });
  } catch(e) {}
})();
</script>`

for (const file of ['index.html', '200.html']) {
  const filePath = path.join(distDir, file)
  if (!fs.existsSync(filePath)) continue
  let html = fs.readFileSync(filePath, 'utf-8')
  if (html.includes('id="icon-fonts"')) {
    // 既存の壊れた注入を削除して置き換え
    html = html.replace(/<style id="icon-fonts">[\s\S]*?<\/style>/, '')
  }
  html = html.replace('</head>', injection + '\n</head>')
  fs.writeFileSync(filePath, html)
  console.log(`✅ Injected into ${file}`)
}

console.log('\n🎉 Font injection complete!')
