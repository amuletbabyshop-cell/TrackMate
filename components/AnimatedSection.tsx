// components/AnimatedSection.tsx — セクション入場アニメーション（全画面共通）
// useFocusEffect でタブ切替のたびに再生する

import React, { useCallback, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

interface Props {
  children: React.ReactNode
  delay?: number
  /** 'fade-up' | 'fade-left' | 'scale' | 'fade' */
  type?: 'fade-up' | 'fade-left' | 'scale' | 'fade'
  duration?: number
}

export default function AnimatedSection({
  children,
  delay = 0,
  type = 'fade-up',
  duration = 440,
}: Props) {
  const anim = useRef(new Animated.Value(0)).current

  useFocusEffect(
    useCallback(() => {
      // フォーカスされるたびに最初からアニメーション
      anim.setValue(0)
      const animation = Animated.timing(anim, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
      animation.start()
      return () => animation.stop()
    }, [delay, duration])
  )

  const style = (() => {
    switch (type) {
      case 'fade-up':
        return {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
        }
      case 'fade-left':
        return {
          opacity: anim,
          transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) }],
        }
      case 'scale':
        return {
          opacity: anim,
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
        }
      case 'fade':
      default:
        return { opacity: anim }
    }
  })()

  return <Animated.View style={style}>{children}</Animated.View>
}
