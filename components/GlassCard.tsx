// components/GlassCard.tsx — テーマ対応カード
import React from 'react'
import { StyleSheet, View, ViewStyle } from 'react-native'
import { useTheme } from '../context/ThemeContext'

interface Props {
  children: React.ReactNode
  style?: ViewStyle
  padding?: number
  glowColor?: string
}

export default function GlassCard({ children, style, padding = 16, glowColor }: Props) {
  const { colors } = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {glowColor && <View style={[styles.accentLine, { backgroundColor: glowColor }]} />}
      <View style={[styles.content, { padding }]}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card:       { borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  accentLine: { height: 2, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
  content:    { gap: 12, zIndex: 2 },
})
