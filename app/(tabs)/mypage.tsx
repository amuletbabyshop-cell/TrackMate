// app/(tabs)/mypage.tsx — マイページ（プロフィール・各機能へのアクセス）
import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { BRAND, TEXT, SURFACE, SURFACE2, DIVIDER, NEON } from '../../lib/theme'
import { useTheme } from '../../context/ThemeContext'
import { Sounds, unlockAudio } from '../../lib/sounds'
import {
  requestPermission, getPermission, scheduleTrainingReminder,
  cancelTrainingReminder, scheduleMorningReminder, scheduleSleepReminder,
} from '../../lib/notifications'
import PressableScale from '../../components/PressableScale'
import GlassCard from '../../components/GlassCard'

const PROFILE_KEY = 'trackmate_my_profile'

interface MyProfile {
  name: string
  primary_event: string
  grade?: string
}

// ── クイックリンク定義 ──────────────────────────────────────────
const LINKS = [
  { icon: '🏆', label: 'タイム記録',   sub: '自己ベスト管理',   route: '/(tabs)/records',      color: '#FFD700' },
  { icon: '🍽️', label: '栄養管理',     sub: 'AI食事分析',       route: '/(tabs)/nutrition',    color: NEON.green },
  { icon: '😴', label: '睡眠記録',     sub: '回復状況の把握',   route: '/(tabs)/sleep',        color: NEON.blue },
  { icon: '🏅', label: '試合計画',     sub: 'AIペーシング',     route: '/(tabs)/competition',  color: BRAND },
  { icon: '👥', label: 'チーム',       sub: 'タイムライン',     route: '/(tabs)/team',         color: '#9B6BFF' },
  { icon: '🤖', label: 'AI診断',       sub: '今週を分析',       route: '/ai-diagnosis',        color: '#4A9FFF' },
  { icon: '📅', label: 'カレンダー詳細', sub: '全記録を表示',   route: '/calendar',            color: NEON.amber },
  { icon: '⚙️', label: '設定',         sub: 'アカウント管理',   route: '/settings',            color: TEXT.secondary },
] as const

