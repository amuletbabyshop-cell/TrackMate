import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  Animated, Easing, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native'
import AdBanner from '../../components/AdBanner'
import { getSubscription } from '../../lib/subscription'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import { useTheme } from '../../context/ThemeContext'

import { useTrainingSessions } from '../../hooks/useTrainingSessions'
import { calcInjuryRisk } from '../../lib/injuryRisk'
import GlassCard from '../../components/GlassCard'
import PressableScale from '../../components/PressableScale'
import { BRAND, TEXT, NEON, SURFACE, SURFACE2, DIVIDER } from '../../lib/theme'
import { Sounds, unlockAudio } from '../../lib/sounds'
import Logo from '../../components/Logo'
import PWAInstallPrompt from '../../components/PWAInstallPrompt'
import QuickLogModal from '../../components/QuickLogModal'
import { registerHomeScroll, unregisterHomeScroll } from '../../lib/homeScroll'
import type { SleepRecord, CompetitionPlan } from '../../types'

// ── AsyncStorage keys ───────────────────────────────────
const CONDITION_KEY = 'trackmate_condition'
const SLEEP_KEY     = 'trackmate_sleep'
const COMP_KEY      = 'trackmate_competitions'
const RECOVERY_KEY  = 'trackmate_recovery_records'

// ── Condition emoji map ─────────────────────────────────
const CONDITION_EMOJIS = [
  { emoji: '😫', label: 'きつい',  value: 2 },
  { emoji: '😕', label: 'しんどい', value: 4 },
  { emoji: '😐', label: 'ふつう',  value: 6 },
  { emoji: '😊', label: 'いい感じ', value: 8 },
  { emoji: '💪', label: '絶好調',  value: 10 },
] as const

const SESSION_TYPE_LABEL: Record<string, string> = {
  interval: 'インターバル', tempo: 'テンポ走', easy: 'ジョグ',
  long: 'ロング走', sprint: 'スプリント', drill: 'ドリル',
  strength: 'ウェイト', race: '試合', rest: '休養',
}
const DAYS_JP = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜']

const INTENSITY_COLORS: Record<string, string> = {
  easy: NEON.green, moderate: NEON.amber, hard: '#FF3B30', race: '#FFD700',
}

