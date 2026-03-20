import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform, Animated, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Toast from 'react-native-toast-message'
import { BG_GRADIENT, BRAND, TEXT, NEON } from '../../lib/theme'
import { Sounds, unlockAudio } from '../../lib/sounds'
import AnimatedSection from '../../components/AnimatedSection'
import DateSelector from '../../components/DateSelector'
import TrainingChart from '../../components/TrainingChart'
import type { RaceRecord, AthleticsEvent, ChartDataPoint } from '../../types'
import { exportAllDataCSV, exportAllDataJSON } from '../../lib/export'

const RECORDS_KEY = 'trackmate_race_records'
const MOCK_USER_ID = 'mock-user-1'

// ── 種目定義 ──────────────────────────────────────────────────────
const TRACK_EVENTS: AthleticsEvent[] = [
  '100m','200m','400m','800m','1500m','3000m',
  '5000m','10000m','110mH','100mH','400mH','3000mSC',
  'half_marathon','marathon',
]
const FIELD_EVENTS: AthleticsEvent[] = [
  '走幅跳','三段跳','走高跳','棒高跳',
  '砲丸投','やり投','円盤投','ハンマー投',
]
const ALL_EVENTS: AthleticsEvent[] = [...TRACK_EVENTS, ...FIELD_EVENTS]

const WIND_EVENTS: AthleticsEvent[] = ['100m','200m','110mH','100mH','走幅跳','三段跳']
const FIELD_EVENT_SET = new Set<AthleticsEvent>(FIELD_EVENTS)

function isField(e: AthleticsEvent) { return FIELD_EVENT_SET.has(e) }
function hasWind(e: AthleticsEvent)  { return WIND_EVENTS.includes(e) }

// ── フォーマット ──────────────────────────────────────────────────
function msToDisplay(ms: number, event: AthleticsEvent): string {
  if (isField(event)) return ''
  const totalSec = ms / 1000
  if (totalSec < 60) return totalSec.toFixed(2)
  const min = Math.floor(totalSec / 60)
  const sec = (totalSec % 60).toFixed(2).padStart(5, '0')
  if (totalSec < 3600) return `${min}:${sec}`
  const hr = Math.floor(min / 60)
  const m  = min % 60
  return `${hr}:${String(m).padStart(2,'0')}:${sec}`
}
function cmToDisplay(cm: number): string {
  const m = Math.floor(cm / 100)
  const rest = cm % 100
  return `${m}m${String(rest).padStart(2,'0')}`
}

// ── パース (入力 → ms/cm) ─────────────────────────────────────────
function parseTrackInput(min: string, sec: string): number {
  const m = parseInt(min || '0', 10)
  const s = parseFloat(sec || '0')
  return Math.round((m * 60 + s) * 1000)
}
function parseFieldInput(meter: string, cm: string): number {
  return parseInt(meter || '0', 10) * 100 + parseInt(cm || '0', 10)
}

// ── スケルトン ────────────────────────────────────────────────────
function SkeletonRect({ h = 16, w = '100%' as any }) {
  const op = useRef(new Animated.Value(0.3)).current
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.9, duration: 700, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.3, duration: 700, useNativeDriver: true }),
    ]))
    a.start(); return () => a.stop()
  }, [op])
  return <Animated.View style={{ height: h, width: w, borderRadius: 8, backgroundColor: '#1e2a3a', opacity: op }} />
}

// ── PBバッジ ──────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  )
}

