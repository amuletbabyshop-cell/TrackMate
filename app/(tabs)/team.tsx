// app/(tabs)/team.tsx — チーム機能（コーチ/選手ロール対応）
import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { BRAND, TEXT } from '../../lib/theme'
import { calcInjuryRisk } from '../../lib/injuryRisk'
import type { TrainingSession } from '../../types'

// ── ストレージキー ──────────────────────────────────────────
const ROLE_KEY     = 'trackmate_team_role'
const SESSIONS_KEY = 'trackmate_sessions'
const MEMBERS_KEY  = 'trackmate_team_members'

type Role = 'coach' | 'player'

// ── 疲労ラベル ──────────────────────────────────────────────
const FATIGUE_MAP: Record<number, { emoji: string; label: string; color: string }> = {
  2:  { emoji: '😊', label: '楽',     color: '#34C759' },
  4:  { emoji: '🙂', label: 'やや楽', color: '#30D158' },
  6:  { emoji: '😐', label: 'ふつう', color: '#FF9F0A' },
  8:  { emoji: '😰', label: 'きつい', color: '#FF6B35' },
  10: { emoji: '🥵', label: '限界',   color: '#FF3B30' },
}
function fatigueInfo(val: number) {
  const keys = [2, 4, 6, 8, 10]
  const closest = keys.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a)
  return FATIGUE_MAP[closest] ?? FATIGUE_MAP[6]
}

// ── デモメンバーデータ ──────────────────────────────────────
type Member = {
  id: string
  name: string
  event: string
  sessions: TrainingSession[]
  lastActive: string
  note?: string
}

const DEMO_MEMBERS: Member[] = [
  {
    id: 'demo-tanaka',
    name: '田中 翼',
    event: '100m / 200m',
    lastActive: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    note: '先週から膝に違和感あり',
    sessions: [
      { id: 's1', user_id: 'demo-tanaka', session_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), session_type: 'interval', fatigue_level: 8, condition_level: 5, distance_m: 3000, created_at: new Date().toISOString() },
      { id: 's2', user_id: 'demo-tanaka', session_date: new Date(Date.now() - 172800000).toISOString().slice(0, 10), session_type: 'interval', fatigue_level: 8, condition_level: 5, distance_m: 4000, created_at: new Date().toISOString() },
      { id: 's3', user_id: 'demo-tanaka', session_date: new Date(Date.now() - 604800000).toISOString().slice(0, 10), session_type: 'tempo', fatigue_level: 7, condition_level: 6, distance_m: 5000, created_at: new Date().toISOString() },
    ],
  },
  {
    id: 'demo-suzuki',
    name: '鈴木 愛',
    event: '5000m / 10000m',
    lastActive: new Date().toISOString().slice(0, 10),
    sessions: [
      { id: 's4', user_id: 'demo-suzuki', session_date: new Date().toISOString().slice(0, 10), session_type: 'easy', fatigue_level: 4, condition_level: 8, distance_m: 10000, created_at: new Date().toISOString() },
      { id: 's5', user_id: 'demo-suzuki', session_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), session_type: 'long', fatigue_level: 6, condition_level: 7, distance_m: 15000, created_at: new Date().toISOString() },
    ],
  },
  {
    id: 'demo-yamada',
    name: '山田 健',
    event: '走幅跳',
    lastActive: new Date(Date.now() - 172800000).toISOString().slice(0, 10),
    sessions: [
      { id: 's6', user_id: 'demo-yamada', session_date: new Date(Date.now() - 172800000).toISOString().slice(0, 10), session_type: 'interval', fatigue_level: 6, condition_level: 7, distance_m: 2000, created_at: new Date().toISOString() },
      { id: 's7', user_id: 'demo-yamada', session_date: new Date(Date.now() - 604800000).toISOString().slice(0, 10), session_type: 'easy', fatigue_level: 4, condition_level: 8, distance_m: 6000, created_at: new Date().toISOString() },
    ],
  },
  {
    id: 'demo-sato',
    name: '佐藤 ひな',
    event: '400m / 400mH',
    lastActive: new Date(Date.now() - 259200000).toISOString().slice(0, 10),
    note: '今週は試験期間のため練習少なめ',
    sessions: [
      { id: 's8', user_id: 'demo-sato', session_date: new Date(Date.now() - 259200000).toISOString().slice(0, 10), session_type: 'interval', fatigue_level: 10, condition_level: 4, distance_m: 3200, created_at: new Date().toISOString() },
      { id: 's9', user_id: 'demo-sato', session_date: new Date(Date.now() - 345600000).toISOString().slice(0, 10), session_type: 'interval', fatigue_level: 9, condition_level: 4, distance_m: 2800, created_at: new Date().toISOString() },
      { id: 's10', user_id: 'demo-sato', session_date: new Date(Date.now() - 518400000).toISOString().slice(0, 10), session_type: 'interval', fatigue_level: 9, condition_level: 5, distance_m: 3500, created_at: new Date().toISOString() },
    ],
  },
  {
    id: 'demo-ito',
    name: '伊藤 拓海',
    event: '1500m / 3000mSC',
    lastActive: new Date().toISOString().slice(0, 10),
    sessions: [
      { id: 's11', user_id: 'demo-ito', session_date: new Date().toISOString().slice(0, 10), session_type: 'easy', fatigue_level: 2, condition_level: 9, distance_m: 8000, created_at: new Date().toISOString() },
      { id: 's12', user_id: 'demo-ito', session_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), session_type: 'easy', fatigue_level: 4, condition_level: 8, distance_m: 10000, created_at: new Date().toISOString() },
    ],
  },
]