function formatMs(ms: number) {
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(2)}`
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`
}
function formatKm(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`
}

// ────────────────────────────────────────────────────────
// AnimatedEntry
// ────────────────────────────────────────────────────────
function AnimatedEntry({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const fadeY = useRef(new Animated.Value(0)).current
  useFocusEffect(
    useCallback(() => {
      fadeY.setValue(0)
      const anim = Animated.timing(fadeY, {
        toValue: 1, duration: 480, delay,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      })
      anim.start()
      return () => anim.stop()
    }, [delay])
  )
  return (
    <Animated.View style={{
      opacity: fadeY,
      transform: [{ translateY: fadeY.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
    }}>
      {children}
    </Animated.View>
  )
}

// ────────────────────────────────────────────────────────
// SkeletonRect
// ────────────────────────────────────────────────────────
function SkeletonRect({ width = '100%' as number | string, height = 16, radius = 4 }) {
  const op = useRef(new Animated.Value(0.15)).current
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.15, duration: 800, useNativeDriver: true }),
    ]))
    a.start(); return () => a.stop()
  }, [op])
  return <Animated.View style={{ width: width as number, height, borderRadius: radius, backgroundColor: SURFACE2, opacity: op }} />
}

// ────────────────────────────────────────────────────────
// RiskCard — メイン怪我リスク表示
// ────────────────────────────────────────────────────────
function RiskCard({ riskResult }: { riskResult: ReturnType<typeof calcInjuryRisk> | null }) {
  if (!riskResult) return (
    <GlassCard>
      <SkeletonRect height={100} />
    </GlassCard>
  )
  const { signalColor, label, recommendation, riskScore, reasons,
          weeklyKm, prevWeeklyKm, loadIncreasePct, tsb } = riskResult

  const signalEmoji = riskScore >= 50 ? '🔴' : riskScore >= 25 ? '🟡' : '🟢'
  const tsbLabel = tsb > 10 ? '絶好調' : tsb > -10 ? '良好' : tsb > -30 ? '疲労中' : '要休養'
  const loadColor = loadIncreasePct > 30 ? '#FF3B30' : loadIncreasePct > 10 ? '#FF9500' : NEON.green
  const tsbColor  = tsb > 10 ? NEON.green : tsb > -10 ? '#4A9FFF' : tsb > -30 ? '#FF9500' : '#FF3B30'

  return (
    <GlassCard glowColor={signalColor}>
      {/* Signal + label */}
      <View style={s.riskTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.riskEmoji}>{signalEmoji}</Text>
          <Text style={[s.riskLabel, { color: signalColor }]}>{label}</Text>
          <Text style={s.riskRec}>{recommendation}</Text>
        </View>
        <View style={[s.riskScoreBox, { borderColor: signalColor + '44' }]}>
          <Text style={[s.riskScoreNum, { color: signalColor }]}>{riskScore}</Text>
          <Text style={s.riskScoreSub}>/ 100</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={[s.riskStats, { borderTopColor: DIVIDER }]}>
        <View style={s.riskStat}>
          <Text style={s.riskStatNum}>{weeklyKm > 0 ? `${weeklyKm}km` : '—'}</Text>
          <Text style={s.riskStatLabel}>今週</Text>
        </View>
        <View style={[s.riskStat, s.riskStatBorder]}>
          <Text style={[s.riskStatNum, { color: loadColor }]}>
            {prevWeeklyKm > 0.5 ? `${loadIncreasePct > 0 ? '+' : ''}${loadIncreasePct}%` : '—'}
          </Text>
          <Text style={s.riskStatLabel}>先週比</Text>
        </View>
        <View style={s.riskStat}>
          <Text style={[s.riskStatNum, { color: tsbColor }]}>{tsb > 0 ? `+${tsb}` : tsb}</Text>
          <Text style={s.riskStatLabel}>TSB ({tsbLabel})</Text>
        </View>
      </View>

      {/* Risk reasons */}
      {reasons.length > 0 && (
        <View style={s.reasonsBox}>
          {reasons.map((r, i) => (
            <View key={i} style={s.reasonRow}>
              <View style={[s.reasonDot, { backgroundColor: signalColor }]} />
              <Text style={s.reasonText}>{r}</Text>
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  )
}

// ────────────────────────────────────────────────────────
// ConditionEmojiInput — 体調入力（絵文字5択）
// ────────────────────────────────────────────────────────
function ConditionEmojiInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const scales = useRef(CONDITION_EMOJIS.map(() => new Animated.Value(1))).current

  function bounce(i: number) {
    Animated.sequence([
      Animated.spring(scales[i], { toValue: 1.25, tension: 400, friction: 7, useNativeDriver: true }),
      Animated.spring(scales[i], { toValue: 1,    tension: 200, friction: 6, useNativeDriver: true }),
    ]).start()
  }

  const selected = CONDITION_EMOJIS.findIndex(e => e.value === value)

  return (
    <GlassCard>
      <Text style={s.sectionLabel}>TODAY'S CONDITION</Text>
      <View style={s.emojiRow}>
        {CONDITION_EMOJIS.map((e, i) => {
          const isActive = i === selected
          return (
            <Animated.View key={e.value} style={{ flex: 1, transform: [{ scale: scales[i] }] }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  unlockAudio(); Sounds.pop()
                  onChange(e.value); bounce(i)
                }}
                style={[s.emojiBtn, isActive && { backgroundColor: SURFACE2, borderColor: 'rgba(255,255,255,0.25)' }]}
              >
                <Text style={[s.emojiChar, !isActive && { opacity: 0.45 }]}>{e.emoji}</Text>
                <Text style={[s.emojiLabel, { color: isActive ? '#fff' : TEXT.hint }]}>{e.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          )
        })}
      </View>
    </GlassCard>
  )
}

// ────────────────────────────────────────────────────────
// QuickActions — 2×2 タイル
// ────────────────────────────────────────────────────────
function QuickActions({ riskLevel, onWarmup, onVideo, onRecovery, onNutrition }: {
  riskLevel: 'low' | 'moderate' | 'high'
  onWarmup: () => void
  onVideo: () => void
  onRecovery: () => void
  onNutrition: () => void
}) {
  const tiles = [
    { icon: '🔥', label: 'ウォームアップ', sublabel: 'メニュー生成',   onPress: onWarmup,    color: '#FF9500' },
    { icon: '📹', label: '動画分析',        sublabel: 'フォームチェック', onPress: onVideo,   color: BRAND },
    { icon: '🩹', label: 'リカバリー',      sublabel: '痛み・テーピング', onPress: onRecovery, color: NEON.green },
    { icon: '🍽️', label: '栄養管理',        sublabel: 'AI食事分析',     onPress: onNutrition, color: '#34C759' },
  ]
  return (
    <View style={{ gap: 8 }}>
      {[tiles.slice(0, 2), tiles.slice(2, 4)].map((row, ri) => (
        <View key={ri} style={s.tilesRow}>
          {row.map(t => (
            <PressableScale key={t.label} haptic="medium" scaleAmount={0.93} onPress={t.onPress} style={{ flex: 1 }}>
              <View style={[s.tile, { borderColor: t.color + '33' }]}>
                <Text style={s.tileIcon}>{t.icon}</Text>
                <Text style={s.tileName}>{t.label}</Text>
                <Text style={s.tileSub}>{t.sublabel}</Text>
              </View>
            </PressableScale>
          ))}
        </View>
      ))}
    </View>
  )
}

// ────────────────────────────────────────────────────────
// NextCompCard — compact
// ────────────────────────────────────────────────────────
function NextCompCard({ competitions }: { competitions: CompetitionPlan[] }) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const upcoming = competitions
    .filter(c => c.competition_date >= todayStr)
    .sort((a, b) => a.competition_date.localeCompare(b.competition_date))
  if (!upcoming.length) return null

  const next = upcoming[0]
  const daysUntil = Math.max(0, Math.ceil(
    (new Date(next.competition_date).getTime() - Date.now()) / 86400000
  ))
  const weeksUntil = Math.ceil(daysUntil / 7)
  const phase = next.phases?.find(p => p.week_number === weeksUntil)
  const todaySession = phase?.sessions.find(s => s.day === DAYS_JP[new Date().getDay()])

  return (
    <GlassCard glowColor="#FFD700">
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionLabel}>NEXT RACE</Text>
          <Text style={s.bigText} numberOfLines={1}>{next.competition_name}</Text>
          <Text style={s.metaText}>{next.event} · {next.competition_date}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#FFD700', fontSize: 34, fontWeight: '800', letterSpacing: -1 }}>{daysUntil}</Text>
          <Text style={{ color: TEXT.hint, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>DAYS</Text>
        </View>
      </View>
      {todaySession && (
        <View style={[s.infoBox, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
          <View style={{ width: 4, height: '100%', borderRadius: 2, alignSelf: 'stretch',
            backgroundColor: INTENSITY_COLORS[todaySession.intensity] ?? '#888' }} />
          <View style={{ flex: 1 }}>
            <Text style={s.infoLabel}>本日の推奨メニュー</Text>
            <Text style={s.infoValue}>{todaySession.detail}</Text>
          </View>
          <Text style={{ color: TEXT.secondary, fontSize: 12 }}>{todaySession.duration_min}分</Text>
        </View>
      )}
    </GlassCard>
  )
}

// ────────────────────────────────────────────────────────
// DashboardScreen
// ────────────────────────────────────────────────────────
const MOCK_USER_ID = 'mock-user-1'

export default function DashboardScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const { sessions, loading, fetchSessions } = useTrainingSessions()
  const [showQuickLog, setShowQuickLog] = useState(false)
  const [conditionLevel, setConditionLevel] = useState(6)
  const [isPremiumUser, setIsPremiumUser] = useState(false)
  const [sleepRecords,   setSleepRecords]   = useState<SleepRecord[]>([])
  const [competitions,   setCompetitions]   = useState<CompetitionPlan[]>([])
  const [hasSymptom,     setHasSymptom]     = useState(false)

  // ── Load persisted data ──
  useEffect(() => {
    AsyncStorage.getItem(CONDITION_KEY).then(v => { if (v) setConditionLevel(Number(v)) })
  }, [])
  useEffect(() => {
    getSubscription().then(sub => setIsPremiumUser(sub.isPremium)).catch(() => {})
  }, [])
  useEffect(() => {
    AsyncStorage.getItem(SLEEP_KEY).then(r => { if (r) setSleepRecords(JSON.parse(r)) }).catch(() => {})
  }, [])
  useEffect(() => {
    const t = new Date().toISOString().slice(0, 10)
    AsyncStorage.getItem(COMP_KEY).then(r => {
      if (r) setCompetitions((JSON.parse(r) as CompetitionPlan[]).filter(c => c.competition_date >= t))
    }).catch(() => {})
  }, [])
  useEffect(() => {
    // Check if there are recent recovery records (past 7 days)
    AsyncStorage.getItem(RECOVERY_KEY).then(r => {
      if (!r) return
      const records = JSON.parse(r) as Array<{ date: string }>
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
      setHasSymptom(records.some(rec => rec.date >= sevenDaysAgo))
    }).catch(() => {})
  }, [])
  useEffect(() => { fetchSessions(MOCK_USER_ID) }, [fetchSessions])

  const handleConditionChange = useCallback((v: number) => {
    setConditionLevel(v)
    AsyncStorage.setItem(CONDITION_KEY, String(v)).catch(() => {})
  }, [])

  // ── Injury risk calculation ──
  const riskResult = useMemo(() => {
    if (loading === 'loading' || loading === 'idle') return null
    return calcInjuryRisk(sessions, sleepRecords, conditionLevel, hasSymptom)
  }, [sessions, sleepRecords, conditionLevel, hasSymptom, loading])

  // ── Weekly summary ──
  const weeklyStats = useMemo(() => {
    const wAgo = new Date(Date.now() - 7 * 86400000)
    const week = sessions.filter(s => new Date(s.session_date) >= wAgo)
    return {
      count: week.length,
      totalDistanceM: week.reduce((sum, s) => sum + (s.distance_m ?? 0), 0),
    }
  }, [sessions])

  // ── Scroll to top on double-tab ──
  const scrollRef = useRef<ScrollView>(null)
  useEffect(() => {
    registerHomeScroll(() => scrollRef.current?.scrollTo({ y: 0, animated: true }))
    return () => unregisterHomeScroll()
  }, [])

  const todayStr = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })
  const isLoading = loading === 'idle' || loading === 'loading'

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          {/* ── ヘッダー ── */}
          <AnimatedEntry delay={0}>
            <View style={s.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Logo size={38} />
                <View>
                  <Text style={s.appTitle}>TrackMate</Text>
                  <Text style={s.dateText}>{todayStr}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.planBadge, isPremiumUser ? s.planBadgePro : s.planBadgeFree]}>
                  <Text style={[s.planBadgeText, isPremiumUser ? s.planBadgeTextPro : s.planBadgeTextFree]}>
                    {isPremiumUser ? 'PRO' : 'FREE'}
                  </Text>
                </View>
                <PressableScale haptic="medium" scaleAmount={0.9} onPress={() => { unlockAudio(); Sounds.tap(); router.push('/settings') }}>
                  <View style={s.avatarBtn}>
                    <Ionicons name="settings-outline" size={20} color="#fff" />
                  </View>
                </PressableScale>
              </View>
            </View>
          </AnimatedEntry>

          {/* ── 怪我リスクカード（メイン） ── */}
          <AnimatedEntry delay={80}>
            <RiskCard riskResult={riskResult} />
          </AnimatedEntry>

          {/* ── 体調入力（絵文字） ── */}
          <AnimatedEntry delay={160}>
            <ConditionEmojiInput value={conditionLevel} onChange={handleConditionChange} />
          </AnimatedEntry>

          {/* ── クイックアクション ── */}
          <AnimatedEntry delay={240}>
            <QuickActions
              riskLevel={riskResult?.riskLevel ?? 'low'}
              onWarmup={() => { unlockAudio(); Sounds.tap(); router.push(`/warmup?risk=${riskResult?.riskLevel ?? 'low'}`) }}
              onVideo={() => { unlockAudio(); Sounds.tap(); router.push('/video-analysis') }}
              onRecovery={() => { unlockAudio(); Sounds.tap(); router.push('/recovery') }}
              onNutrition={() => { unlockAudio(); Sounds.tap(); router.push('/(tabs)/nutrition') }}
            />
          </AnimatedEntry>

          {/* ── 次の大会 ── */}
          <AnimatedEntry delay={320}>
            <NextCompCard competitions={competitions} />
          </AnimatedEntry>

          {/* ── 直近の練習 ── */}
          <AnimatedEntry delay={440}>
            <GlassCard>
              <View style={s.row}>
                <Text style={s.sectionLabel}>RECENT SESSIONS</Text>
                <PressableScale haptic="light" onPress={() => router.push('/(tabs)/notebook')}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>すべて →</Text>
                </PressableScale>
              </View>
              {isLoading ? (
                <View style={{ gap: 8 }}>{[0,1,2].map(i => <SkeletonRect key={i} height={48} />)}</View>
              ) : sessions.length === 0 ? (
                <View style={{ alignItems: 'center', gap: 8, paddingVertical: 20 }}>
                  <Ionicons name="calendar-outline" size={28} color={TEXT.hint} />
                  <Text style={{ color: TEXT.hint, fontSize: 14 }}>練習記録がありません</Text>
                  <Text style={{ color: TEXT.hint, fontSize: 12 }}>ノートタブから記録を追加しよう</Text>
                </View>
              ) : (
                sessions.slice(0, 3).map((sess, idx) => (
                  <PressableScale
                    key={sess.id} haptic="light" scaleAmount={0.98}
                    onPress={() => router.push(`/session-detail?id=${sess.id}`)}
                    style={[s.sessionRow, idx < 2 && { borderBottomWidth: 1, borderBottomColor: DIVIDER }]}
                  >
                    <View style={s.sessionTag}>
                      <Text style={s.sessionTagText}>{SESSION_TYPE_LABEL[sess.session_type] ?? sess.session_type}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: TEXT.hint, fontSize: 11 }}>{sess.session_date}</Text>
                      {sess.distance_m
                        ? <Text style={s.sessionDetail}>{formatKm(sess.distance_m)}</Text>
                        : sess.time_ms
                        ? <Text style={s.sessionDetail}>{formatMs(sess.time_ms)}</Text>
                        : null}
                    </View>
                    <View style={[s.fatigueDot, {
                      backgroundColor: sess.fatigue_level >= 8 ? '#FF3B30' : sess.fatigue_level >= 5 ? '#FF9500' : NEON.green
                    }]}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{sess.fatigue_level}</Text>
                    </View>
                  </PressableScale>
                ))
              )}
            </GlassCard>
          </AnimatedEntry>

          {/* ── AI診断（小さく、最下部） ── */}
          <AnimatedEntry delay={500}>
            <PressableScale haptic="light" scaleAmount={0.98} onPress={() => { unlockAudio(); Sounds.whoosh(); router.push('/ai-diagnosis') }}>
              <View style={s.aiRow}>
                <Text style={{ fontSize: 16 }}>🤖</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.aiTitle}>AIが今週の練習を分析</Text>
                  <Text style={s.aiSub}>疲労パターン・改善提案・来週の強度設定</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={TEXT.hint} />
              </View>
            </PressableScale>
          </AnimatedEntry>

          {/* ── バナー広告（Web・無料プランのみ） ── */}
          {!isPremiumUser && <AdBanner />}

        </ScrollView>
      </SafeAreaView>
          {/* ── クイックログ FAB ── */}
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
            onSaved={() => fetchSessions('mock-user-1')}
          />
      <PWAInstallPrompt />
    </View>
  )
}

// ── Styles ──────────────────────────────────────────────
const s = StyleSheet.create({
  content:   { padding: 16, gap: 12, paddingBottom: 100 },

  // Header
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  appTitle:  { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  dateText:  { color: TEXT.secondary, fontSize: 12, marginTop: 1 },
  avatarBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: SURFACE, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Plan badge
  planBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1,
  },
  planBadgeFree: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  planBadgePro: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderColor: 'rgba(255,215,0,0.4)',
  },
  planBadgeText: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1,
  },
  planBadgeTextFree: {
    color: TEXT.secondary,
  },
  planBadgeTextPro: {
    color: '#FFD700',
  },

  // Common
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { color: TEXT.hint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  bigText:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  metaText:  { color: TEXT.secondary, fontSize: 12, marginTop: 2 },
  infoBox:   { backgroundColor: SURFACE2, borderRadius: 8, padding: 10, gap: 2, marginTop: 8 },
  infoLabel: { color: TEXT.hint, fontSize: 10, letterSpacing: 0.5 },
  infoValue: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Risk card
  riskTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  riskEmoji:    { fontSize: 28, marginBottom: 4 },
  riskLabel:    { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  riskRec:      { color: TEXT.secondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  riskScoreBox: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  riskScoreNum: { fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  riskScoreSub: { color: TEXT.hint, fontSize: 10, fontWeight: '600' },
  riskStats:    { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12 },
  riskStat:     { flex: 1, alignItems: 'center', gap: 3 },
  riskStatBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: DIVIDER },
  riskStatNum:  { color: '#fff', fontSize: 16, fontWeight: '800' },
  riskStatLabel:{ color: TEXT.hint, fontSize: 10, fontWeight: '600' },
  reasonsBox:   { marginTop: 10, gap: 5 },
  reasonRow:    { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reasonDot:    { width: 5, height: 5, borderRadius: 2.5 },
  reasonText:   { color: TEXT.secondary, fontSize: 12, flex: 1 },

  // Condition emoji
  emojiRow: { flexDirection: 'row', gap: 4 },
  emojiBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: 'transparent',
  },
  emojiChar:  { fontSize: 26 },
  emojiLabel: { fontSize: 10, fontWeight: '600', marginTop: 3 },

  // Quick action tiles (2×2 grid)
  tilesRow: { flexDirection: 'row', gap: 8 },
  tile: {
    height: 90, backgroundColor: SURFACE, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, gap: 4,
  },
  tileIcon: { fontSize: 26 },
  tileName: { color: '#fff', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  tileSub:  { color: TEXT.hint, fontSize: 10, textAlign: 'center' },

  // Weekly stats
  weekStatsRow: { flexDirection: 'row' },
  weekStat:     { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 4 },
  weekStatNum:  { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  weekStatLabel:{ color: TEXT.secondary, fontSize: 11, fontWeight: '600' },

  // Sessions
  sessionRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  sessionTag:     { backgroundColor: SURFACE2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  sessionTagText: { color: TEXT.secondary, fontSize: 11, fontWeight: '600' },
  sessionDetail:  { color: '#fff', fontSize: 13, fontWeight: '700' },
  fatigueDot:     { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E53E3E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E53E3E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },

  // AI row
  aiRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: SURFACE, borderRadius: 12, borderWidth: 1, borderColor: DIVIDER,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  aiTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  aiSub:   { color: TEXT.secondary, fontSize: 11, marginTop: 2 },
})
