import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { SURFACE, DIVIDER, TEXT } from '../lib/theme'

// ─── Adsterra設定 ────────────────────────────────────────────────────────────
// Adsterra ダッシュボード → Create Ad → Display Banner → 320×50 で取得した Key を貼る
// https://publishers.adsterra.com/
const ADSTERRA_KEY_320x50 = '6f2901a4bf3a9a0b38f19a89392933e6'

const IS_AD_CONFIGURED = ADSTERRA_KEY_320x50 !== 'YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY'

// ─── Adsterra バナー注入（Web専用）──────────────────────────────────────────
function WebAdBanner() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''

    // 1) atOptions をインライン script で注入
    const opts = document.createElement('script')
    opts.type = 'text/javascript'
    opts.text = `
      atOptions = {
        'key'    : '${ADSTERRA_KEY_320x50}',
        'format' : 'iframe',
        'height' : 50,
        'width'  : 320,
        'params' : {}
      };
    `
    container.appendChild(opts)

    // 2) invoke.js を外部 script として注入
    const invoke = document.createElement('script')
    invoke.type = 'text/javascript'
    invoke.src  = `//www.highperformanceformat.com/${ADSTERRA_KEY_320x50}/invoke.js`
    invoke.async = true
    container.appendChild(invoke)
  }, [])

  return <div ref={containerRef} style={{ width: 320, height: 50, overflow: 'hidden' }} />
}

// ─── プレースホルダー（Key 未設定時）──────────────────────────────────────────
function BannerPlaceholder() {
  return (
    <View style={styles.placeholder}>
      <Text style={{ fontSize: 12 }}>📢</Text>
      <Text style={styles.placeholderText}>広告スペース 320×50</Text>
    </View>
  )
}

// ─── メインコンポーネント ────────────────────────────────────────────────────
// Web専用。ネイティブでは null を返します。
export default function AdBanner() {
  // ネイティブでは何も表示しない
  if (Platform.OS !== 'web') return null

  return (
    <View style={styles.container}>
      {IS_AD_CONFIGURED
        ? <WebAdBanner />
        : <BannerPlaceholder />
      }
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
    backgroundColor: SURFACE,
  },
  placeholder: {
    width: 320,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: DIVIDER,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderText: {
    color: TEXT.hint,
    fontSize: 11,
  },
})
