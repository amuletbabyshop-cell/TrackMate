// app/(tabs)/notebook.tsx — 陸上ノート（テーマ対応版）
import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, FlatList, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Toast from 'react-native-toast-message'
import { useTheme } from '../../context/ThemeContext'
import { Sounds, unlockAudio } from '../../lib/sounds'
import { useRouter } from 'expo-router'
import TrainingChart from '../../components/TrainingChart'
import type { TrainingSession, ChartDataPoint } from '../../types'

const SESSIONS_KEY = 'trackmate_sessions'
const BRAND        = '#E53935'
const MOCK_USER_ID = 'mock-user-1'

const TYPE_INFO: Record<string, { label: string; color: string }> = {
  interval: { label: 'インターバル', color: '#E53935' },
  tempo:    { label: 'テンポ走',     color: '#FF9500' },
  easy:     { label: 'ジョグ',       color: '#34C759' },
  long:     { label: 'ロング走',     color: '#5AC8FA' },
  sprint:   { label: 'スプリント',   color: '#FF3B30' },
  drill:    { label: 'ドリル',       color: '#AF52DE' },
  strength: { label: 'ウェイト',     color: '#FF6B35' },
  race:     { label: '試合',         color: '#FFD700' },
  rest:     { label: '休養',         color: '#5a5a8a' },
}

