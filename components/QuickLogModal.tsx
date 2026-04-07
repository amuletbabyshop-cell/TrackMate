// components/QuickLogModal.tsx — AI自由入力版
import React, { useState, useRef } from 'react'
import {
  Modal, View, Text, TouchableOpacity, TextInput,
  StyleSheet, Animated, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { BRAND, TEXT } from '../lib/theme'
import { Sounds, unlockAudio } from '../lib/sounds'
import Toast from 'react-native-toast-message'

const SESSIONS_KEY = 'trackmate_sessions'
const TASKS_KEY    = 'trackmate_tasks'

/** セッション内容に基づいてルールベースの改善タスクを生成 */
function generateTasks(sessionType: string, fatigueLevel: number, notes: string): string[] {
  const tasks: string[] = []

  // 疲労が高い → 回復系タスク
  if (fatigueLevel >= 8) {
    tasks.push('今夜は7時間以上の睡眠を確保しよう')
    tasks.push('アイスバスまたは軽いストレッチで回復を促そう')
  } else if (fatigueLevel >= 6) {
    tasks.push('練習後のストレッチを10分しっかり行おう')
  }

  // 種目別タスク
  if (sessionType === 'interval' || sessionType === 'sprint') {
    tasks.push('次の練習は軽いジョグか休養にしよう（インターバル翌日）')
  } else if (sessionType === 'long') {
    tasks.push('長距離後は糖質+たんぱく質の補給を忘れずに')
  } else if (sessionType === 'race') {
    tasks.push('レース後は2〜3日間は強度を落として調整しよう')
  } else if (sessionType === 'strength') {
    tasks.push('筋トレ後は48時間の筋肉回復時間を確保しよう')
  }

  // ノートに特定キーワードがあれば
  if (notes.includes('痛') || notes.includes('違和感')) {
    tasks.push('痛みや違和感が続く場合は早めに医師に相談しよう')
  }

  return tasks.slice(0, 3)
}

async function saveTasks(newTexts: string[]) {
  if (newTexts.length === 0) return
  try {
    const raw = await AsyncStorage.getItem(TASKS_KEY)
    const existing = raw ? JSON.parse(raw) : []
    const newTasks = newTexts.map(text => ({
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text,
      completed: false,
      created_at: new Date().toISOString(),
    }))
    const merged = [...newTasks, ...existing].slice(0, 20)  // 最大20件
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(merged))
  } catch { /* ignore */ }
}

interface Props {
  visible: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function QuickLogModal({ visible, onClose, onSaved }: Props) {
  const [freeText, setFreeText] = useState('')
  const [parsing, setParsing]   = useState(false)

  const slideAnim = useRef(new Animated.Value(300)).current

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }).start()
    } else {
      slideAnim.setValue(300)
    }
  }, [visible])

  function handleClose() {
    setFreeText('')
    onClose()
  }

  async function handleSave() {
    if (!freeText.trim()) return
    unlockAudio()
    setParsing(true)

    const today = new Date().toISOString().slice(0, 10)

    // ── Step 1: AI解析（失敗しても続行） ──────────────────
    let parsed: Record<string, any> = {}
    try {
      const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY
      if (apiKey) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 400,
            messages: [{
              role: 'user',
              content: `陸上競技の練習記録テキストをJSONに変換。今日は${today}。

テキスト: "${freeText}"

JSONのみ返答（説明不要）:
{"session_date":"YYYY-MM-DD","session_type":"interval|tempo|easy|long|sprint|drill|strength|race|rest","event":"100m|200m|400m|110mH|100mH|400mH|800m|1500m|3000m|5000m|10000m|3000mSC|null","time_ms":数値orNull,"distance_m":数値orNull,"reps":数値orNull,"fatigue_level":1-10,"condition_level":1-10}`,
            }],
          }),
        })
        if (res.ok) {
          const data = await res.json()
          const text = data.content?.[0]?.text ?? ''
          parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
        }
      }
    } catch {
      // AI解析失敗 → フォールバックで保存継続
    }

    // ── Step 2: 必ず保存 ──────────────────────────────────
    try {
      const existing = await AsyncStorage.getItem(SESSIONS_KEY)
      const sessions = existing ? JSON.parse(existing) : []

      sessions.unshift({
        id:              `ql_${Date.now()}`,
        user_id:         'mock-user-1',
        session_date:    parsed.session_date    || today,
        session_type:    parsed.session_type    || 'easy',
        event:           parsed.event && parsed.event !== 'null' ? parsed.event : undefined,
        time_ms:         parsed.time_ms         || undefined,
        distance_m:      parsed.distance_m      || undefined,
        reps:            parsed.reps            || undefined,
        fatigue_level:   parsed.fatigue_level   || 5,
        condition_level: parsed.condition_level || 7,
        notes:           freeText,
        created_at:      new Date().toISOString(),
      })

      await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))

      // 改善タスクを自動生成してホーム画面に表示
      const taskTexts = generateTasks(
        parsed.session_type || 'easy',
        parsed.fatigue_level || 5,
        freeText,
      )
      await saveTasks(taskTexts)

      Sounds.save()
      Toast.show({ type: 'success', text1: '練習を記録しました ✓', visibilityTime: 1800 })
      setFreeText('')
      onSaved?.()
      onClose()
    } catch {
      Toast.show({ type: 'error', text1: '保存に失敗しました', text2: 'もう一度試してください' })
    } finally {
      setParsing(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={st.kvWrapper}
        pointerEvents="box-none"
      >
        <Animated.View style={[st.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={st.handle} />
          <View style={st.header}>
            <Text style={st.title}>今日の練習を記録</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={TEXT.secondary} />
            </TouchableOpacity>
          </View>

          <Text style={st.hint}>
            自由に入力してください — AIが自動で整理します
          </Text>

          <TextInput
            style={st.input}
            value={freeText}
            onChangeText={setFreeText}
            multiline
            autoFocus
            placeholder={'例:\n400m × 5本 レスト3分 68秒\n疲労7 脚が重かった\n\n「ジョグ10km」だけでもOK'}
            placeholderTextColor={TEXT.hint}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[st.saveBtn, (!freeText.trim() || parsing) && { opacity: 0.4 }]}
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={!freeText.trim() || parsing}
          >
            {parsing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={st.saveBtnText}>AIで記録する</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const st = StyleSheet.create({
  overlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  kvWrapper:  { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 40,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginTop: 10, marginBottom: 6,
  },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  title:      { color: '#fff', fontSize: 17, fontWeight: '800' },
  hint:       { color: TEXT.hint, fontSize: 13, marginBottom: 12, lineHeight: 18 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: '#fff', fontSize: 15, lineHeight: 24,
    borderWidth: 1, borderColor: 'rgba(74,159,255,0.3)',
    height: 160,
    marginBottom: 16,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
