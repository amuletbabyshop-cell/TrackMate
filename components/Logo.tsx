import React from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

interface Props {
  size?: number
  showText?: boolean
  variant?: 'dark' | 'light'
}

export default function Logo({ size = 80, showText = false, variant = 'light' }: Props) {
  const bg = variant === 'light' ? '#000000' : '#FFFFFF'
  const fg = variant === 'light' ? '#FFFFFF' : '#000000'

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">

        {/* 背景 */}
        <Rect width="100" height="100" rx="24" fill={bg} />

        {/* 上昇する軌跡ライン */}
        <Path
          d="M 18 76 Q 48 58 72 24"
          stroke={fg}
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />

        {/* 終点の大きな点（現在地） */}
        <Circle cx="72" cy="24" r="10" fill={fg} />

      </Svg>

      {showText && (
        <Text style={{
          color: '#FFFFFF',
          fontSize: size * 0.18,
          fontWeight: '800',
          marginTop: size * 0.07,
          letterSpacing: 2,
        }}>
          TRACKMATE
        </Text>
      )}
    </View>
  )
}