function fmtTime(ms: number) {
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(2)}"`
  return `${Math.floor(s / 60)}'${(s % 60).toFixed(2).padStart(5, '0')}"`
}
function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`
}

function SessionCard({ session }: { session: TrainingSession }) {
  const { colors } = useTheme()
  const info = TYPE_INFO[session.session_type] ?? { label: session.session_type, color: '#888' }
  return (
    <View style={[st.sessionCard, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
      <View style={[st.typeBar, { backgroundColor: info.color }]} />
      <View style={st.sessionBody}>
        <View style={st.sessionRow}>
          <Text style={[st.typeLabel, { color: info.color }]}>{info.label}</Text>
          {session.event ? <Text style={[st.eventLabel, { color: colors.textSec }]}>{session.event}</Text> : null}
          <Text style={[st.dateLabel, { color: colors.textHint }]}>{session.session_date}</Text>
        </View>
        <View style={st.sessionRow}>
          {session.time_ms   ? <Text style={[st.sessionStat, { color: colors.text }]}>{fmtTime(session.time_ms)}</Text>   : null}
          {session.distance_m? <Text style={[st.sessionStat, { color: colors.text }]}>{fmtDist(session.distance_m)}</Text> : null}
          {session.reps      ? <Text style={[st.sessionStat, { color: colors.text }]}>{session.reps}本</Text>              : null}
          <View style={[st.fatiguePill, { backgroundColor: colors.inputBg }]}>
            <Text style={[st.fatigueNum, { color: colors.textHint }]}>疲労 {session.fatigue_level}/10</Text>
          </View>
        </View>
        {session.notes
          ? <Text style={[st.notesText, { color: colors.textHint }]} numberOfLines={2}>{session.notes}</Text>
          : null}
      </View>
    </View>
  )
}

export default function NotebookScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [freeText, setFreeText] = useState('')
  const [parsing, setParsing]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await AsyncStorage.getItem(SESSIONS_KEY)
      if (raw) setSessions(JSON.parse(raw))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const weekAgo   = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const monthAgo  = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const thisWeek  = sessions.filter(s => s.session_date >= weekAgo)
  const thisMonth = sessions.filter(s => s.session_date >= monthAgo)
  const avgFatigue = thisWeek.length > 0
    ? (thisWeek.reduce((a, s) => a + (s.fatigue_level ?? 5), 0) / thisWeek.length).toFixed(1)
    : '—'
  const totalKm = thisMonth.reduce((a, s) => a + (s.distance_m ?? 0), 0) / 1000

  const chartData: ChartDataPoint[] = sessions
    .filter(s => s.time_ms).slice(0, 7).reverse()
    .map(s => ({ date: s.session_date, value: s.time_ms! / 1000 }))

  async function handleSave() {
    if (!freeText.trim()) return
    setParsing(true)
    try {
      const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY
      const today  = new Date().toISOString().slice(0, 10)
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey || '',
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5', max_tokens: 400,
          messages: [{ role: 'user', content: `陸上競技の練習記録テキストをJSONに変換。今日は${today}。\nテキスト: "${freeText}"\nJSONのみ返答:\n{"session_date":"YYYY-MM-DD","session_type":"interval|tempo|easy|long|sprint|drill|strength|race|rest","event":"100m|200m|400m|110mH|100mH|400mH|800m|1500m|3000m|5000m|10000m|3000mSC|null","time_ms":数値orNull,"distance_m":数値orNull,"reps":数値orNull,"fatigue_level":1-10,"condition_level":1-10}` }],
        }),
      })
      const data   = await res.json()
      const parsed = JSON.parse((data.content?.[0]?.text ?? '{}').replace(/```json|```/g, '').trim())
      const newSession: TrainingSession = {
        id: `local-${Date.now()}`, user_id: MOCK_USER_ID, created_at: new Date().toISOString(),
        session_date:    parsed.session_date    || today,
        session_type:    parsed.session_type    || 'easy',
        event:           parsed.event && parsed.event !== 'null' ? parsed.event : undefined,
        time_ms:         parsed.time_ms         || undefined,
        distance_m:      parsed.distance_m      || undefined,
        reps:            parsed.reps            || undefined,
        fatigue_level:   parsed.fatigue_level   || 5,
        condition_level: parsed.condition_level || 7,
        notes: freeText,
      }
      setSessions(prev => {
        const next = [newSession, ...prev]
        AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(next)).catch(() => {})
        return next
      })
      Sounds.save()
      setFreeText(''); setModal(false)
      Toast.show({ type: 'success', text1: '練習を記録しました ✓', visibilityTime: 1500 })
    } catch {
      Toast.show({ type: 'error', text1: 'AI解析に失敗しました' })
    } finally { setParsing(false) }
  }

  const iconColor = colors.text

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* ── ヘッダー ── */}
        <View style={[st.header, { borderBottomColor: colors.border }]}>
          <Text style={[st.headerTitle, { color: colors.text }]}>陸上ノート</Text>
          <View style={st.headerActions}>
            <TouchableOpacity style={[st.iconBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]} onPress={() => router.push('/gps-run')} activeOpacity={0.8}>
              <Ionicons name="navigate-outline" size={18} color={iconColor} />
            </TouchableOpacity>
            <TouchableOpacity style={[st.iconBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]} onPress={() => router.push('/calendar')} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={18} color={iconColor} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

          {/* ── 統計バー ── */}
          <View style={[st.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {[
              { num: String(sessions.length), label: '総記録' },
              { num: String(thisWeek.length), label: '今週' },
              { num: totalKm > 0 ? `${totalKm.toFixed(0)}km` : '—', label: '今月距離' },
              { num: String(avgFatigue), label: '今週疲労' },
            ].map((item, i) => (
              <View key={i} style={[st.statBox, i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border }]}>
                <Text style={[st.statNum, { color: colors.text }]}>{item.num}</Text>
                <Text style={[st.statLabel, { color: colors.textHint }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* ── 記録ボタン ── */}
          <TouchableOpacity style={st.recordBtn} onPress={() => { unlockAudio(); Sounds.whoosh(); setModal(true) }} activeOpacity={0.85}>
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={st.recordBtnText}>今日の練習を記録する</Text>
          </TouchableOpacity>

          {/* ── チャート ── */}
          {!loading && chartData.length > 0 && (
            <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TrainingChart data={chartData} title="タイム推移（秒）" color={BRAND} unit="秒" isLoading={false} />
            </View>
          )}

          {/* ── 練習記録 ── */}
          <View style={[st.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={st.sectionHeader}>
              <Text style={[st.sectionTitle, { color: colors.text }]}>練習記録</Text>
              <Text style={[st.sectionCount, { color: colors.textHint }]}>{sessions.length}件</Text>
            </View>
            {loading ? (
              <View style={{ gap: 10 }}>
                {[1,2,3].map(i => <View key={i} style={{ height: 64, backgroundColor: colors.surface2, borderRadius: 10 }} />)}
              </View>
            ) : sessions.length === 0 ? (
              <View style={st.empty}>
                <Ionicons name="book-outline" size={40} color={colors.textHint} />
                <Text style={[st.emptyText,    { color: colors.textHint }]}>まだ記録がありません</Text>
                <Text style={[st.emptySubText, { color: colors.textHint }]}>上のボタンから今日の練習を記録しよう</Text>
              </View>
            ) : (
              <FlatList
                data={sessions}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <SessionCard session={item} />}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              />
            )}
          </View>
        </ScrollView>

        {/* ── 入力モーダル ── */}
        <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={st.modalContent}>
                <View style={st.modalHeader}>
                  <TouchableOpacity onPress={() => { setModal(false); setFreeText('') }}>
                    <Text style={{ color: colors.textSec, fontSize: 16 }}>キャンセル</Text>
                  </TouchableOpacity>
                  <Text style={[st.modalTitle, { color: colors.text }]}>練習を記録</Text>
                  <View style={{ width: 60 }} />
                </View>
                <Text style={{ color: colors.textHint, fontSize: 13, marginBottom: 14, lineHeight: 18 }}>
                  自由に書いてください — AIが自動で整理します
                </Text>
                <TextInput
                  style={[st.textInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={freeText}
                  onChangeText={setFreeText}
                  multiline autoFocus
                  placeholder={'例:\n400m × 5本 レスト3分 68秒\n疲労7 脚が重かった\n\n「ジョグ10km」だけでもOK'}
                  placeholderTextColor={colors.textHint}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[st.saveBtn, (!freeText.trim() || parsing) && { opacity: 0.4 }]}
                  onPress={handleSave} disabled={!freeText.trim() || parsing} activeOpacity={0.8}
                >
                  {parsing
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <><Ionicons name="sparkles" size={18} color="#fff" /><Text style={st.saveBtnText}>AIで記録する</Text></>
                  }
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

      </SafeAreaView>
    </View>
  )
}

const st = StyleSheet.create({
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle:   { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn:       { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  scroll:        { padding: 16, gap: 14, paddingBottom: 48 },
  statsRow:      { flexDirection: 'row', borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  statBox:       { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 3 },
  statNum:       { fontSize: 18, fontWeight: '800' },
  statLabel:     { fontSize: 10, fontWeight: '600' },
  recordBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16 },
  recordBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  card:          { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle:  { fontSize: 15, fontWeight: '800' },
  sectionCount:  { fontSize: 13 },
  sessionCard:   { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  typeBar:       { width: 4 },
  sessionBody:   { flex: 1, padding: 12, gap: 5 },
  sessionRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typeLabel:     { fontSize: 12, fontWeight: '800' },
  eventLabel:    { fontSize: 12 },
  dateLabel:     { fontSize: 11, marginLeft: 'auto' as any },
  sessionStat:   { fontSize: 14, fontWeight: '700' },
  fatiguePill:   { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  fatigueNum:    { fontSize: 11 },
  notesText:     { fontSize: 12, lineHeight: 16 },
  empty:         { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText:     { fontSize: 15 },
  emptySubText:  { fontSize: 12, textAlign: 'center' },
  modalContent:  { flex: 1, padding: 20 },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle:    { fontSize: 17, fontWeight: '800' },
  textInput:     { flex: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, lineHeight: 26, borderWidth: 1, marginBottom: 16 },
  saveBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16 },
  saveBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
})