function daysSince(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (diff === 0) return '今日'
  if (diff === 1) return '昨日'
  return `${diff}日前`
}

// ─────────────────────────────────────────────────────────────
// RoleSelectionScreen
// ─────────────────────────────────────────────────────────────
function RoleSelectionScreen({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={rs.container} showsVerticalScrollIndicator={false}>
          {/* アイコン */}
          <View style={rs.iconWrap}>
            <Ionicons name="people" size={52} color={BRAND} />
          </View>

          <Text style={rs.title}>チーム機能</Text>
          <Text style={rs.sub}>
            あなたの役割を教えてください。{'\n'}
            あとから変更することもできます。
          </Text>

          {/* コーチ */}
          <TouchableOpacity
            style={rs.roleCard}
            activeOpacity={0.85}
            onPress={() => onSelect('coach')}
          >
            <View style={[rs.roleIcon, { backgroundColor: 'rgba(255,59,48,0.15)' }]}>
              <Ionicons name="clipboard" size={32} color={BRAND} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={rs.roleTitle}>コーチ・監督</Text>
              <Text style={rs.roleDesc}>
                選手全員の疲労度・怪我リスク・コンディションを一覧で管理できます
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>

          {/* 選手 */}
          <TouchableOpacity
            style={rs.roleCard}
            activeOpacity={0.85}
            onPress={() => onSelect('player')}
          >
            <View style={[rs.roleIcon, { backgroundColor: 'rgba(52,199,89,0.12)' }]}>
              <Ionicons name="person-circle" size={32} color="#34C759" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={rs.roleTitle}>選手・アスリート</Text>
              <Text style={rs.roleDesc}>
                自分のコンディションを記録し、チームメンバーと共有できます
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#444" />
          </TouchableOpacity>

          <Text style={rs.note}>※ この設定はあとから変更できます</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const rs = StyleSheet.create({
  container: { padding: 24, paddingTop: 40, gap: 16, alignItems: 'stretch' },
  iconWrap:  { alignItems: 'center', marginBottom: 8 },
  title:     { color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  sub:       { color: TEXT.secondary, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 8 },
  roleCard:  {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    padding: 18,
  },
  roleIcon:  { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  roleTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  roleDesc:  { color: TEXT.secondary, fontSize: 12, lineHeight: 18 },
  note:      { color: '#444', fontSize: 11, textAlign: 'center', marginTop: 8 },
})

// ─────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────
function Avatar({ name, size = 44, color = BRAND }: { name: string; size?: number; color?: string }) {
  const initial = name.charAt(0)
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color + '22', borderWidth: 1.5, borderColor: color + '44',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color, fontSize: size * 0.38, fontWeight: '800' }}>{initial}</Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────
// RiskBadge
// ─────────────────────────────────────────────────────────────
function RiskBadge({ score }: { score: number }) {
  const level = score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low'
  const color  = level === 'high' ? '#FF3B30' : level === 'moderate' ? '#FF9500' : '#34C759'
  const label  = level === 'high' ? '要注意' : level === 'moderate' ? '注意' : '良好'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color + '18', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: color + '40' }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────
// MemberCard (コーチ用)
// ─────────────────────────────────────────────────────────────
function MemberCard({ member, onTap }: { member: Member; onTap: () => void }) {
  const lastSession  = member.sessions[0]
  const fatigue      = lastSession ? fatigueInfo(lastSession.fatigue_level) : fatigueInfo(6)
  const risk         = calcInjuryRisk(member.sessions, [], lastSession?.condition_level ?? 6, !!member.note)
  const avatarColors = ['#FF3B30', '#FF9500', '#34C759', '#007AFF', '#AF52DE']
  const colorIdx     = member.name.charCodeAt(0) % avatarColors.length
  const avatarColor  = avatarColors[colorIdx]

  return (
    <TouchableOpacity style={mc.card} activeOpacity={0.85} onPress={onTap}>
      {/* 左: アバター */}
      <Avatar name={member.name} size={46} color={avatarColor} />

      {/* 中: 情報 */}
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={mc.name}>{member.name}</Text>
          <Text style={mc.event}>{member.event}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* 疲労度 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 16 }}>{fatigue.emoji}</Text>
            <Text style={[mc.fatigueLabel, { color: fatigue.color }]}>{fatigue.label}</Text>
          </View>
          {/* 区切り */}
          <Text style={{ color: '#333' }}>·</Text>
          {/* 怪我リスク */}
          <RiskBadge score={risk.riskScore} />
        </View>

        {/* メモ */}
        {member.note ? (
          <Text style={mc.note} numberOfLines={1}>📌 {member.note}</Text>
        ) : null}
      </View>

      {/* 右: 最終記録日 + 矢印 */}
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={mc.lastActive}>{daysSince(member.lastActive)}</Text>
        <Ionicons name="chevron-forward" size={16} color="#333" />
      </View>
    </TouchableOpacity>
  )
}

const mc = StyleSheet.create({
  card:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14 },
  name:        { color: '#fff', fontSize: 15, fontWeight: '800' },
  event:       { color: TEXT.hint, fontSize: 11, fontWeight: '600' },
  fatigueLabel:{ fontSize: 12, fontWeight: '700' },
  note:        { color: TEXT.hint, fontSize: 11, flexShrink: 1 },
  lastActive:  { color: '#555', fontSize: 10 },
})

