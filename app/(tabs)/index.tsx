// app/(tabs)/index.tsx — シンプルホーム（ゲーミフィケーション + 改善タスク + 総合リスク）
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  Animated, Easing, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../context/ThemeContext'
import { useTrainingSessions } from '../../hooks/useTrainingSessions'
import { calcInjuryRisk } from '../../lib/injuryRisk'
import { calcLevelInfo } from '../../lib/gamification'
import GlassCard from '../../components/GlassCard'
import PressableScale from '../../components/PressableScale'
import { BRAND, TEXT, NEON, SURFACE, SURFACE2, DIVIDER } from '../../lib/theme'
import { Sounds, unlockAudio } from '../../lib/sounds'
import Logo from '../../components/Logo'
import PWAInstallPrompt from '../../components/PWAInstallPrompt'
import QuickLogModal from '../../components/QuickLogModal'
import { registerHomeScroll, unregisterHomeScroll } from '../../lib/homeScroll'
import type { SleepRecord } from '../../types'

// ── AsyncStorage keys ───────────────────────────────────
const CONDITION_KEY = 'trackmate_condition'
const SLEEP_KEY     = 'trackmate_sleep'
const RECOVERY_KEY  = 'trackmate_recovery_records'
const TASKS_KEY     = 'trackmate_tasks'

export interface ImprovementTask {
  id: string
  text: string
  completed: boolean
  created_at: string
}

// ── 定数 ────────────────────────────────────────────────
const SESSION_TYPE_LABEL: Record<string, string> = {
  interval: 'インターバル', tempo: 'テンポ走', easy: 'ジョグ',
  long: 'ロング走', sprint: 'スプリント', drill: 'ドリル',
  strength: 'ウェイト', race: '試合', rest: '休養',
}

const CONDITION_EMOJIS = [
  { emoji: '😫', label: 'きつい',   value: 2 },
  { emoji: '😕', label: 'しんどい', value: 4 },
  { emoji: '😐', label: 'ふつう',   value: 6 },
  { emoji: '😊', label: 'いい感じ', value: 8 },
  { emoji: '💪', label: '絶好調',   value: 10 },
] as const

const MOCK_USER_ID = 'mock-user-1'

