// components/GlassCard.tsx — Nike Podium スタイル ソリッドカード

import React from 'react'
import { StyleSheet, View, ViewStyle } from 'react-native'
import { SURFACE } from '../lib/theme'

interface Props {
  children: React.ReactNode
  style?: ViewStyle
  padding?: number
  /** アクセントカラー: カード上端に 2px のカラーラインを引く */
  glowColor?: string
}

export default function GlassCard({
  children,
  style,
  padding = 16,
  glowColor,
}: Props) {
  return (
    <View style={[styles.card, style]}>
      {/* アクセントライン（Nike 種目カラーコーディング的） */}
      {glowColor && (
        <View style={[styles.accentLine, { backgroundColor: glowColor }]} />
      )}

      <View style={[styles.content, { padding }]}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    overflow: 'hidden',
  },
  accentLine: {
    height: 2,
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 1,
  },
  content: {
    gap: 12,
    zIndex: 2,
  },
})