export default function MyPageScreen() {
  const router = useRouter()
  const [profile, setProfile] = useState<MyProfile>({ name: '', primary_event: '400m' })
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifPerm, setNotifPerm] = useState<string>('default')

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then(v => { if (v) setProfile(JSON.parse(v)) }).catch(() => {})
    const perm = getPermission()
    setNotifPerm(perm)
    setNotifEnabled(perm === 'granted')
  }, [])

  async function toggleNotif(val: boolean) {
    unlockAudio()
    Sounds.toggleOn()
    if (val) {
      const result = await requestPermission()
      if (result === 'granted') {
        scheduleTrainingReminder()
        scheduleMorningReminder()
        scheduleSleepReminder()
        setNotifEnabled(true)
        setNotifPerm('granted')
      }
    } else {
      cancelTrainingReminder()
      setNotifEnabled(false)
    }
  }

  const { colors } = useTheme()
  const displayName = profile.name || 'アスリート'
  const initials = displayName.slice(0, 2)
  const eventLabel = profile.primary_event || '—'

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>

          {/* ── プロフィールカード ── */}
          <GlassCard>
            <View style={st.profileRow}>
              <View style={st.avatar}>
                <Text style={st.avatarText}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.profileName, { color: colors.text }]}>{displayName}</Text>
                <View style={[st.eventBadge, { backgroundColor: colors.surface2 }]}>
                  <Text style={[st.eventText, { color: colors.textSec }]}>{eventLabel}</Text>
                </View>
                {profile.grade ? <Text style={[st.gradeTxt, { color: colors.textHint }]}>{profile.grade}</Text> : null}
              </View>
              <PressableScale haptic="light" onPress={() => { unlockAudio(); Sounds.tap(); router.push('/settings') }}>
                <View style={[st.editBtn, { backgroundColor: colors.surface2 }]}>
                  <Ionicons name="pencil" size={14} color={colors.textSec} />
                  <Text style={[st.editTxt, { color: colors.textSec }]}>編集</Text>
                </View>
              </PressableScale>
            </View>
          </GlassCard>

          {/* ── 機能グリッド ── */}
          <View>
            <Text style={[st.sectionLabel, { color: colors.textHint }]}>FEATURES</Text>
            <View style={{ gap: 8 }}>
              {Array.from({ length: Math.ceil(LINKS.length / 2) }, (_, ri) => (
                <View key={ri} style={st.grid}>
                  {LINKS.slice(ri * 2, ri * 2 + 2).map(link => (
                    <PressableScale
                      key={link.label}
                      haptic="medium"
                      scaleAmount={0.93}
                      style={{ flex: 1 }}
                      onPress={() => { unlockAudio(); Sounds.tap(); router.push(link.route as any) }}
                    >
                      <View style={[st.gridCard, { backgroundColor: colors.surface, borderColor: link.color + '33' }]}>
                        <Text style={st.gridIcon}>{link.icon}</Text>
                        <Text style={[st.gridLabel, { color: colors.text }]}>{link.label}</Text>
                        <Text style={[st.gridSub, { color: colors.textHint }]}>{link.sub}</Text>
                      </View>
                    </PressableScale>
                  ))}
                </View>
              ))}
            </View>
          </View>

          {/* ── 通知設定 ── */}
          <GlassCard>
            <Text style={[st.sectionLabel, { color: colors.textHint }]}>NOTIFICATIONS</Text>
            <View style={st.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={[st.notifTitle, { color: colors.text }]}>怪我予防リマインダー</Text>
                <Text style={[st.notifSub, { color: colors.textSec }]}>
                  {notifPerm === 'denied'
                    ? 'ブラウザの設定で通知を許可してください'
                    : '朝7時のリスク確認・夜22時の睡眠記録'}
                </Text>
              </View>
              <Switch
                value={notifEnabled}
                onValueChange={toggleNotif}
                trackColor={{ false: SURFACE2, true: NEON.green }}
                thumbColor="#fff"
                disabled={notifPerm === 'denied'}
              />
            </View>
          </GlassCard>

          {/* ── アプリ情報 ── */}
          <View style={st.appInfo}>
            <Text style={[st.appInfoText, { color: colors.textHint }]}>TrackMate  v1.0.0</Text>
            <Text style={[st.appInfoText, { color: colors.textHint }]}>陸上選手の怪我予防・パフォーマンス向上</Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const st = StyleSheet.create({
  content:      { padding: 16, gap: 14, paddingBottom: 36 },
  sectionLabel: { color: TEXT.hint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },

  // Profile
  profileRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar:      { width: 56, height: 56, borderRadius: 28, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: '#fff', fontSize: 20, fontWeight: '800' },
  profileName: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  eventBadge:  { backgroundColor: SURFACE2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  eventText:   { color: TEXT.secondary, fontSize: 12, fontWeight: '700' },
  gradeTxt:    { color: TEXT.hint, fontSize: 12, marginTop: 3 },
  editBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: SURFACE2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  editTxt:     { color: TEXT.secondary, fontSize: 12, fontWeight: '600' },

  // Grid
  grid:         { flexDirection: 'row', gap: 8 },
  gridCard:     {
    height: 90, backgroundColor: SURFACE, borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', gap: 4,
  },
  gridIcon:     { fontSize: 26 },
  gridLabel:    { color: '#fff', fontSize: 13, fontWeight: '800' },
  gridSub:      { color: TEXT.hint, fontSize: 11 },

  // Notif
  notifRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notifTitle:  { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  notifSub:    { color: TEXT.secondary, fontSize: 12, lineHeight: 17 },

  // App info
  appInfo:     { alignItems: 'center', paddingVertical: 8, gap: 4 },
  appInfoText: { color: TEXT.hint, fontSize: 12 },
})
