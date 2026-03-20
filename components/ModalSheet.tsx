// components/ModalSheet.tsx — スプリング入場アニメーション付きモーダルシート

import React, { useEffect, useRef } from 'react'
import { Animated, Modal, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Sounds, unlockAudio } from '../lib/sounds'

interface Props {
  visible: boolean
  onClose?: () => void
  children: React.ReactNode
  backgroundColor?: string
}

export default function ModalSheet({
  visible,
  onClose,
  children,
  backgroundColor = '#000000',
}: Props) {
  const translateY = useRef(new Animated.Value(600)).current
  const opacity    = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      unlockAudio()
      Sounds.whoosh()
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 160,
          friction: 18,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 600,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible])

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.container, { backgroundColor, opacity, transform: [{ translateY }] }]}>
        <SafeAreaView style={{ flex: 1 }}>
          {children}
        </SafeAreaView>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
