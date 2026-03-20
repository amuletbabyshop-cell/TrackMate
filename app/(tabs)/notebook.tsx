import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { BG_GRADIENT, NEON, TEXT, GLASS } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import AsyncStorage from '@react-native-async-storage/async-storage'
import DateSelector from '../../components/DateSelector'
import { useRouter } from 'expo-router'
import { Sounds, unlockAudio } from '../../lib/sounds'
import AnimatedSection from '../../components/AnimatedSection'

const SESSIONS_KEY = 'trackmate_sessions'
const BODY_RECORDS_KEY = 'trackmate_body_records'
import TrainingChart from '../../components/TrainingChart'
import type { TrainingSession, SessionType, TrackEvent, ChartDataPoint } from '../../types'

const BRAND = '#E53E3E'
const MOCK_USER_ID = 'mock-user-1'

type BodyRecord = {
  id: string
  date: string    // YYYY-MM-DD
  weight: number  // kg
  fatigue: number // 1-10 (RPE)
  note?: string
}

const SESSION_TYPES: { key: SessionType; label: string; color: string }[] = [
  { key: 'interval', label: 'インターバル', color: '#E53E3E' },
  { key: 'tempo', label: 'テンポ走', color: '#FF9500' },
  { key: 'easy', label: 'ジョグ', color: '#34C759' },
  { key: 'long', label: 'ロング走', color: '#5AC8FA' },
  { key: 'sprint', label: 'スプリント', color: '#FF3B30' },
  { key: 'drill', label: 'ドリル', color: '#AF52DE' },
  { key: 'strength', label: 'ウェイト', color: '#FF6B35' },
  { key: 'race', label: '試合', color: '#FFD700' },
  { key: 'rest', label: '休養', color: '#5a5a8a' },
]

const EVENTS: TrackEvent[] = [
  '100m', '200m', '400m', '110mH', '100mH', '400mH',
  '800m', '1500m', '3000m', '5000m', '10000m', '3000mSC',
]

function SkeletonRect({ height = 16, width = '100%' as number | string, radius = 8 }) {
  const opacity = useRef(new Animated.Value(0.3)).current
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [opacity])
  return (
    <Animated.View
      style={{ height, width: width as number, borderRadius: radius, backgroundColor: '#2a2a2a', opacity }}
    />
  )
}

function SessionCard({ session }: { session: TrainingSession }) {
  const typeInfo = SESSION_TYPES.find(t => t.key === session.session_type)
  const color = typeInfo?.color ?? '#888'

  function fmtTime(ms?: number) {
    if (!ms) return null
    const totalSec = ms / 1000
    if (totalSec < 60) return `${totalSec.toFixed(2)}"`
    const min = Math.floor(totalSec / 60)
    const sec = (totalSec % 60).toFixed(2)
    return `${min}'${sec}"`
  }

  return (
    <View style={styles.sessionCard}>
      <View style={styles.sessionLeft}>
        <View style={[styles.sessionTypeBadge, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.sessionTypeText, { color }]}>{typeInfo?.label ?? session.session_type}</Text>
        </View>
        {session.event ? <Text style={styles.sessionEvent}>{session.event}</Text> : null}
      </View>
      <View style={styles.sessionMid}>
        {session.time_ms ? <Text style={styles.sessionTime}>{fmtTime(session.time_ms)}</Text> : null}
        {session.distance_m ? (
          <Text style={styles.sessionDist}>
            {session.distance_m >= 1000
              ? `${(session.distance_m / 1000).toFixed(1)}km`
              : `${session.distance_m}m`}
          </Text>
        ) : null}
        <Text style={styles.sessionDate}>{session.session_date}</Text>
      </View>
      <View style={styles.sessionRight}>
        <View style={styles.fatigueRow}>
          <Ionicons name="battery-half" size={13} color={TEXT.hint} />
          <Text style={styles.fatigueText}>{session.fatigue_level}/10</Text>
        </View>
      </View>
    </View>
  )
}