// ─────────────────────────────────────────────────────────────
// MemberDetail modal (sheet)
// ─────────────────────────────────────────────────────────────
function MemberDetail({ member, onClose }: { member: Member; onClose: () => void }) {
  const risk = calcInjuryRisk(member.sessions, [], member.sessions[0]?.condition_level ?? 6, !!member.note)
  const fatigue = member.sessions[0] ? fatigueInfo(member.sessions[0].fatigue_level) : fatigueInfo(6)

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' }]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={md.sheet}>
        {/* ハンドル */}
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 }} />

        {/* ヘッダー */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Avatar name={member.name} size={52} />
          <View>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{member.name}</Text>
            <Text style={{ color: TEXT.hint, fontSize: 13 }}>{member.event}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ marginLeft: 'auto' }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={TEXT.secondary} />
          </TouchableOpacity>
        </View>

        {/* スコアカード */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <View style={md.statCard}>
            <Text style={{ fontSize: 28 }}>{fatigue.emoji}</Text>
            <Text style={[{ fontSize: 13, fontWeight: '700' }, { color: fatigue.color }]}>{fatigue.label}</Text>
            <Text style={md.statLabel}>最新疲労度</Text>
          </View>
          <View style={md.statCard}>
            <Text style={{ color: risk.signalColor, fontSize: 22, fontWeight: '800' }}>{risk.riskScore}</Text>
            <Text style={[{ fontSize: 12, fontWeight: '700' }, { color: risk.signalColor }]}>{risk.label}</Text>
            <Text style={md.statLabel}>怪我リスク</Text>
          </View>
          <View style={md.statCard}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{risk.weeklyKm}<Text style={{ fontSize: 11, color: '#666' }}>km</Text></Text>
            <Text style={{ color: '#888', fontSize: 11 }}>先週 {risk.prevWeeklyKm}km</Text>
            <Text style={md.statLabel}>今週の距離</Text>
          </View>
        </View>

        {/* リスク要因 */}
        {risk.reasons.length > 0 ? (
          <View style={md.reasonBox}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 8 }}>⚠️ 注意ポイント</Text>
            {risk.reasons.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                <Text style={{ color: '#FF9500', fontSize: 12 }}>•</Text>
                <Text style={{ color: TEXT.secondary, fontSize: 12, flex: 1 }}>{r}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={[md.reasonBox, { borderColor: '#34C759' + '30' }]}>
            <Text style={{ color: '#34C759', fontSize: 13, fontWeight: '700' }}>✓ {risk.recommendation}</Text>
          </View>
        )}

        {/* メモ */}
        {member.note ? (
          <View style={[md.reasonBox, { marginTop: 10, borderColor: '#9B6BFF' + '40' }]}>
            <Text style={{ color: '#9B6BFF', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>📌 コーチメモ</Text>
            <Text style={{ color: TEXT.secondary, fontSize: 13 }}>{member.note}</Text>
          </View>
        ) : null}

        {/* 最終記録 */}
        <Text style={{ color: '#444', fontSize: 11, textAlign: 'center', marginTop: 16 }}>
          最終練習記録: {daysSince(member.lastActive)}
        </Text>
      </View>
    </View>
  )
}

