// components/QuickLogModal.tsx — クイック練習ログ（複数メニュー対応）
import React, { useState, useRef } from 'react'
import {
  Modal, View, Text, TouchableOpacity, TextInput,
  StyleSheet, Animated, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { BRAND, TEXT, SURFACE2, DIVIDER, NEON } from '../lib/theme'
import { Sounds, unlockAudio } from '../lib/sounds'
import Toast from 'react-native-toast-message'

const SESSIONS_KEY = 'trackmate_sessions'

const FATIGUE_EMOJIS = [
  { emoji: '😊', label: '楽',     value: 2 },
  { emoji: '🙂', label: 'やや楽', value: 4 },
  { emoji: '😐', label: 'ふつう', value: 6 },
  { emoji: '😰', label: 'きつい', value: 8 },
  { emoji: '🥵', label: '限界',   value: 10 },
]

type Unit = 'km' | 'm'

interface MenuItem {
  id: string
  name: string       // 種目名
  distance: string   // 距離数値
  unit: Unit         // km or m
  sets: string       // 本数
}

function newItem(): MenuItem {
  return { id: String(Date.now() + Math.random()), name: '', distance: '', unit: 'm', sets: '' }
}

interface Props {
  visible: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function QuickLogModal({ visible, onClose, onSaved }: Props) {
  const [items, setItems]         = useState<MenuItem[]>([newItem()])
  const [fatigueVal, setFatigueVal] = useState(6)
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)

  const slideAnim = useRef(new Animated.Value(300)).current

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }).start()
    } else {
      slideAnim.setValue(300)
    }
  }, [visible])

  const updateItem = (id: string, key: keyof MenuItem, val: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [key]: val } : it))
  }

  const addItem = () => {
    unlockAudio(); Sounds.pop()
    setItems(prev => [...prev, newItem()])
  }

  const removeItem = (id: string) => {
    unlockAudio(); Sounds.tap()
    setItems(prev => prev.filter(it => it.id !== id))
  }

  const toggleUnit = (id: string, current: Unit) => {
    unlockAudio(); Sounds.tap()
    updateItem(id, 'unit', current === 'km' ? 'm' : 'km')
  }

  async function handleSave() {
    unlockAudio()
    setSaving(true)
    try {
      const validItems = items.filter(it => it.name.trim())
      if (validItems.length === 0) {
        Toast.show({ type: 'error', text1: '種目名を入力してください' })
        return
      }
      const existing = await AsyncStorage.getItem(SESSIONS_KEY)
      const sessions = existing ? JSON.parse(existing) : []

      // メニュー内容をnotesに整形
      const menuText = validItems.map(it => {
        let line = it.name.trim()
        if (it.distance) line += ` ${it.distance}${it.unit}`
        if (it.sets) line += ` × ${it.sets}本`
        return line
      }).join('\n')

      const newSession = {
        id: `ql_${Date.now()}`,
        user_id: 'mock-user-1',
        session_date: new Date().toISOString().slice(0, 10),
        session_type: 'interval',
        menu_items: validItems,
        fatigue_level: fatigueVal,
        condition_level: 6,
        notes: (menuText + (notes ? '\n' + notes : '')) || undefined,
        created_at: new Date().toISOString(),
      }
      sessions.unshift(newSession)
      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
      Sounds.save()
      Toast.show({ type: 'success', text1: '練習を記録しました ✓', visibilityTime: 1800 })
      setItems([newItem()]); setNotes(''); setFatigueVal(6)
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
          <View style={st.handle} />
          <View style={st.header}>
            <Text style={st.title}>今日の練習を記録</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={TEXT.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── メニューリスト ── */}
            <Text style={st.stepLabel}>① やったメニュー</Text>
            {items.map((item, idx) => (
              <View key={item.id} style={st.itemCard}>
                <View style={st.itemHeader}>
                  <Text style={st.itemNum}>種目 {idx + 1}</Text>
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => removeItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* 種目名 */}
                <TextInput
                  style={st.nameInput}
                  value={item.name}
                  onChangeText={v => updateItem(item.id, 'name', v)}
                  placeholder="例: 100mインターバル、坂道走..."
                  placeholderTextColor={TEXT.hint}
                  autoCapitalize="none"
                />

                {/* 距離 + 単位 + 本数 */}
                <View style={st.rowInputs}>
                  <TextInput
                    style={[st.numInput, { flex: 2 }]}
                    value={item.distance}
                    onChangeText={v => updateItem(item.id, 'distance', v)}
                    placeholder="距離"
                    placeholderTextColor={TEXT.hint}
                    keyboardType="decimal-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={st.unitToggle}
                    onPress={() => toggleUnit(item.id, item.unit)}
                    activeOpacity={0.7}
                  >
                    <Text style={st.unitText}>{item.unit}</Text>
                    <Ionicons name="swap-horizontal" size={12} color={BRAND} />
                  </TouchableOpacity>
                  <TextInput
                    style={[st.numInput, { flex: 1.5 }]}
                    value={item.sets}
                    onChangeText={v => updateItem(item.id, 'sets', v.replace(/\D/g, ''))}
                    placeholder="本数"
                    placeholderTextColor={TEXT.hint}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={st.unitLabel}>本</Text>
                </View>
              </View>
            ))}

            {/* ＋ 種目を追加 */}
            <TouchableOpacity style={st.addBtn} onPress={addItem} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color={BRAND} />
              <Text style={st.addBtnText}>種目を追加</Text>
            </TouchableOpacity>

            {/* ── 疲労度 ── */}
            <Text style={st.stepLabel}>② 疲労度は？</Text>
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

            {/* ── メモ ── */}
            <Text style={st.stepLabel}>メモ（任意）</Text>
            <TextInput
              style={[st.nameInput, { height: 64, textAlignVertical: 'top', paddingTop: 10 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="今日の練習について..."
              placeholderTextColor={TEXT.hint}
              multiline
              numberOfLines={2}
              maxLength={200}
            />

            {/* 保存 */}
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
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 40,
    maxHeight: '92%',
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginTop: 10, marginBottom: 6,
  },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  title:     { color: '#fff', fontSize: 17, fontWeight: '800' },
  stepLabel: { color: TEXT.hint, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 16, marginBottom: 8 },

  itemCard: {
    backgroundColor: SURFACE2, borderRadius: 12, padding: 12,
    marginBottom: 10, borderWidth: 1, borderColor: DIVIDER, gap: 8,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemNum:    { color: TEXT.hint, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  nameInput: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    color: '#fff', fontSize: 14,
    borderWidth: 1, borderColor: DIVIDER,
  },
  rowInputs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  numInput: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 10,
    color: '#fff', fontSize: 14, textAlign: 'center',
    borderWidth: 1, borderColor: DIVIDER,
  },
  unitToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,51,51,0.12)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,51,51,0.3)',
  },
  unitText:  { color: BRAND, fontSize: 13, fontWeight: '800' },
  unitLabel: { color: TEXT.secondary, fontSize: 13 },

  addBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,51,51,0.3)', borderRadius: 12, borderStyle: 'dashed' },
  addBtnText: { color: BRAND, fontSize: 14, fontWeight: '700' },

  fatigueRow:       { flexDirection: 'row', gap: 6 },
  fatigueBtn:       { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: DIVIDER, backgroundColor: SURFACE2 },
  fatigueBtnActive: { backgroundColor: '#1a1a1a', borderColor: 'rgba(255,255,255,0.3)' },
  fatigueEmoji:     { fontSize: 22 },
  fatigueLabel:     { fontSize: 10, fontWeight: '600', marginTop: 3 },

  saveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND, borderRadius: 14, paddingVertical: 15, marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