function fatigueInfo(v: number): { emoji: string; label: string; color: string } {
  if (v <= 3) return { emoji: '😊', label: '余裕あり', color: '#34C759' }
  if (v <= 6) return { emoji: '😐', label: '普通',     color: '#FF9500' }
  if (v <= 8) return { emoji: '😓', label: '疲れ気味', color: '#FF6B35' }
  return { emoji: '😩', label: '限界', color: '#FF3B30' }
}

function BodyRecordsSection() {
  const today = new Date().toISOString().slice(0, 10)
  const [records, setRecords] = useState<BodyRecord[]>([])
  const [weight, setWeight] = useState('')
  const [bodyFatigue, setBodyFatigue] = useState(5)
  const [bodyNote, setBodyNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(BODY_RECORDS_KEY).then(raw => {
      if (raw) { try { setRecords(JSON.parse(raw)) } catch {} }
    })
  }, [])

  const handleSave = async () => {
    if (!weight || isNaN(parseFloat(weight))) {
      Toast.show({ type: 'error', text1: '体重を入力してください' })
      return
    }
    setSaving(true)
    try {
      const record: BodyRecord = {
        id: `body_${Date.now()}`,
        date: today,
        weight: parseFloat(weight),
        fatigue: bodyFatigue,
        note: bodyNote || undefined,
      }
      const updated = [record, ...records.filter(r => r.date !== today)]
      await AsyncStorage.setItem(BODY_RECORDS_KEY, JSON.stringify(updated))
      setRecords(updated)
      setWeight('')
      setBodyNote('')
      Sounds.save()
      Toast.show({ type: 'success', text1: '体調を記録しました' })
    } catch {
      Toast.show({ type: 'error', text1: '保存に失敗しました' })
    } finally {
      setSaving(false)
    }
  }

  // 直近7日のデータ
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().slice(0, 10)
    const rec = records.find(r => r.date === dateStr)
    return { date: dateStr, dayLabel: `${d.getMonth() + 1}/${d.getDate()}`, rec }
  })

  const weightValues = last7.map(d => d.rec?.weight ?? null)
  const validWeights = weightValues.filter(v => v !== null) as number[]
  const minW = validWeights.length > 0 ? Math.min(...validWeights) - 1 : 50
  const maxW = validWeights.length > 0 ? Math.max(...validWeights) + 1 : 80

  const fi = fatigueInfo(bodyFatigue)

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Ionicons name="body-outline" size={18} color="#4A9FFF" />
        <Text style={styles.sectionTitle}>体調記録</Text>
      </View>

      {/* 入力エリア */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { marginBottom: 4 }]}>体重 (kg)</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="例: 65.5"
              placeholderTextColor="#445577"
            />
          </View>
        </View>

        <Text style={[styles.label, { marginBottom: 4 }]}>
          疲労度 (RPE): <Text style={{ color: fi.color }}>{fi.emoji} {bodyFatigue}/10 {fi.label}</Text>
        </Text>
        <View style={styles.sliderRow}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
            const info = fatigueInfo(n)
            return (
              <TouchableOpacity
                key={n}
                style={[styles.sliderDot, n <= bodyFatigue && { backgroundColor: info.color }]}
                onPress={() => setBodyFatigue(n)}
              />
            )
          })}
        </View>

        <Text style={[styles.label, { marginBottom: 4 }]}>メモ（任意）</Text>
        <TextInput
          style={styles.input}
          value={bodyNote}
          onChangeText={setBodyNote}
          placeholder="体調の気づきなど..."
          placeholderTextColor="#445577"
        />

        <TouchableOpacity
          style={[styles.saveBodyBtn, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Ionicons name="save-outline" size={16} color="#fff" />
          <Text style={styles.saveBodyBtnText}>{saving ? '保存中...' : '今日の体調を保存'}</Text>
        </TouchableOpacity>
      </View>

      {/* 直近7日グラフ */}
      {records.length > 0 && (
        <View style={{ marginTop: 8, gap: 8 }}>
          <Text style={[styles.label, { marginBottom: 2 }]}>直近7日間</Text>
          {/* 体重グラフ（折れ線風） */}
          <View style={{ height: 64, flexDirection: 'row', gap: 2, alignItems: 'flex-end' }}>
            {last7.map(({ dayLabel, rec }) => {
              const hasData = rec !== null && rec !== undefined
              const h = hasData
                ? Math.max(8, ((rec!.weight - minW) / Math.max(maxW - minW, 1)) * 56)
                : 0
              return (
                <View key={dayLabel} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                  <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end' }}>
                    {hasData && (
                      <Text style={{ color: '#4A9FFF', fontSize: 8, textAlign: 'center' }}>
                        {rec!.weight}
                      </Text>
                    )}
                    <View
                      style={{
                        width: '80%', alignSelf: 'center',
                        height: hasData ? h : 3,
                        backgroundColor: hasData ? '#4A9FFF88' : 'rgba(255,255,255,0.08)',
                        borderRadius: 3,
                        borderTopWidth: hasData ? 2 : 0,
                        borderColor: '#4A9FFF',
                      }}
                    />
                  </View>
                  <Text style={{ color: TEXT.hint, fontSize: 9 }}>{dayLabel}</Text>
                </View>
              )
            })}
          </View>
          {/* 疲労度バー */}
          <View style={{ height: 48, flexDirection: 'row', gap: 2, alignItems: 'flex-end' }}>
            {last7.map(({ dayLabel, rec }) => {
              const hasData = rec !== null && rec !== undefined
              const barH = hasData ? Math.max(4, (rec!.fatigue / 10) * 40) : 3
              const fi2 = hasData ? fatigueInfo(rec!.fatigue) : null
              return (
                <View key={dayLabel} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                  <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end' }}>
                    <View
                      style={{
                        width: '80%', alignSelf: 'center',
                        height: barH,
                        backgroundColor: fi2 ? fi2.color + '99' : 'rgba(255,255,255,0.08)',
                        borderRadius: 3,
                      }}
                    />
                  </View>
                </View>
              )
            })}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: TEXT.hint, fontSize: 10 }}>体重 (青)</Text>
            <Text style={{ color: TEXT.hint, fontSize: 10 }}>疲労度 (色バー)</Text>
          </View>
        </View>
      )}
    </View>
  )
}