const md = StyleSheet.create({
  sheet:    { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 44, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statCard: { flex: 1, alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingVertical: 14 },
  statLabel:{ color: '#555', fontSize: 10, marginTop: 2 },
  reasonBox:{ backgroundColor: 'rgba(255,149,0,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,149,0,0.3)', padding: 12 },
})

// ─────────────────────────────────────────────────────────────
// CoachDashboard
// ─────────────────────────────────────────────────────────────
function CoachDashboard({ onReset }: { onReset: () => void }) {
  const [members, setMembers]         = useState<Member[]>([])
  const [selectedMember, setSelected] = useState<Member | null>(null)

  useEffect(() => {
    // デモメンバーをロード（実運用ではサーバー同期）
    setMembers(DEMO_MEMBERS)
  }, [])

  const highRiskCount   = members.filter(m => {
    const r = calcInjuryRisk(m.sessions, [], m.sessions[0]?.condition_level ?? 6, !!m.note)
    return r.riskScore >= 50
  }).length
  const activeToday = members.filter(m => m.lastActive === new Date().toISOString().slice(0, 10)).length

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={cd.scroll} showsVerticalScrollIndicator={false}>

          {/* ヘッダー */}
          <View style={cd.header}>
            <View>
              <Text style={cd.title}>チームダッシュボード</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={{ backgroundColor: BRAND + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: BRAND, fontSize: 11, fontWeight: '700' }}>コーチ・監督</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onReset} style={cd.roleBtn} activeOpacity={0.7}>
              <Ionicons name="swap-horizontal-outline" size={16} color={TEXT.secondary} />
              <Text style={{ color: TEXT.secondary, fontSize: 11 }}>切替</Text>
            </TouchableOpacity>
          </View>

          {/* 概要 */}
          <View style={cd.statsRow}>
            <View style={cd.statBox}>
              <Text style={cd.statNum}>{members.length}</Text>
              <Text style={cd.statLabel}>メンバー</Text>
            </View>
            <View style={[cd.statBox, highRiskCount > 0 && { borderColor: '#FF3B30' + '40' }]}>
              <Text style={[cd.statNum, highRiskCount > 0 && { color: '#FF3B30' }]}>{highRiskCount}</Text>
              <Text style={cd.statLabel}>要注意</Text>
            </View>
            <View style={cd.statBox}>
              <Text style={[cd.statNum, { color: '#34C759' }]}>{activeToday}</Text>
              <Text style={cd.statLabel}>今日活動</Text>
            </View>
          </View>

          {/* 要注意バナー */}
          {highRiskCount > 0 ? (
            <View style={cd.alertBanner}>
              <Ionicons name="warning-outline" size={16} color="#FF3B30" />
              <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '700', flex: 1 }}>
                {highRiskCount}人のメンバーに怪我リスクの上昇が見られます
              </Text>
            </View>
          ) : null}

          {/* メンバーリスト */}
          <Text style={cd.sectionTitle}>メンバー一覧</Text>
          <View style={{ gap: 10 }}>
            {members.map(member => (
              <MemberCard
                key={member.id}
                member={member}
                onTap={() => setSelected(member)}
              />
            ))}
          </View>

          {/* 説明フッター */}
          <View style={cd.footer}>
            <Ionicons name="information-circle-outline" size={14} color="#444" />
            <Text style={{ color: '#444', fontSize: 11, flex: 1, lineHeight: 16 }}>
              疲労度・怪我リスクは選手の練習記録から自動計算されます。体重などのプライベートな情報は表示されません。
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* メンバー詳細オーバーレイ */}
      {selectedMember ? (
        <MemberDetail member={selectedMember} onClose={() => setSelected(null)} />
      ) : null}
    </View>
  )
}