// ── 記録カード ────────────────────────────────────────────────────
function RecordCard({ record, onDelete }: { record: RaceRecord; onDelete: () => void }) {
  const router = useRouter()
  return (
    <View style={[styles.recordCard, record.is_pb && styles.recordCardPB]}>
      <View style={styles.recordLeft}>
        <View style={styles.eventBadgeWrap}>
          <Text style={styles.eventBadgeText}>{record.event}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
          {record.is_pb && <Badge label="PB" color={NEON.green} />}
          {record.is_sb && !record.is_pb && <Badge label="SB" color={NEON.blue} />}
        </View>
      </View>

      <View style={styles.recordMid}>
        <Text style={[styles.recordResult, record.is_pb && { color: NEON.green }]}>
          {record.result_display}
        </Text>
        {record.wind_ms !== undefined && (
          <Text style={styles.windText}>
            {record.wind_ms >= 0 ? `+${record.wind_ms}` : record.wind_ms}m/s
          </Text>
        )}
        {record.competition_name
          ? <Text style={styles.recordVenue} numberOfLines={1}>{record.competition_name}</Text>
          : record.venue
            ? <Text style={styles.recordVenue} numberOfLines={1}>{record.venue}</Text>
            : null}
      </View>

      <View style={styles.recordRight}>
        <Text style={styles.recordDate}>{record.race_date}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {record.is_pb && (
            <TouchableOpacity onPress={() => router.push({ pathname: '/share-card', params: { recordId: record.id } })} style={{ padding: 4 }}>
              <Ionicons name="share-outline" size={14} color={NEON.blue} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
            <Ionicons name="trash-outline" size={14} color={TEXT.hint} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

// ── PBサマリーカード ───────────────────────────────────────────────
function PBSummary({ records }: { records: RaceRecord[] }) {
  // 種目ごとのPBを取得
  const pbMap = new Map<string, RaceRecord>()
  records.filter(r => r.is_pb).forEach(r => {
    if (!pbMap.has(r.event)) pbMap.set(r.event, r)
  })
  const pbs = Array.from(pbMap.values())
  if (pbs.length === 0) return null

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="trophy" size={16} color={NEON.green} />
        <Text style={styles.cardTitle}>自己ベスト一覧</Text>
      </View>
      <View style={styles.pbGrid}>
        {pbs.map(r => (
          <View key={r.id} style={styles.pbItem}>
            <Text style={styles.pbEvent}>{r.event}</Text>
            <Text style={styles.pbResult}>{r.result_display}</Text>
            <Text style={styles.pbDate}>{r.race_date}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ── メイン ────────────────────────────────────────────────────────
export default function RecordsScreen() {
  const router = useRouter()
  const [records, setRecords] = useState<RaceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [filterEvent, setFilterEvent] = useState<AthleticsEvent | '全種目'>('全種目')
  const [chartEvent, setChartEvent] = useState<AthleticsEvent | null>(null)

  // フォーム状態
  const [fEvent, setFEvent]   = useState<AthleticsEvent>('100m')
  const [fDate, setFDate]     = useState(new Date().toISOString().slice(0, 10))
  const [fMin, setFMin]       = useState('')
  const [fSec, setFSec]       = useState('')
  const [fMeter, setFMeter]   = useState('')
  const [fCm, setFCm]         = useState('')
  const [fWind, setFWind]     = useState('')
  const [fVenue, setFVenue]   = useState('')
  const [fComp, setFComp]     = useState('')
  const [fIsPB, setFIsPB]     = useState(false)
  const [fIsSB, setFIsSB]     = useState(false)
  const [fNotes, setFNotes]   = useState('')
  const [saving, setSaving]   = useState(false)

  // ロード
  useEffect(() => {
    AsyncStorage.getItem(RECORDS_KEY).then(raw => {
      if (raw) {
        try { setRecords(JSON.parse(raw)) } catch { /* ignore */ }
      }
      setLoading(false)
    })
  }, [])

  function resetForm() {
    setFEvent('100m'); setFDate(new Date().toISOString().slice(0, 10))
    setFMin(''); setFSec(''); setFMeter(''); setFCm(''); setFWind('')
    setFVenue(''); setFComp(''); setFIsPB(false); setFIsSB(false); setFNotes('')
  }

  const handleSave = useCallback(async () => {
    const field = isField(fEvent)
    const result_ms  = field ? undefined : parseTrackInput(fMin, fSec)
    const result_cm  = field ? parseFieldInput(fMeter, fCm) : undefined
    if (!field && (!result_ms || result_ms <= 0)) {
      Toast.show({ type: 'error', text1: 'タイムを入力してください' }); return
    }
    if (field && (!result_cm || result_cm <= 0)) {
      Toast.show({ type: 'error', text1: '記録を入力してください' }); return
    }

    const display = field
      ? cmToDisplay(result_cm!)
      : msToDisplay(result_ms!, fEvent)

    setSaving(true)
    try {
      const newRec: RaceRecord = {
        id: `rec_${Date.now()}`,
        user_id: MOCK_USER_ID,
        event: fEvent,
        result_display: display,
        result_ms,
        result_cm,
        race_date: fDate,
        venue: fVenue || undefined,
        competition_name: fComp || undefined,
        wind_ms: fWind !== '' ? parseFloat(fWind) : undefined,
        is_pb: fIsPB,
        is_sb: fIsSB,
        notes: fNotes || undefined,
        created_at: new Date().toISOString(),
      }
      const updated = [newRec, ...records].sort((a, b) => b.race_date.localeCompare(a.race_date))
      await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(updated))
      setRecords(updated)
      if (fIsPB) { Sounds.pb() } else { Sounds.save() }
      Toast.show({ type: 'success', text1: `✅ ${fEvent}  ${display}${fIsPB ? '  🏆 PB！' : ''}` })
      resetForm(); setModalVisible(false)
    } catch {
      Sounds.error()
      Toast.show({ type: 'error', text1: '保存に失敗しました' })
    } finally { setSaving(false) }
  }, [fEvent, fDate, fMin, fSec, fMeter, fCm, fWind, fVenue, fComp, fIsPB, fIsSB, fNotes, records])

  const handleDelete = useCallback(async (id: string) => {
    Sounds.delete()
    const updated = records.filter(r => r.id !== id)
    await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(updated))
    setRecords(updated)
  }, [records])

  // フィルター適用
  const filtered = filterEvent === '全種目'
    ? records
    : records.filter(r => r.event === filterEvent)

  // 記録のある種目リスト
  const usedEvents = Array.from(new Set(records.map(r => r.event)))

  // グラフデータ（選択種目のタイム推移）
  const targetEvent = chartEvent ?? (usedEvents.find(e => !isField(e)) ?? null)
  const chartData: ChartDataPoint[] = targetEvent
    ? records
        .filter(r => r.event === targetEvent && r.result_ms)
        .slice(0, 8).reverse()
        .map(r => ({ date: r.race_date, value: r.result_ms! / 1000 }))
    : []

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>

        {/* ── ヘッダー ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>記録管理</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                Sounds.whoosh()
                Alert.alert('エクスポート', '形式を選択してください', [
                  {
                    text: 'CSV',
                    onPress: () => {
                      exportAllDataCSV().catch(() => Toast.show({ type: 'error', text1: 'エクスポートに失敗しました' }))
                    },
                  },
                  {
                    text: 'JSON',
                    onPress: () => {
                      exportAllDataJSON().catch(() => Toast.show({ type: 'error', text1: 'エクスポートに失敗しました' }))
                    },
                  },
                  { text: 'キャンセル', style: 'cancel' },
                ])
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="download-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => { Sounds.whoosh(); router.push('/video-analysis') }} activeOpacity={0.8}>
              <Ionicons name="film-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => { Sounds.whoosh(); router.push('/timer') }} activeOpacity={0.8}>
              <Ionicons name="timer-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => { Sounds.whoosh(); router.push('/ranking') }} activeOpacity={0.8}>
              <Ionicons name="podium-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={() => { unlockAudio(); Sounds.whoosh(); setModalVisible(true) }} activeOpacity={0.8}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* ── PBサマリー ── */}
          <AnimatedSection delay={0} type="fade-up">
          {loading ? (
            <View style={styles.card}><SkeletonRect h={80} /></View>
          ) : (
            <PBSummary records={records} />
          )}
          </AnimatedSection>

          {/* ── タイム推移グラフ ── */}
          {!loading && chartData.length >= 2 && (
            <AnimatedSection delay={80} type="fade-up">
            <View style={styles.card}>
              {/* 種目切替 */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {usedEvents.filter(e => !isField(e)).map(e => (
                    <TouchableOpacity
                      key={e}
                      style={[styles.filterChip, (targetEvent === e) && styles.filterChipActive]}
                      onPress={() => setChartEvent(e)}
                    >
                      <Text style={[styles.filterChipText, (targetEvent === e) && styles.filterChipTextActive]}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <TrainingChart
                data={chartData}
                title={`${targetEvent} タイム推移`}
                color={BRAND}
                unit="秒"
                isLoading={false}
              />
            </View>
            </AnimatedSection>
          )}

          {/* ── 種目フィルター ── */}
          {!loading && records.length > 0 && (
            <AnimatedSection delay={160} type="fade-up">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6, paddingBottom: 4 }}>
                {(['全種目', ...usedEvents] as const).map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.filterChip, filterEvent === e && styles.filterChipActive]}
                    onPress={() => setFilterEvent(e as any)}
                  >
                    <Text style={[styles.filterChipText, filterEvent === e && styles.filterChipTextActive]}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            </AnimatedSection>
          )}

          {/* ── 記録リスト ── */}
          <AnimatedSection delay={240} type="fade-up">
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="list" size={16} color={BRAND} />
              <Text style={styles.cardTitle}>記録一覧</Text>
              <Text style={styles.countText}>{filtered.length}件</Text>
            </View>

            {loading ? (
              <View style={{ gap: 8 }}>
                {[1,2,3].map(i => <SkeletonRect key={i} h={64} />)}
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="timer-outline" size={40} color={TEXT.hint} />
                <Text style={styles.emptyText}>まだ記録がありません</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
                  <Text style={styles.emptyBtnText}>最初の記録を追加</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {filtered.map(r => (
                  <RecordCard key={r.id} record={r} onDelete={() => handleDelete(r.id)} />
                ))}
              </View>
            )}
          </View>
          </AnimatedSection>

        </ScrollView>

        {/* ── 記録追加モーダル ── */}
        <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.modalSafe}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>

                {/* ヘッダー */}
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => { resetForm(); setModalVisible(false) }}>
                    <Text style={styles.cancelText}>キャンセル</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>記録を追加</Text>
                  <TouchableOpacity onPress={handleSave} disabled={saving}>
                    <Text style={[styles.saveText, saving && { opacity: 0.4 }]}>{saving ? '保存中...' : '保存'}</Text>
                  </TouchableOpacity>
                </View>

                {/* 日付 */}
                <Text style={styles.label}>日付</Text>
                <DateSelector date={fDate} onChange={setFDate} />

                {/* 種目 */}
                <Text style={styles.label}>種目</Text>
                <Text style={styles.subLabel}>トラック</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  <View style={styles.chipRow}>
                    {TRACK_EVENTS.map(e => (
                      <TouchableOpacity key={e} style={[styles.chip, fEvent === e && styles.chipActive]} onPress={() => setFEvent(e)}>
                        <Text style={[styles.chipText, fEvent === e && styles.chipTextActive]}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <Text style={styles.subLabel}>フィールド</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={styles.chipRow}>
                    {FIELD_EVENTS.map(e => (
                      <TouchableOpacity key={e} style={[styles.chip, fEvent === e && styles.chipActive]} onPress={() => setFEvent(e)}>
                        <Text style={[styles.chipText, fEvent === e && styles.chipTextActive]}>{e}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* タイム or 記録 */}
                {isField(fEvent) ? (
                  <>
                    <Text style={styles.label}>記録</Text>
                    <View style={styles.timeRow}>
                      <View style={styles.timeCol}>
                        <Text style={styles.timeUnit}>m</Text>
                        <TextInput style={styles.timeNumInput} value={fMeter} onChangeText={setFMeter}
                          keyboardType="number-pad" placeholder="7" placeholderTextColor="#445577" textAlign="center" />
                      </View>
                      <Text style={styles.timeSep}>.</Text>
                      <View style={styles.timeCol}>
                        <Text style={styles.timeUnit}>cm</Text>
                        <TextInput style={styles.timeNumInput} value={fCm} onChangeText={setFCm}
                          keyboardType="number-pad" placeholder="32" placeholderTextColor="#445577" maxLength={2} textAlign="center" />
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>タイム</Text>
                    <View style={styles.timeRow}>
                      <View style={styles.timeCol}>
                        <Text style={styles.timeUnit}>分</Text>
                        <TextInput style={styles.timeNumInput} value={fMin} onChangeText={setFMin}
                          keyboardType="number-pad" placeholder="0" placeholderTextColor="#445577" maxLength={2} textAlign="center" />
                      </View>
                      <Text style={styles.timeSep}>:</Text>
                      <View style={styles.timeCol}>
                        <Text style={styles.timeUnit}>秒</Text>
                        <TextInput style={styles.timeNumInput} value={fSec} onChangeText={setFSec}
                          keyboardType="decimal-pad" placeholder="10.85" placeholderTextColor="#445577" maxLength={5} textAlign="center" />
                      </View>
                    </View>
                  </>
                )}

                {/* 風速 */}
                {hasWind(fEvent) && (
                  <>
                    <Text style={styles.label}>風速（m/s）</Text>
                    <TextInput style={styles.input} value={fWind} onChangeText={setFWind}
                      keyboardType="decimal-pad" placeholder="例: +1.2 / -0.5" placeholderTextColor="#445577" />
                  </>
                )}

                {/* PB / SB トグル */}
                <View style={styles.toggleRow}>
                  <TouchableOpacity style={[styles.toggleBtn, fIsPB && styles.toggleBtnPB]} onPress={() => { fIsPB ? Sounds.toggleOff() : Sounds.toggleOn(); setFIsPB(v => !v); if (!fIsPB) setFIsSB(false) }}>
                    <Ionicons name={fIsPB ? 'trophy' : 'trophy-outline'} size={16} color={fIsPB ? NEON.green : TEXT.secondary} />
                    <Text style={[styles.toggleText, fIsPB && { color: NEON.green }]}>PB（自己ベスト）</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.toggleBtn, fIsSB && styles.toggleBtnSB]} onPress={() => { fIsSB ? Sounds.toggleOff() : Sounds.toggleOn(); setFIsSB(v => !v); if (!fIsSB) setFIsPB(false) }}>
                    <Ionicons name={fIsSB ? 'star' : 'star-outline'} size={16} color={fIsSB ? NEON.blue : TEXT.secondary} />
                    <Text style={[styles.toggleText, fIsSB && { color: NEON.blue }]}>SB（シーズンベスト）</Text>
                  </TouchableOpacity>
                </View>

                {/* 大会名・会場 */}
                <Text style={styles.label}>大会名（任意）</Text>
                <TextInput style={styles.input} value={fComp} onChangeText={setFComp}
                  placeholder="例: 春季陸上競技大会" placeholderTextColor="#445577" />

                <Text style={styles.label}>会場（任意）</Text>
                <TextInput style={styles.input} value={fVenue} onChangeText={setFVenue}
                  placeholder="例: 国立競技場" placeholderTextColor="#445577" />

                {/* メモ */}
                <Text style={styles.label}>メモ（任意）</Text>
                <TextInput style={[styles.input, styles.textArea]} value={fNotes} onChangeText={setFNotes}
                  multiline numberOfLines={3} placeholder="コンディション・気づきなど..." placeholderTextColor="#445577" />

              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

      </SafeAreaView>
    </View>
  )
}

// ── スタイル ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: 'transparent' },
  scroll:  { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  headerTitle: { color: TEXT.primary, fontSize: 20, fontWeight: '800' },
  addBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#222', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },

  card:    { backgroundColor: '#111111', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle:  { color: TEXT.primary, fontSize: 15, fontWeight: '700', flex: 1 },
  countText:  { color: TEXT.hint, fontSize: 13 },

  // PBサマリー
  pbGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pbItem:  { backgroundColor: 'rgba(52,199,89,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(52,199,89,0.25)', padding: 10, minWidth: 90, alignItems: 'center' },
  pbEvent: { color: TEXT.secondary, fontSize: 11, fontWeight: '600', marginBottom: 2 },
  pbResult:{ color: NEON.green, fontSize: 16, fontWeight: '800' },
  pbDate:  { color: TEXT.hint, fontSize: 10, marginTop: 2 },

  // 記録カード
  recordCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(74,159,255,0.12)', padding: 12, gap: 10 },
  recordCardPB: { borderColor: 'rgba(52,199,89,0.4)', backgroundColor: 'rgba(52,199,89,0.05)' },
  recordLeft:   { width: 62, gap: 4 },
  eventBadgeWrap: { backgroundColor: `${BRAND}22`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  eventBadgeText: { color: BRAND, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  badge:        { borderRadius: 4, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText:    { fontSize: 10, fontWeight: '800' },
  recordMid:    { flex: 1, gap: 2 },
  recordResult: { color: TEXT.primary, fontSize: 22, fontWeight: '800' },
  windText:     { color: TEXT.hint, fontSize: 11 },
  recordVenue:  { color: TEXT.secondary, fontSize: 12 },
  recordRight:  { alignItems: 'flex-end', gap: 6 },
  recordDate:   { color: TEXT.hint, fontSize: 11 },

  // フィルター
  filterChip:       { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  filterChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  filterChipText:   { color: TEXT.secondary, fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#FFFFFF' },

  // 空状態
  empty:      { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText:  { color: TEXT.hint, fontSize: 14 },
  emptyBtn:   { backgroundColor: BRAND, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // モーダル
  modalSafe:    { flex: 1, backgroundColor: '#000000' },
  modalContent: { padding: 20, paddingBottom: 48, gap: 4 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle:   { color: TEXT.primary, fontSize: 17, fontWeight: '700' },
  cancelText:   { color: TEXT.secondary, fontSize: 16 },
  saveText:     { color: BRAND, fontSize: 16, fontWeight: '700' },

  label:    { color: TEXT.secondary, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  subLabel: { color: TEXT.hint, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  input:    { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#FFFFFF', fontSize: 15, borderWidth: 1, borderColor: 'rgba(74,159,255,0.3)', marginBottom: 14 },
  textArea: { height: 80, textAlignVertical: 'top' },

  chipRow:      { flexDirection: 'row', gap: 8 },
  chip:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)' },
  chipActive:   { backgroundColor: BRAND, borderColor: BRAND },
  chipText:     { color: TEXT.secondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },

  timeRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 },
  timeCol:     { flex: 1, gap: 4 },
  timeNumInput:{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#FFFFFF', fontSize: 20, fontWeight: '700', borderWidth: 1, borderColor: 'rgba(74,159,255,0.3)' },
  timeUnit:    { color: TEXT.secondary, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  timeSep:     { color: TEXT.secondary, fontSize: 24, fontWeight: '300', paddingBottom: 10 },

  toggleRow:   { flexDirection: 'row', gap: 8, marginBottom: 14 },
  toggleBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  toggleBtnPB: { backgroundColor: 'rgba(52,199,89,0.1)', borderColor: NEON.green },
  toggleBtnSB: { backgroundColor: 'rgba(74,159,255,0.1)', borderColor: NEON.blue },
  toggleText:  { color: TEXT.secondary, fontSize: 12, fontWeight: '600' },
})