// ────────────────────────────────────────────────────────
// AnimatedEntry
// ────────────────────────────────────────────────────────
function AnimatedEntry({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const fadeY = useRef(new Animated.Value(0)).current
  useFocusEffect(
    useCallback(() => {
      fadeY.setValue(0)
      const anim = Animated.timing(fadeY, {
        toValue: 1, duration: 420, delay,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      })
      anim.start()
      return () => anim.stop()
    }, [delay])
  )
  return (
    <Animated.View style={{
      opacity: fadeY,
      transform: [{ translateY: fadeY.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
    }}>
      {children}
    </Animated.View>
  )
}

// ────────────────────────────────────────────────────────
// LevelBadge — ヘッダー右側のレベル表示
// ────────────────────────────────────────────────────────
function LevelBadge({ sessionCount }: { sessionCount: number }) {
  const info = calcLevelInfo(sessionCount)
  return (
    <View style={lb.wrap}>
      <Text style={lb.emoji}>{info.emoji}</Text>
      <View>
        <Text style={lb.lv}>Lv.{info.level} <Text style={lb.title}>{info.title}</Text></Text>
        <View style={lb.barBg}>
          <View style={[lb.barFill, { width: `${Math.round(info.progress * 100)}%` as any }]} />
        </View>
      </View>
    </View>
  )
}
const lb = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(229,57,53,0.12)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(229,57,53,0.25)' },
  emoji:  { fontSize: 16 },
  lv:     { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  title:  { color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  barBg:  { height: 3, width: 60, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, marginTop: 2 },
  barFill:{ height: 3, backgroundColor: BRAND, borderRadius: 2 },
})

// ────────────────────────────────────────────────────────
// RiskSummaryCard — 総合怪我リスク（ファクターバー付き）
// ────────────────────────────────────────────────────────
function RiskSummaryCard({ riskResult }: { riskResult: ReturnType<typeof calcInjuryRisk> | null }) {
  const { colors } = useTheme()
  if (!riskResult) {
    return (
      <GlassCard>
        <View style={{ height: 90, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textHint, fontSize: 13 }}>データ読み込み中…</Text>
        </View>
      </GlassCard>
    )
  }

  const { riskScore, signalColor, label, recommendation, factors } = riskResult
  const scoreEmoji = riskScore >= 50 ? '🔴' : riskScore >= 25 ? '🟡' : '🟢'

  // -1 は未記録なのでスキップ
  const validFactors = factors.filter(f => f.score >= 0)

  return (
    <GlassCard glowColor={signalColor}>
      {/* スコアヘッダー */}
      <View style={rs.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text style={{ fontSize: 22 }}>{scoreEmoji}</Text>
            <Text style={[rs.label, { color: signalColor }]}>{label}</Text>
          </View>
          <Text style={rs.rec}>{recommendation}</Text>
        </View>
        <View style={[rs.scoreCircle, { borderColor: signalColor + '55' }]}>
          <Text style={[rs.scoreNum, { color: signalColor }]}>{riskScore}</Text>
          <Text style={rs.scoreMax}>/100</Text>
        </View>
      </View>

      {/* ファクターバー */}
      {validFactors.length > 0 && (
        <View style={rs.factorsWrap}>
          {validFactors.map(f => (
            <View key={f.key} style={rs.factorRow}>
              <Text style={rs.factorEmoji}>{f.emoji}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[rs.factorName, { color: colors.text }]}>{f.name}</Text>
                  <Text style={[rs.factorDesc, { color: colors.textHint }]}>{f.description}</Text>
                </View>
                <View style={[rs.barBg, { backgroundColor: colors.surface2 }]}>
                  <View style={[
                    rs.barFill,
                    {
                      width: `${f.score}%` as any,
                      backgroundColor: f.score >= 70 ? '#FF3B30' : f.score >= 40 ? '#FF9500' : NEON.green,
                    }
                  ]} />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  )
}
const rs = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  label:       { fontSize: 18, fontWeight: '800' },
  rec:         { color: TEXT.secondary, fontSize: 12, lineHeight: 17 },
  scoreCircle: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  scoreNum:    { fontSize: 26, fontWeight: '800', letterSpacing: -1 },
  scoreMax:    { color: TEXT.hint, fontSize: 9, fontWeight: '700' },
  factorsWrap: { gap: 8 },
  factorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factorEmoji: { fontSize: 14, width: 20 },
  factorName:  { fontSize: 12, fontWeight: '700' },
  factorDesc:  { fontSize: 10 },
  barBg:       { height: 5, borderRadius: 3, marginTop: 3, overflow: 'hidden' },
  barFill:     { height: 5, borderRadius: 3 },
})

// ────────────────────────────────────────────────────────
// ConditionRow — コンパクトな体調入力
// ────────────────────────────────────────────────────────
function ConditionRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const selected = CONDITION_EMOJIS.findIndex(e => e.value === value)
  return (
    <View style={cr.row}>
      <Text style={cr.label}>今日の体調</Text>
      <View style={cr.emojis}>
        {CONDITION_EMOJIS.map((e, i) => (
          <TouchableOpacity
            key={e.value}
            onPress={() => { unlockAudio(); Sounds.pop(); onChange(e.value) }}
            style={[cr.btn, i === selected && cr.btnActive]}
            activeOpacity={0.7}
          >
            <Text style={[cr.emoji, i !== selected && { opacity: 0.4 }]}>{e.emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}
const cr = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label:     { color: TEXT.hint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  emojis:    { flexDirection: 'row', gap: 4 },
  btn:       { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  btnActive: { backgroundColor: SURFACE2, borderColor: 'rgba(255,255,255,0.2)' },
  emoji:     { fontSize: 22 },
})

// ────────────────────────────────────────────────────────
// TasksCard — 改善タスク（チェックリスト）
// ────────────────────────────────────────────────────────
function TasksCard({
  tasks, onToggle,
}: {
  tasks: ImprovementTask[]
  onToggle: (id: string) => void
}) {
  const { colors } = useTheme()
  const pending = tasks.filter(t => !t.completed)
  if (pending.length === 0) return null

  return (
    <GlassCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Text style={{ fontSize: 14 }}>✅</Text>
        <Text style={[tk.title, { color: colors.text }]}>改善タスク</Text>
        <View style={tk.badge}>
          <Text style={tk.badgeText}>{pending.length}</Text>
        </View>
      </View>
      {pending.slice(0, 5).map((task, idx) => (
        <TouchableOpacity
          key={task.id}
          onPress={() => { unlockAudio(); Sounds.pop(); onToggle(task.id) }}
          activeOpacity={0.7}
          style={[tk.row, idx > 0 && { borderTopWidth: 1, borderTopColor: DIVIDER }]}
        >
          <View style={[tk.check, { borderColor: colors.border }]}>
            {task.completed && <Ionicons name="checkmark" size={12} color={NEON.green} />}
          </View>
          <Text style={[tk.text, { color: colors.text }]}>{task.text}</Text>
        </TouchableOpacity>
      ))}
    </GlassCard>
  )
}
const tk = StyleSheet.create({
  title:     { color: '#fff', fontSize: 13, fontWeight: '800', flex: 1 },
  badge:     { backgroundColor: BRAND, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  check:     { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text:      { fontSize: 13, lineHeight: 18, flex: 1 },
})

// ────────────────────────────────────────────────────────
// DashboardScreen
// ────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const { sessions, loading, fetchSessions } = useTrainingSessions()
  const [showQuickLog,    setShowQuickLog]    = useState(false)
  const [conditionLevel,  setConditionLevel]  = useState(6)
  const [sleepRecords,    setSleepRecords]    = useState<SleepRecord[]>([])
  const [hasSymptom,      setHasSymptom]      = useState(false)
  const [tasks,           setTasks]           = useState<ImprovementTask[]>([])

  // ── 永続データ読み込み ──
  useEffect(() => {
    AsyncStorage.getItem(CONDITION_KEY).then(v => { if (v) setConditionLevel(Number(v)) })
    AsyncStorage.getItem(SLEEP_KEY).then(r => { if (r) setSleepRecords(JSON.parse(r)) }).catch(() => {})
    AsyncStorage.getItem(RECOVERY_KEY).then(r => {
      if (!r) return
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
      const records = JSON.parse(r) as Array<{ date: string }>
      setHasSymptom(records.some(rec => rec.date >= sevenDaysAgo))
    }).catch(() => {})
    loadTasks()
    fetchSessions(MOCK_USER_ID)
  }, [])

  useFocusEffect(useCallback(() => { fetchSessions(MOCK_USER_ID) }, [fetchSessions]))

  function loadTasks() {
    AsyncStorage.getItem(TASKS_KEY).then(r => {
      if (r) setTasks(JSON.parse(r))
    }).catch(() => {})
  }

  function toggleTask(id: string) {
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
      AsyncStorage.setItem(TASKS_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }

  const handleConditionChange = useCallback((v: number) => {
    setConditionLevel(v)
    AsyncStorage.setItem(CONDITION_KEY, String(v)).catch(() => {})
  }, [])

  // ── 怪我リスク計算 ──
  const riskResult = useMemo(() => {
    if (loading === 'loading' || loading === 'idle') return null
    return calcInjuryRisk(sessions, sleepRecords, conditionLevel, hasSymptom)
  }, [sessions, sleepRecords, conditionLevel, hasSymptom, loading])

  // ── スクロールトップ ──
  const scrollRef = useRef<ScrollView>(null)
  useEffect(() => {
    registerHomeScroll(() => scrollRef.current?.scrollTo({ y: 0, animated: true }))
    return () => unregisterHomeScroll()
  }, [])

  const todayStr = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          {/* ── ヘッダー ── */}
          <AnimatedEntry delay={0}>
            <View style={s.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Logo size={36} />
                <View>
                  <Text style={[s.appTitle, { color: colors.text }]}>TrackMate</Text>
                  <Text style={[s.dateText, { color: colors.textSec }]}>{todayStr}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <LevelBadge sessionCount={sessions.length} />
                <PressableScale haptic="medium" scaleAmount={0.9} onPress={() => { unlockAudio(); Sounds.tap(); router.push('/settings') }}>
                  <View style={[s.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="settings-outline" size={18} color={colors.textSec} />
                  </View>
                </PressableScale>
              </View>
            </View>
          </AnimatedEntry>

          {/* ── 体調入力 ── */}
          <AnimatedEntry delay={60}>
            <GlassCard>
              <ConditionRow value={conditionLevel} onChange={handleConditionChange} />
            </GlassCard>
          </AnimatedEntry>

          {/* ── 総合怪我リスク ── */}
          <AnimatedEntry delay={120}>
            <RiskSummaryCard riskResult={riskResult} />
          </AnimatedEntry>

          {/* ── 改善タスク（ある場合のみ表示） ── */}
          <AnimatedEntry delay={180}>
            <TasksCard tasks={tasks} onToggle={toggleTask} />
          </AnimatedEntry>

          {/* ── 直近の練習 ── */}
          <AnimatedEntry delay={240}>
            <GlassCard>
              <View style={s.sectionRow}>
                <Text style={[s.sectionLabel, { color: colors.textHint }]}>最近の練習</Text>
                <PressableScale haptic="light" onPress={() => router.push('/(tabs)/notebook')}>
                  <Text style={{ color: BRAND, fontSize: 12, fontWeight: '700' }}>すべて →</Text>
                </PressableScale>
              </View>

              {loading === 'loading' || loading === 'idle' ? (
                <View style={{ gap: 10 }}>
                  {[0,1,2].map(i => (
                    <View key={i} style={{ height: 44, backgroundColor: SURFACE2, borderRadius: 8, opacity: 0.4 }} />
                  ))}
                </View>
              ) : sessions.length === 0 ? (
                <View style={{ alignItems: 'center', gap: 6, paddingVertical: 24 }}>
                  <Ionicons name="barbell-outline" size={32} color={colors.textHint} />
                  <Text style={{ color: colors.textHint, fontSize: 14 }}>まだ練習記録がありません</Text>
                  <Text style={{ color: colors.textHint, fontSize: 12 }}>右下の＋ボタンから記録しよう！</Text>
                </View>
              ) : (
                sessions.slice(0, 4).map((sess, idx) => {
                  const typeInfo = {
                    interval: { color: '#E53935', label: 'インターバル' },
                    tempo:    { color: '#FF9500', label: 'テンポ走' },
                    easy:     { color: '#34C759', label: 'ジョグ' },
                    long:     { color: '#5AC8FA', label: 'ロング走' },
                    sprint:   { color: '#FF3B30', label: 'スプリント' },
                    drill:    { color: '#AF52DE', label: 'ドリル' },
                    strength: { color: '#FF6B35', label: 'ウェイト' },
                    race:     { color: '#FFD700', label: '試合' },
                    rest:     { color: '#888',    label: '休養' },
                  }[sess.session_type] ?? { color: '#888', label: sess.session_type }

                  return (
                    <View
                      key={sess.id}
                      style={[s.sessRow, idx > 0 && { borderTopWidth: 1, borderTopColor: DIVIDER }]}
                    >
                      <View style={[s.typeBar, { backgroundColor: typeInfo.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.sessType, { color: colors.text }]}>{typeInfo.label}</Text>
                        <Text style={[s.sessDate, { color: colors.textHint }]}>{sess.session_date}</Text>
                      </View>
                      {sess.distance_m ? (
                        <Text style={[s.sessStat, { color: colors.textSec }]}>
                          {sess.distance_m >= 1000 ? `${(sess.distance_m/1000).toFixed(1)}km` : `${sess.distance_m}m`}
                        </Text>
                      ) : null}
                      <View style={[s.fatiguePill, {
                        backgroundColor: (sess.fatigue_level ?? 5) >= 8 ? '#FF3B3022' : (sess.fatigue_level ?? 5) >= 6 ? '#FF950022' : '#34C75922',
                      }]}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: (sess.fatigue_level ?? 5) >= 8 ? '#FF3B30' : (sess.fatigue_level ?? 5) >= 6 ? '#FF9500' : '#34C759' }}>
                          疲労{sess.fatigue_level ?? 5}
                        </Text>
                      </View>
                    </View>
                  )
                })
              )}
            </GlassCard>
          </AnimatedEntry>

          {/* ── クイックリンク ── */}
          <AnimatedEntry delay={300}>
            <View style={s.quickLinks}>
              {[
                { icon: '🩹', label: 'リカバリー', route: '/recovery' },
                { icon: '📹', label: 'フォーム分析', route: '/video-analysis' },
                { icon: '🍽️', label: '食事記録', route: '/(tabs)/nutrition' },
                { icon: '🤖', label: 'AI診断', route: '/ai-diagnosis' },
              ].map(item => (
                <PressableScale
                  key={item.label}
                  haptic="light"
                  scaleAmount={0.94}
                  onPress={() => { unlockAudio(); Sounds.tap(); router.push(item.route as any) }}
                  style={{ flex: 1 }}
                >
                  <View style={[s.quickLink, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                    <Text style={[s.quickLinkLabel, { color: colors.textSec }]}>{item.label}</Text>
                  </View>
                </PressableScale>
              ))}
            </View>
          </AnimatedEntry>

        </ScrollView>
      </SafeAreaView>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={s.fab}
        activeOpacity={0.85}
        onPress={() => { unlockAudio(); Sounds.whoosh(); setShowQuickLog(true) }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <QuickLogModal
        visible={showQuickLog}
        onClose={() => setShowQuickLog(false)}
        onSaved={() => {
          fetchSessions(MOCK_USER_ID)
          loadTasks()
        }}
      />
      <PWAInstallPrompt />
    </View>
  )
}

// ── Styles ──────────────────────────────────────────────
const s = StyleSheet.create({
  content:   { padding: 16, gap: 10, paddingBottom: 110 },

  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  appTitle:  { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  dateText:  { fontSize: 11, marginTop: 1 },
  iconBtn:   { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  sessRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  typeBar:    { width: 4, height: 36, borderRadius: 2, flexShrink: 0 },
  sessType:   { fontSize: 13, fontWeight: '700' },
  sessDate:   { fontSize: 11, marginTop: 2 },
  sessStat:   { fontSize: 12, fontWeight: '600' },
  fatiguePill:{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },

  quickLinks: { flexDirection: 'row', gap: 8 },
  quickLink:  { borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: 'center', gap: 5 },
  quickLinkLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },

  fab: {
    position: 'absolute', bottom: 28, right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#E53E3E',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#E53E3E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8, zIndex: 100,
  },
})