const cd = StyleSheet.create({
  scroll:       { padding: 16, paddingBottom: 48, gap: 14 },
  header:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title:        { color: '#fff', fontSize: 22, fontWeight: '800' },
  roleBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statsRow:     { flexDirection: 'row', gap: 10 },
  statBox:      { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingVertical: 14, gap: 4 },
  statNum:      { color: '#fff', fontSize: 22, fontWeight: '800' },
  statLabel:    { color: '#555', fontSize: 11 },
  alertBanner:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FF3B30' + '12', borderRadius: 12, borderWidth: 1, borderColor: '#FF3B30' + '30', padding: 12 },
  sectionTitle: { color: TEXT.hint, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  footer:       { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 8 },
})

// ─────────────────────────────────────────────────────────────
// PlayerDashboard
// ─────────────────────────────────────────────────────────────
function PlayerDashboard({ onReset }: { onReset: () => void }) {
  const [sessions,  setSessions]  = useState<TrainingSession[]>([])
  const [riskScore, setRiskScore] = useState(0)
  const [riskColor, setRiskColor] = useState('#34C759')
  const [riskLabel, setRiskLabel] = useState('コンディション良好')

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SESSIONS_KEY)
      const s: TrainingSession[] = raw ? JSON.parse(raw) : []
      setSessions(s)
      const result = calcInjuryRisk(s, [], s[0]?.condition_level ?? 7)
      setRiskScore(result.riskScore)
      setRiskColor(result.signalColor)
      setRiskLabel(result.label)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

  const lastSession  = sessions[0]
  const fatigue      = lastSession ? fatigueInfo(lastSession.fatigue_level) : null
  const thisWeekSessions = sessions.filter(s =>
    Date.now() - new Date(s.session_date).getTime() <= 7 * 86400000
  )

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={pd.scroll} showsVerticalScrollIndicator={false}>

          {/* ヘッダー */}
          <View style={pd.header}>
            <View>
              <Text style={pd.title}>マイ コンディション</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <View style={{ backgroundColor: '#34C759' + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: '#34C759', fontSize: 11, fontWeight: '700' }}>選手</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onReset} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} activeOpacity={0.7}>
              <Ionicons name="swap-horizontal-outline" size={16} color={TEXT.secondary} />
              <Text style={{ color: TEXT.secondary, fontSize: 11 }}>切替</Text>
            </TouchableOpacity>
          </View>

          {/* コンディションカード */}
          <View style={pd.condCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>今のコンディション</Text>
              <Text style={{ color: TEXT.hint, fontSize: 11 }}>{new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* 疲労度 */}
              <View style={pd.metricBox}>
                <Text style={{ fontSize: 32 }}>{fatigue?.emoji ?? '—'}</Text>
                <Text style={[{ fontSize: 14, fontWeight: '700', marginTop: 4 }, { color: fatigue?.color ?? '#888' }]}>
                  {fatigue?.label ?? 'データなし'}
                </Text>
                <Text style={pd.metricLabel}>最新疲労度</Text>
              </View>

              {/* 怪我リスク */}
              <View style={pd.metricBox}>
                <Text style={{ color: riskColor, fontSize: 28, fontWeight: '900' }}>{riskScore}</Text>
                <Text style={[{ fontSize: 12, fontWeight: '700', marginTop: 4 }, { color: riskColor }]}>{riskLabel}</Text>
                <Text style={pd.metricLabel}>怪我リスクスコア</Text>
              </View>
            </View>

            {/* 今週の練習 */}
            <View style={[pd.metricBox, { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 }]}>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{thisWeekSessions.length}</Text>
                <Text style={pd.metricLabel}>今週の練習</Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>
                  {(thisWeekSessions.reduce((a, s) => a + (s.distance_m ?? 0), 0) / 1000).toFixed(1)}
                  <Text style={{ fontSize: 12, color: '#666' }}>km</Text>
                </Text>
                <Text style={pd.metricLabel}>今週の距離</Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)' }} />
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>{sessions.length}</Text>
                <Text style={pd.metricLabel}>総練習回数</Text>
              </View>
            </View>
          </View>

          {/* チームメンバー（選手視点） */}
          <Text style={pd.sectionTitle}>チームメンバー</Text>
          <View style={{ gap: 10 }}>
            {DEMO_MEMBERS.map(m => {
              const colors = ['#FF3B30', '#FF9500', '#34C759', '#007AFF', '#AF52DE']
              const c = colors[m.name.charCodeAt(0) % colors.length]
              return (
                <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 12 }}>
                  <Avatar name={m.name} size={38} color={c} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{m.name}</Text>
                    <Text style={{ color: TEXT.hint, fontSize: 11 }}>{m.event}</Text>
                  </View>
                  <Text style={{ color: '#444', fontSize: 11 }}>{daysSince(m.lastActive)}</Text>
                </View>
              )
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 8 }}>
            <Ionicons name="lock-closed-outline" size={13} color="#444" />
            <Text style={{ color: '#444', fontSize: 11, flex: 1, lineHeight: 16 }}>
              チームへの共有は疲労度・練習記録のみです。体重などのプライベートな情報は共有されません。
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const pd = StyleSheet.create({
  scroll:      { padding: 16, paddingBottom: 48, gap: 14 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title:       { color: '#fff', fontSize: 22, fontWeight: '800' },
  condCard:    { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16 },
  metricBox:   { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingVertical: 14, gap: 2 },
  metricLabel: { color: '#555', fontSize: 10, marginTop: 2 },
  sectionTitle:{ color: TEXT.hint, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
})

// ─────────────────────────────────────────────────────────────
// TeamScreen（エントリーポイント）
// ─────────────────────────────────────────────────────────────
export default function TeamScreen() {
  const [role, setRole] = useState<Role | null | 'loading'>('loading')

  useEffect(() => {
    AsyncStorage.getItem(ROLE_KEY).then(v => {
      setRole((v as Role) ?? null)
    })
  }, [])

  async function handleSelectRole(r: Role) {
    await AsyncStorage.setItem(ROLE_KEY, r)
    setRole(r)
  }

  async function handleReset() {
    await AsyncStorage.removeItem(ROLE_KEY)
    setRole(null)
  }

  if (role === 'loading') {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />
  }

  if (role === null) {
    return <RoleSelectionScreen onSelect={handleSelectRole} />
  }

  if (role === 'coach') {
    return <CoachDashboard onReset={handleReset} />
  }

  return <PlayerDashboard onReset={handleReset} />
}