export default function NotebookScreen() {
  const router = useRouter()
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)

  const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 10))
  const [sessionType, setSessionType] = useState<SessionType>('interval')
  const [event, setEvent] = useState<TrackEvent | ''>('')
  const [timeMin, setTimeMin] = useState('')
  const [timeSec, setTimeSec] = useState('')
  const [distanceM, setDistanceM] = useState('')
  const [reps, setReps] = useState('')
  const [fatigue, setFatigue] = useState(5)
  const [condition, setCondition] = useState(7)
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await AsyncStorage.getItem(SESSIONS_KEY)
      if (raw) setSessions(JSON.parse(raw) as TrainingSession[])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function resetForm() {
    setRecordDate(new Date().toISOString().slice(0, 10))
    setSessionType('interval')
    setEvent('')
    setTimeMin('')
    setTimeSec('')
    setDistanceM('')
    setReps('')
    setFatigue(5)
    setCondition(7)
    setNotes('')
  }

  async function handleSave() {
    setSaving(true)
    try {
      const minN = parseInt(timeMin || '0', 10)
      const secN = parseFloat(timeSec || '0')
      const time_ms = (minN * 60 + secN) * 1000 || undefined

      const payload = {
        user_id: MOCK_USER_ID,
        session_date: recordDate,
        session_type: sessionType,
        event: event || undefined,
        time_ms,
        distance_m: distanceM ? parseInt(distanceM, 10) : undefined,
        reps: reps ? parseInt(reps, 10) : undefined,
        fatigue_level: fatigue,
        condition_level: condition,
        notes: notes || undefined,
      }

      const localSession: TrainingSession = {
        ...payload,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
        fatigue_level: fatigue,
        condition_level: condition,
      }
      const updated = (prevSessions: TrainingSession[]) => [localSession, ...prevSessions]
      setSessions(prev => {
        const next = updated(prev)
        AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(next)).catch(() => {})
        return next
      })
      Sounds.save()
      Toast.show({ type: 'success', text1: '✅ 練習を記録しました' })
      resetForm()
      setModalVisible(false)
    } catch {
      Sounds.error()
      Toast.show({ type: 'error', text1: '保存に失敗しました' })
    } finally {
      setSaving(false)
    }
  }

  const chartData: ChartDataPoint[] = sessions
    .filter(s => s.time_ms)
    .slice(0, 7)
    .reverse()
    .map(s => ({ date: s.session_date, value: s.time_ms! / 1000 }))

  return (
    <View style={{ flex: 1 }}>
    <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>陸上ノート</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => { Sounds.whoosh(); router.push('/calendar') }} activeOpacity={0.8}>
            <Ionicons name="calendar-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => { Sounds.whoosh(); router.push('/workout-menu') }} activeOpacity={0.8}>
            <Ionicons name="barbell-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => { Sounds.whoosh(); router.push('/gps-run') }} activeOpacity={0.8}>
            <Ionicons name="navigate-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => { unlockAudio(); Sounds.whoosh(); setModalVisible(true) }} activeOpacity={0.8}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AnimatedSection delay={0} type="fade-up">
          <BodyRecordsSection />
        </AnimatedSection>

        <AnimatedSection delay={50} type="fade-up">
        {loading ? (
          <View style={styles.card}>
            <SkeletonRect height={20} width="50%" />
            <SkeletonRect height={160} />
          </View>
        ) : chartData.length > 0 ? (
          <View style={styles.card}>
            <TrainingChart
              data={chartData}
              title="タイム推移（秒）"
              color={BRAND}
              unit="秒"
              isLoading={false}
            />
          </View>
        ) : null}
        </AnimatedSection>

        <AnimatedSection delay={150} type="fade-up">
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list" size={18} color={BRAND} />
            <Text style={styles.sectionTitle}>練習記録</Text>
            <Text style={styles.sectionCount}>{sessions.length}件</Text>
          </View>

          {loading ? (
            <View style={{ gap: 10 }}>
              {[1, 2, 3].map(i => <SkeletonRect key={i} height={64} />)}
            </View>
          ) : sessions.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={40} color={TEXT.hint} />
              <Text style={styles.emptyText}>練習記録がありません</Text>
              <Text style={styles.emptySubText}>右下の ＋ボタンから{'\n'}今日の練習を30秒で記録できます</Text>
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
        </AnimatedSection>
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelText}>キャンセル</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>練習を記録</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                  <Text style={[styles.saveText, saving && { opacity: 0.4 }]}>
                    {saving ? '保存中...' : '保存'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>日付</Text>
              <DateSelector date={recordDate} onChange={setRecordDate} />

              <Text style={styles.label}>練習タイプ</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={styles.chipRow}>
                  {SESSION_TYPES.map(t => (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.chip, sessionType === t.key && { backgroundColor: t.color, borderColor: t.color }]}
                      onPress={() => setSessionType(t.key)}
                    >
                      <Text style={[styles.chipText, sessionType === t.key && { color: '#FFFFFF' }]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>種目（任意）</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={styles.chipRow}>
                  {EVENTS.map(e => (
                    <TouchableOpacity
                      key={e}
                      style={[styles.chip, event === e && { backgroundColor: BRAND, borderColor: BRAND }]}
                      onPress={() => setEvent(prev => prev === e ? '' : e)}
                    >
                      <Text style={[styles.chipText, event === e && { color: '#FFFFFF' }]}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>タイム（任意）</Text>
              <View style={styles.timeRow}>
                <View style={styles.timeCol}>
                  <Text style={styles.timeUnit}>分</Text>
                  <TextInput
                    style={styles.timeNumInput}
                    value={timeMin}
                    onChangeText={setTimeMin}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#445577"
                    maxLength={2}
                    textAlign="center"
                  />
                </View>
                <Text style={styles.timeSep}>:</Text>
                <View style={styles.timeCol}>
                  <Text style={styles.timeUnit}>秒</Text>
                  <TextInput
                    style={styles.timeNumInput}
                    value={timeSec}
                    onChangeText={setTimeSec}
                    keyboardType="decimal-pad"
                    placeholder="00.00"
                    placeholderTextColor="#445577"
                    maxLength={5}
                    textAlign="center"
                  />
                </View>
              </View>

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>距離（m）</Text>
                  <TextInput
                    style={styles.input}
                    value={distanceM}
                    onChangeText={setDistanceM}
                    keyboardType="number-pad"
                    placeholder="例: 400"
                    placeholderTextColor="#445577"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>本数</Text>
                  <TextInput
                    style={styles.input}
                    value={reps}
                    onChangeText={setReps}
                    keyboardType="number-pad"
                    placeholder="例: 5"
                    placeholderTextColor="#445577"
                  />
                </View>
              </View>

              <Text style={styles.label}>疲労度: <Text style={{ color: BRAND }}>{fatigue}</Text>/10</Text>
              <View style={styles.sliderRow}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.sliderDot, n <= fatigue && { backgroundColor: BRAND }]}
                    onPress={() => setFatigue(n)}
                  />
                ))}
              </View>

              <Text style={[styles.label, { marginTop: 16 }]}>体調: <Text style={{ color: '#34C759' }}>{condition}</Text>/10</Text>
              <View style={styles.sliderRow}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.sliderDot, n <= condition && { backgroundColor: '#34C759' }]}
                    onPress={() => setCondition(n)}
                  />
                ))}
              </View>

              <Text style={[styles.label, { marginTop: 16 }]}>メモ（任意）</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                placeholder="今日の練習について..."
                placeholderTextColor="#445577"
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { color: TEXT.primary, fontSize: 20, fontWeight: '800' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#222', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  card: { backgroundColor: '#111111', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { color: TEXT.primary, fontSize: 15, fontWeight: '700', flex: 1 },
  sectionCount: { color: TEXT.hint, fontSize: 13 },
  sessionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(74,159,255,0.12)', borderRadius: 10, padding: 12, gap: 10 },
  sessionLeft: { gap: 4, minWidth: 80 },
  sessionTypeBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  sessionTypeText: { fontSize: 11, fontWeight: '700' },
  sessionEvent: { color: TEXT.secondary, fontSize: 12 },
  sessionMid: { flex: 1, gap: 2 },
  sessionTime: { color: TEXT.primary, fontSize: 16, fontWeight: '700' },
  sessionDist: { color: TEXT.secondary, fontSize: 13 },
  sessionDate: { color: TEXT.hint, fontSize: 11 },
  sessionRight: { alignItems: 'flex-end' },
  fatigueRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  fatigueText: { color: TEXT.secondary, fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText: { color: TEXT.hint, fontSize: 14 },
  emptySubText: { color: TEXT.secondary, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  modalSafe: { flex: 1, backgroundColor: '#000000' },
  modalContent: { padding: 20, paddingBottom: 40, gap: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: TEXT.primary, fontSize: 17, fontWeight: '700' },
  cancelText: { color: TEXT.secondary, fontSize: 16 },
  saveText: { color: BRAND, fontSize: 16, fontWeight: '700' },
  label: { color: TEXT.secondary, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#FFFFFF', fontSize: 15, borderWidth: 1, borderColor: 'rgba(74,159,255,0.3)' },
  textArea: { height: 90, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)' },
  chipText: { color: TEXT.secondary, fontSize: 13, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
  timeCol: { flex: 1, gap: 4 },
  timeNumInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#FFFFFF', fontSize: 18, fontWeight: '700', borderWidth: 1, borderColor: 'rgba(74,159,255,0.3)' },
  timeUnit: { color: TEXT.secondary, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  timeSep: { color: TEXT.secondary, fontSize: 24, fontWeight: '300', paddingBottom: 10 },
  row2: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  sliderRow: { flexDirection: 'row', gap: 6 },
  sliderDot: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
  saveBodyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4A9FFF', borderRadius: 10, paddingVertical: 12 },
  saveBodyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
