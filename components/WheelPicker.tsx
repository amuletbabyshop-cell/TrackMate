// components/WheelPicker.tsx — iPhoneアラーム風ドラムロールピッカー

import React, { useEffect, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, Platform,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { NEON } from '../lib/theme'

const ITEM_H = 50   // 1アイテムの高さ
const VISIBLE = 5   // 表示アイテム数（奇数推奨）
const PAD = Math.floor(VISIBLE / 2)  // 上下パディング用アイテム数

interface Props {
  items: string[]
  selectedIndex: number
  onChange: (index: number) => void
  width?: number
  accentColor?: string
  fontSize?: number
}

export default function WheelPicker({
  items,
  selectedIndex,
  onChange,
  width = 80,
  accentColor = NEON.blue,
  fontSize = 22,
}: Props) {
  const ref = useRef<ScrollView>(null)
  const currentIdx = useRef(selectedIndex)
  const isInitialized = useRef(false)

  // 初期位置にスクロール
  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false })
      isInitialized.current = true
    }, 80)
    return () => clearTimeout(timer)
  }, [])

  // 外部からの selectedIndex 変更に追随（初期化後は無視）
  useEffect(() => {
    if (!isInitialized.current) return
    if (selectedIndex !== currentIdx.current) {
      currentIdx.current = selectedIndex
      ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: true })
    }
  }, [selectedIndex])

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H)))
    if (idx !== currentIdx.current) {
      currentIdx.current = idx
      onChange(idx)
      if (Platform.OS !== 'web') Haptics.selectionAsync()
    }
  }

  return (
    <View style={[styles.root, { width, height: ITEM_H * VISIBLE }]}>

      {/* 選択ゾーン: 上下の光るライン */}
      <View
        pointerEvents="none"
        style={[styles.selectBox, {
          top: ITEM_H * PAD,
          height: ITEM_H,
          borderColor: `${accentColor}88`,
        }]}
      />

      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        contentContainerStyle={{ paddingVertical: ITEM_H * PAD }}
        bounces={false}
        scrollEventThrottle={16}
      >
        {items.map((item, i) => (
          <View key={i} style={[styles.item, { height: ITEM_H }]}>
            <Text style={[styles.itemText, { fontSize, color: accentColor }]}>
              {item}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* 上フェード */}
      <LinearGradient
        colors={['rgba(12,14,35,0.97)', 'rgba(12,14,35,0.6)', 'transparent']}
        style={[styles.fade, styles.fadeTop]}
        pointerEvents="none"
      />
      {/* 下フェード */}
      <LinearGradient
        colors={['transparent', 'rgba(12,14,35,0.6)', 'rgba(12,14,35,0.97)']}
        style={[styles.fade, styles.fadeBottom]}
        pointerEvents="none"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
  selectBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    zIndex: 1,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontWeight: '600',
    letterSpacing: 1,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_H * PAD,
    zIndex: 2,
  },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
})
