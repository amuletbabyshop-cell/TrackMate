import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { BG_GRADIENT, NEON, TEXT } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Sounds, unlockAudio } from '../../lib/sounds'
import AnimatedSection from '../../components/AnimatedSection'
import DateSelector from '../../components/DateSelector'
import WheelPicker from '../../components/WheelPicker'
import TrainingChart from '../../components/TrainingChart'
import type { SleepRecord, ChartDataPoint } from '../../types'

const BRAND = '#E53E3E'
const MOCK_USER_ID = 'mock-user-1'
const SLEEP_KEY = 'trackmate_sleep'

// ── ホイール用データ ─────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINS  = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const QUALITY_ITEMS = Array.from({ length: 10 }, (_, i) => String(i + 1))

// ── ユーティリティ ──────────────────────────────────────────
function qualityColor(q: number) {
  if (q >= 8) return '#34C759'
  if (q >= 5) return '#FF9500'
  return BRAND
}

function fmtDuration(min?: number) {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}時間${m > 0 ? m + '分' : ''}` : `${m}分`
}

// ── スケルトン ──────────────────────────────────────────────
function SkeletonRect({ height = 16, width = '100%' as number | string }) {
  const opacity = useRef(new Animated.Value(0.3)).current
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
    ]))
    a.start(); return () => a.stop()
  }, [opacity])
  return <Animated.View style={{ height, width: width as number, borderRadius: 8, backgroundColor: '#2a2a2a', opacity }} />
}

// ── 睡眠履歴カード ─────────────────────────────────────────
function SleepCard({ record }: { record: SleepRecord }) {
  const color = qualityColor(record.quality_score)
  return (
    <View style={styles.sleepCard}>
      <View style={styles.sleepLeft}>
        <Text style={styles.sleepDate}>{record.sleep_date}</Text>
        {record.duration_min ? (
          <Text style={styles.sleepDuration}>{fmtDuration(record.duration_min)}</Text>
        ) : null}
      </View>
      <View style={[styles.qualityBadge, { borderColor: color }]}>
        <Text style={[styles.qualityValue, { color }]}>{record.quality_score}</Text>
        <Text style={styles.qualityMax}>/10</Text>
      </View>
      {record.notes ? <Text style={styles.sleepNotes} numberOfLines={1}>{record.notes}</Text> : null}
    </View>
  )
}

// ── メイン ─────────────────────────────────────────────────
export default function SleepScreen() {
  const [records, setRecords] = useState<SleepRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 10))

  // ホイール index
  const [bedHourIdx,  setBedHourIdx]  = useState(23)
  const [bedMinIdx,   setBedMinIdx]   = useState(0)
  const [wakeHourIdx, setWakeHourIdx] = useState(6)
  const [wakeMinIdx,  setWakeMinIdx]  = useState(30)
  const [qualityIdx,  setQualityIdx]  = useState(6)  // 7/10
  const [notes, setNotes] = useState('')

  // 導出値
  const quality = qualityIdx + 1
  const bedLabel  = `${HOURS[bedHourIdx]}:${MINS[bedMinIdx]}`
  const wakeLabel = `${HOURS[wakeHourIdx]}:${MINS[wakeMinIdx]}`
  const bedTotalMin  = bedHourIdx * 60 + bedMinIdx
  let wakeTotalMin   = wakeHourIdx * 60 + wakeMinIdx
  if (wakeTotalMin <= bedTotalMin) wakeTotalMin += 24 * 60
  const durationMin = wakeTotalMin - bedTotalMin

  // AsyncStorage から読み込み
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const raw = await AsyncStorage.getItem(SLEEP_KEY)
      if (raw) setRecords(JSON.parse(raw) as SleepRecord[])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    setSaving(true)
    try {
      const record: SleepRecord = {
        id: `local-${Date.now()}`,
        user_id: MOCK_USER_ID,
        sleep_date: recordDate,
        quality_score: quality,
        duration_min: durationMin,
        notes: notes || undefined,
        created_at: new Date().toISOString(),
      }
      const updated = [record, ...records.filter(r => r.sleep_date !== recordDate)]
      await AsyncStorage.setItem(SLEEP_KEY, JSON.stringify(updated))
      setRecords(updated)
      Sounds.save()
      Toast.show({ type: 'success', text1: '✅ 睡眠を記録しました', text2: `${bedLabel} → ${wakeLabel}  ${fmtDuration(durationMin)}` })
      setFormOpen(false)
      setNotes('')
    } catch {
      Toast.show({ type: 'error', text1: '保存に失敗しました' })
    } finally {
      setSaving(false)
    }
  }

  const chartData: ChartDataPoint[] = records.slice(0, 7).reverse()
    .map(r => ({ date: r.sleep_date, value: r.quality_score }))
  const avgQuality = records.length > 0
    ? (records.slice(0, 7).reduce((s, r) => s + r.quality_score, 0) / Math.min(records.length, 7)).toFixed(1)
    : null
  const avgDuration = records.length > 0
    ? Math.round(records.slice(0, 7).reduce((s, r) => s + (r.duration_min ?? 0), 0) / Math.min(records.length, 7))
    : null

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>睡眠・回復</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setFormOpen(v => !v)} activeOpacity={0.8}>
            <Ionicons name={formOpen ? 'chevron-up' : 'add'} size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* サマリー */}
          {!loading && records.length > 0 && (
            <AnimatedSection delay={0} type="scale">
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{avgQuality}</Text>
                <Text style={styles.summaryLabel}>平均質スコア</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{fmtDuration(avgDuration ?? undefined)}</Text>
                <Text style={styles.summaryLabel}>平均睡眠時間</Text>
              </View>
            </View>
            </AnimatedSection>
          )}

          {/* ── 入力フォーム ── */}
          {formOpen && (
            <AnimatedSection delay={0} type="scale">
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>睡眠を記録</Text>

              <DateSelector date={recordDate} onChange={setRecordDate} />

              {/* ── ホイールピッカー ── */}
              <View style={styles.pickersSection}>

                {/* 就寝 */}
                <View style={styles.pickerGroup}>
                  <Text style={styles.pickerGroupLabel}>就寝</Text>
                  <View style={styles.pickerRow}>
                    <WheelPicker
                      items={HOURS}
                      selectedIndex={bedHourIdx}
                      onChange={setBedHourIdx}
                      width={72}
                      accentColor={NEON.blue}
                    />
                    <Text style={styles.colon}>:</Text>
                    <WheelPicker
                      items={MINS}
                      selectedIndex={bedMinIdx}
                      onChange={setBedMinIdx}
                      width={72}
                      accentColor={NEON.blue}
                    />
                  </View>
                  <Text style={styles.timeDisplay}>{bedLabel}</Text>
                </View>

                <View style={styles.pickerDivider} />

                {/* 起床 */}
                <View style={styles.pickerGroup}>
                  <Text style={styles.pickerGroupLabel}>起床</Text>
                  <View style={styles.pickerRow}>
                    <WheelPicker
                      items={HOURS}
                      selectedIndex={wakeHourIdx}
                      onChange={setWakeHourIdx}
                      width={72}
                      accentColor={NEON.cyan}
                    />
                    <Text style={styles.colon}>:</Text>
                    <WheelPicker
                      items={MINS}
                      selectedIndex={wakeMinIdx}
                      onChange={setWakeMinIdx}
                      width={72}
                      accentColor={NEON.cyan}
                    />
                  </View>
                  <Text style={[styles.timeDisplay, { color: NEON.cyan }]}>{wakeLabel}</Text>
                </View>
              </View>

              {/* 睡眠時間表示 */}
              <View style={styles.durationBadge}>
                <Ionicons name="moon" size={14} color={NEON.purple} />
                <Text style={styles.durationText}>睡眠時間  </Text>
                <Text style={[styles.durationValue, { color: NEON.purple }]}>{fmtDuration(durationMin)}</Text>
              </View>

              {/* 質スコア */}
              <View style={styles.qualitySection}>
                <Text style={styles.pickerGroupLabel}>睡眠の質</Text>
                <View style={styles.qualityPickerRow}>
                  <WheelPicker
                    items={QUALITY_ITEMS}
                    selectedIndex={qualityIdx}
                    onChange={setQualityIdx}
                    width={64}
                    accentColor={qualityColor(quality)}
                    fontSize={26}
                  />
                  <Text style={[styles.qualityOutOf, { color: qualityColor(quality) }]}>/10</Text>
                </View>
              </View>

              {/* メモ */}
              <TextInput
                style={styles.noteInput}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
                placeholder="メモ（途中で起きた、夢を見た...）"
                placeholderTextColor="#445577"
              />

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Ionicons name="moon" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>{saving ? '保存中...' : '記録する'}</Text>
              </TouchableOpacity>
            </View>
            </AnimatedSection>
          )}

          {/* チャート */}
          <AnimatedSection delay={80} type="fade-up">
          {loading ? (
            <View style={styles.card}>
              <SkeletonRect height={20} width="50%" />
              <SkeletonRect height={160} />
            </View>
          ) : chartData.length > 0 ? (
            <TrainingChart
              data={chartData}
              title="睡眠質スコア推移"
              color="#5AC8FA"
              unit=""
              isLoading={false}
            />
          ) : null}
          </AnimatedSection>

          {/* 履歴 */}
          <AnimatedSection delay={160} type="fade-up">
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Ionicons name="moon-outline" size={18} color="#5AC8FA" />
              <Text style={styles.sectionTitle}>睡眠履歴</Text>
            </View>
            {loading ? (
              <View style={{ gap: 10 }}>
                {[1, 2, 3].map(i => <SkeletonRect key={i} height={56} />)}
              </View>
            ) : records.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="moon-outline" size={40} color={TEXT.hint} />
                <Text style={styles.emptyText}>睡眠を記録しましょう</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setFormOpen(true)}>
                  <Text style={styles.emptyBtnText}>今夜の睡眠を記録</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {records.map(r => <SleepCard key={r.id} record={r} />)}
              </View>
            )}
          </View>
          </AnimatedSection>

        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { color: TEXT.primary, fontSize: 20, fontWeight: '800' },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: NEON.cyan, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  card: { backgroundColor: '#111111', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, gap: 12 },

  // サマリー
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: { flex: 1, backgroundColor: '#111111', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 16, alignItems: 'center', gap: 4 },
  summaryValue: { color: TEXT.primary, fontSize: 24, fontWeight: '800' },
  summaryLabel: { color: TEXT.secondary, fontSize: 12 },

  // フォームカード
  formCard: { backgroundColor: 'rgba(12,14,35,0.88)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 20, gap: 16 },
  formTitle: { color: TEXT.primary, fontSize: 16, fontWeight: '700', textAlign: 'center' },

  // ホイールエリア
  pickersSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  pickerGroup: { alignItems: 'center', gap: 6 },
  pickerGroupLabel: { color: TEXT.secondary, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  colon: { color: 'rgba(255,255,255,0.4)', fontSize: 28, fontWeight: '300', marginBottom: 2, paddingHorizontal: 2 },
  timeDisplay: { color: NEON.blue, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  pickerDivider: { width: 1, height: 120, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 8 },

  // 睡眠時間バッジ
  durationBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: `${NEON.purple}15`, borderRadius: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: `${NEON.purple}30`,
  },
  durationText: { color: TEXT.secondary, fontSize: 14 },
  durationValue: { fontSize: 16, fontWeight: '800' },

  // 質スコア
  qualitySection: { alignItems: 'center', gap: 8 },
  qualityPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qualityOutOf: { fontSize: 22, fontWeight: '700' },

  // メモ
  noteInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    color: '#FFFFFF', fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    height: 60, textAlignVertical: 'top',
  },

  saveBtn: {
    backgroundColor: NEON.blue, borderRadius: 14,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  // 履歴
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { color: TEXT.primary, fontSize: 15, fontWeight: '700', flex: 1 },
  sleepCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(74,159,255,0.12)',
    borderRadius: 10, padding: 12, gap: 10,
  },
  sleepLeft: { flex: 1, gap: 2 },
  sleepDate: { color: TEXT.primary, fontSize: 14, fontWeight: '600' },
  sleepDuration: { color: TEXT.secondary, fontSize: 12 },
  sleepNotes: { color: TEXT.hint, fontSize: 12, flex: 1 },
  qualityBadge: { borderWidth: 2, borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  qualityValue: { fontSize: 16, fontWeight: '800', lineHeight: 18 },
  qualityMax: { color: TEXT.hint, fontSize: 9 },

  // 空状態
  empty: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  emptyText: { color: TEXT.secondary, fontSize: 14 },
  emptyBtn: { backgroundColor: BRAND, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
})
