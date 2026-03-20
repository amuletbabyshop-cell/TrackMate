// components/QuickLogModal.tsx — クイック練習ログ（3ステップ入力）
import React, { useState, useRef } from 'react'
import {
  Modal, View, Text, TouchableOpacity, TextInput,
  StyleSheet, Animated, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { BRAND, TEXT, SURFACE, SURFACE2, DIVIDER, NEON } from '../lib/theme'
import { Sounds, unlockAudio } from '../lib/sounds'
import Toast from 'react-native-toast-message'
import type { SessionType } from '../types'

const SESSIONS_KEY = 'trackmate_sessions'

// ── セッションタイプ選択肢 ─────────────────────────────────
const SESSION_TYPES: { type: SessionType; label: string; emoji: string; color: string }[] = [
  { type: 'easy',      label: 'ジョグ',       emoji: '🏃', color: NEON.green },
  { type: 'interval',  label: 'インターバル', emoji: '⚡', color: '#FF3B30' },
  { type: 'sprint',    label: 'スプリント',   emoji: '💨', color: BRAND },
  { type: 'drill',     label: 'ドリル',       emoji: '🔄', color: '#4A9FFF' },
  { type: 'strength',  label: '補強',         emoji: '💪', color: '#FF9500' },
  { type: 'tempo',     label: 'テンポ走',     emoji: '🌊', color: '#9B6BFF' },
  { type: 'long',      label: 'ロング走',     emoji: '🛣️', color: NEON.green },
  { type: 'rest',      label: '休養',         emoji: '😴', color: TEXT.hint },
]

// ── 疲労度絵文字 ──────────────────────────────────────────
const FATIGUE_EMOJIS = [
  { emoji: '😊', label: '楽',  value: 2 },
  { emoji: '🙂', label: 'やや楽', value: 4 },
  { emoji: '😐', label: 'ふつう', value: 6 },
  { emoji: '😰', label: 'きつい', value: 8 },
  { emoji: '🥵', label: '限界', value: 10 },
]

interface Props {
  visible: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function QuickLogModal({ visible, onClose, onSaved }: Props) {
  const [sessionType, setSessionType] = useState<SessionType>('easy')
  const [distance, setDistance]       = useState('')
  const [fatigueVal, setFatigueVal]   = useState(6)
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)

  const slideAnim = useRef(new Animated.Value(300)).current

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }).start()
    } else {
      slideAnim.setValue(300)
    }
  }, [visible])

  async function handleSave() {
    unlockAudio()
    setSaving(true)
    try {
      const existing = await AsyncStorage.getItem(SESSIONS_KEY)
      const sessions = existing ? JSON.parse(existing) : []
      const newSession = {
        id: `ql_${Date.now()}`,
        user_id: 'mock-user-1',
        session_date: new Date().toISOString().slice(0, 10),
        session_type: sessionType,
        distance_m: distance ? parseFloat(distance) * 1000 : undefined,
        fatigue_level: fatigueVal,
        condition_level: 6,
        notes: notes || undefined,
        created_at: new Date().toISOString(),
      }
      sessions.unshift(newSession)
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
      Sounds.save()
      Toast.show({ type: 'success', text1: '練習を記録しました ✓', visibilityTime: 1800 })
      // Reset
      setDistance(''); setNotes(''); setFatigueVal(6); setSessionType('easy')
      onSaved?.()
      onClose()
    } catch {
      Toast.show({ type: 'error', text1: '保存に失敗しました' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={st.kvWrapper}
        pointerEvents="box-none"
      >
        <Animated.View style={[st.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* ── ハンドル ── */}
          <View style={st.handle} />

          {/* ── タイトル ── */}
          <View style={st.header}>
            <Text style={st.title}>今日の練習を記録</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={TEXT.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── ① 種目 ── */}
            <Text style={st.stepLabel}>① 何をした？</Text>
            <View style={st.typeGrid}>
              {SESSION_TYPES.map(t => {
                const active = sessionType === t.type
                return (
                  <TouchableOpacity
                    key={t.type}
                    activeOpacity={0.7}
                    onPress={() => { unlockAudio(); Sounds.pop(); setSessionType(t.type) }}
                    style={[st.typeBtn, active && { backgroundColor: t.color + '22', borderColor: t.color }]}
                  >
                    <Text style={st.typeEmoji}>{t.emoji}</Text>
                    <Text style={[st.typeLabel, { color: active ? t.color : TEXT.secondary }]}>{t.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* ── ② 距離（任意） ── */}
            <Text style={st.stepLabel}>② 距離（任意）</Text>
            <View style={st.inputRow}>
              <TextInput
                style={st.input}
                value={distance}
                onChangeText={setDistance}
                placeholder="例: 5"
                placeholderTextColor={TEXT.hint}
                keyboardType="decimal-pad"
                maxLength={6}
              />
              <Text style={st.inputSuffix}>km</Text>
            </View>

            {/* ── ③ 疲労度 ── */}
            <Text style={st.stepLabel}>③ 疲労度は？</Text>
            <View style={st.fatigueRow}>
              {FATIGUE_EMOJIS.map(f => {
                const active = fatigueVal === f.value
                return (
                  <TouchableOpacity
                    key={f.value}
                    activeOpacity={0.7}
                    onPress={() => { unlockAudio(); Sounds.pop(); setFatigueVal(f.value) }}
                    style={[st.fatigueBtn, active && st.fatigueBtnActive]}
                  >
                    <Text style={[st.fatigueEmoji, !active && { opacity: 0.45 }]}>{f.emoji}</Text>
                    <Text style={[st.fatigueLabel, { color: active ? '#fff' : TEXT.hint }]}>{f.label}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* ── メモ（任意） ── */}
            <Text style={st.stepLabel}>メモ（任意）</Text>
            <TextInput
              style={[st.input, st.inputMulti]}
              value={notes}
              onChangeText={setNotes}
              placeholder="今日の練習について..."
              placeholderTextColor={TEXT.hint}
              multiline
              numberOfLines={2}
              maxLength={200}
            />

            {/* ── 保存ボタン ── */}
            <TouchableOpacity
              style={[st.saveBtn, saving && { opacity: 0.6 }]}
              activeOpacity={0.85}
              onPress={handleSave}
              disabled={saving}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={st.saveBtnText}>{saving ? '保存中...' : '記録する'}</Text>
            </TouchableOpacity>

          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const st = StyleSheet.create({
  overlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  kvWrapper: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 40,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginTop: 10, marginBottom: 6,
  },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  title:     { color: '#fff', fontSize: 17, fontWeight: '800' },
  stepLabel: { color: TEXT.hint, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 16, marginBottom: 8 },

  // Type grid
  typeGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn:    {
    width: '23%', alignItems: 'center', paddingVertical: 10,
    backgroundColor: SURFACE2, borderRadius: 10, borderWidth: 1, borderColor: DIVIDER,
  },
  typeEmoji:  { fontSize: 20, marginBottom: 3 },
  typeLabel:  { fontSize: 10, fontWeight: '700' },

  // Distance input
  inputRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, backgroundColor: SURFACE2, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: DIVIDER,
  },
  inputMulti:   { height: 64, textAlignVertical: 'top', paddingTop: 10 },
  inputSuffix:  { color: TEXT.secondary, fontSize: 14, fontWeight: '700' },

  // Fatigue
  fatigueRow:     { flexDirection: 'row', gap: 6 },
  fatigueBtn:     { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: DIVIDER, backgroundColor: SURFACE2 },
  fatigueBtnActive: { backgroundColor: '#1a1a1a', borderColor: 'rgba(255,255,255,0.3)' },
  fatigueEmoji:   { fontSize: 22 },
  fatigueLabel:   { fontSize: 10, fontWeight: '600', marginTop: 3 },

  // Save
  saveBtn:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: BRAND, borderRadius: 14, paddingVertical: 15, marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
