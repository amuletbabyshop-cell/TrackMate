import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform,
  Animated, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Toast from 'react-native-toast-message'
import { BG_GRADIENT, BRAND, TEXT, NEON } from '../../lib/theme'
import { Sounds, unlockAudio } from '../../lib/sounds'
import AnimatedSection from '../../components/AnimatedSection'
import { useAuth } from '../../context/AuthContext'
import { useRouter } from 'expo-router'
import type {
  TeamProfile, TeamMember, CoachNote, MyProfile,
  AthleticsEvent, MemberRole,
} from '../../types'

const TEAM_KEY      = 'trackmate_team'
const PROFILE_KEY   = 'trackmate_my_profile'
const TIMELINE_KEY  = 'trackmate_timeline'

type TimelinePost = {
  id: string
  authorId: string
  authorName: string
  authorInitial: string
  type: 'run' | 'timer' | 'menu' | 'pb' | 'competition'
  content: string
  timestamp: string  // ISO
  reactions: number
  hasReacted: boolean
}

const DEMO_POSTS: TimelinePost[] = [
  {
    id: 'demo_1',
    authorId: 'demo-tanaka',
    authorName: '田中 翼',
    authorInitial: '田',
    type: 'timer',
    content: '100m 10.98秒! 初めて10秒台！',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    reactions: 5,
    hasReacted: false,
  },
  {
    id: 'demo_2',
    authorId: 'demo-suzuki',
    authorName: '鈴木 愛',
    authorInitial: '鈴',
    type: 'run',
    content: '15km のロング走完了 💪 ペース4:32/km',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    reactions: 3,
    hasReacted: false,
  },
  {
    id: 'demo_3',
    authorId: 'demo-sato',
    authorName: '佐藤 健',
    authorInitial: '佐',
    type: 'pb',
    content: '400m PB更新！48.7→48.2秒',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    reactions: 8,
    hasReacted: false,
  },
]

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'たった今'
  if (mins < 60) return `${mins}分前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}時間前`
  return `${Math.floor(hrs / 24)}日前`
}

function typeIcon(type: TimelinePost['type']): string {
  switch (type) {
    case 'timer': return '⏱️'
    case 'run':   return '🏃'
    case 'pb':    return '🏆'
    case 'menu':  return '📋'
    case 'competition': return '🎌'
    default: return '📝'
  }
}

function TimelineSection() {
  const [posts, setPosts] = useState<TimelinePost[]>([])

  useEffect(() => {
    AsyncStorage.getItem(TIMELINE_KEY).then(raw => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as TimelinePost[]
          // マージ: 保存データ + デモデータ（デモIDが保存に存在しない場合のみ追加）
          const savedIds = new Set(saved.map(p => p.id))
          const merged = [...saved, ...DEMO_POSTS.filter(d => !savedIds.has(d.id))]
          merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          setPosts(merged)
        } catch {
          setPosts(DEMO_POSTS)
        }
      } else {
        setPosts(DEMO_POSTS)
      }
    })
  }, [])

  const handleReact = useCallback(async (postId: string) => {
    setPosts(prev => {
      const next = prev.map(p =>
        p.id === postId
          ? { ...p, reactions: p.hasReacted ? p.reactions - 1 : p.reactions + 1, hasReacted: !p.hasReacted }
          : p
      )
      AsyncStorage.setItem(TIMELINE_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
  }, [])

  const handleShare = useCallback(async () => {
    const raw = await AsyncStorage.getItem('trackmate_sessions')
    let content = '練習を記録しました！'
    if (raw) {
      try {
        const sessions = JSON.parse(raw)
        if (sessions.length > 0) {
          const latest = sessions[0]
          const typeLabel: Record<string, string> = {
            interval: 'インターバル走', tempo: 'テンポ走', easy: 'ジョグ',
            long: 'ロング走', sprint: 'スプリント', drill: 'ドリル',
            strength: 'ウェイト', race: '試合', rest: '休養',
          }
          content = `${typeLabel[latest.session_type] ?? latest.session_type}を実施！`
          if (latest.distance_m) content += ` ${latest.distance_m >= 1000 ? `${(latest.distance_m / 1000).toFixed(1)}km` : `${latest.distance_m}m`}`
          if (latest.time_ms) {
            const s = latest.time_ms / 1000
            content += ` ${s < 60 ? `${s.toFixed(2)}秒` : `${Math.floor(s / 60)}分${(s % 60).toFixed(0)}秒`}`
          }
        }
      } catch {}
    }

    const profileRaw = await AsyncStorage.getItem(PROFILE_KEY)
    let authorName = '自分'
    let authorInitial = '自'
    if (profileRaw) {
      try {
        const p = JSON.parse(profileRaw)
        if (p.name) { authorName = p.name; authorInitial = p.name.charAt(0) }
      } catch {}
    }

    const newPost: TimelinePost = {
      id: `post_${Date.now()}`,
      authorId: 'me',
      authorName,
      authorInitial,
      type: 'menu',
      content,
      timestamp: new Date().toISOString(),
      reactions: 0,
      hasReacted: false,
    }

    setPosts(prev => {
      const next = [newPost, ...prev]
      AsyncStorage.setItem(TIMELINE_KEY, JSON.stringify(next)).catch(() => {})
      return next
    })
    Sounds.save()
    Toast.show({ type: 'success', text1: 'タイムラインにシェアしました' })
  }, [])

  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Ionicons name="newspaper-outline" size={16} color={NEON.blue} />
        <Text style={styles.cardTitle}>チームタイムライン</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BRAND, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Ionicons name="share-outline" size={14} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>シェア</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: 10 }}>
        {posts.slice(0, 10).map(post => (
          <View
            key={post.id}
            style={{
              flexDirection: 'row',
              gap: 10,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(74,159,255,0.1)',
              padding: 12,
            }}
          >
            {/* アバター */}
            <View style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: NEON.blue + '33',
              borderWidth: 2, borderColor: NEON.blue,
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Text style={{ color: NEON.blue, fontSize: 15, fontWeight: '800' }}>{post.authorInitial}</Text>
            </View>
            {/* コンテンツ */}
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: TEXT.primary, fontSize: 13, fontWeight: '700' }}>{post.authorName}</Text>
                <Text style={{ color: TEXT.hint, fontSize: 11 }}>{timeAgo(post.timestamp)}</Text>
              </View>
              <Text style={{ color: TEXT.secondary, fontSize: 13, lineHeight: 19 }}>
                {typeIcon(post.type)} {post.content}
              </Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 2 }}
                onPress={() => handleReact(post.id)}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14 }}>{post.hasReacted ? '👏' : '👐'}</Text>
                <Text style={{ color: post.hasReacted ? NEON.amber : TEXT.hint, fontSize: 12, fontWeight: '600' }}>
                  {post.reactions}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

const ALL_EVENTS: AthleticsEvent[] = [
  '100m','200m','400m','800m','1500m','3000m','5000m','10000m',
  '110mH','100mH','400mH','3000mSC','half_marathon','marathon',
  '走幅跳','三段跳','走高跳','棒高跳','砲丸投','やり投','円盤投','ハンマー投',
]
const GRADES = ['1年','2年','3年','4年','社会人','OB/OG']
const SPECIALTIES = ['短距離','中長距離','跳躍','投擲','混成','全般']
const ROLES: { value: MemberRole; label: string; color: string }[] = [
  { value: 'athlete',  label: '選手',    color: NEON.blue },
  { value: 'coach',    label: 'コーチ',  color: NEON.green },
  { value: 'manager',  label: 'マネージャー', color: NEON.amber },
]

const DEFAULT_TEAM: TeamProfile = {
  team_name: '',
  school_or_club: '',
  coach_name: '',
  coach_specialty: '全般',
  members: [],
  coach_notes: [],
}
const DEFAULT_PROFILE: MyProfile = {
  name: '',
  primary_event: '400m',
  secondary_events: [],
  grade: '1年',
}

// ── スケルトン ────────────────────────────────────────────────────
function Skeleton({ h = 16 }: { h?: number }) {
  const op = useRef(new Animated.Value(0.3)).current
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 0.8, duration: 700, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.3, duration: 700, useNativeDriver: true }),
    ]))
    a.start(); return () => a.stop()
  }, [op])
  return <Animated.View style={{ height: h, width: '100%', borderRadius: 8, backgroundColor: '#1e2a3a', opacity: op }} />
}

// ── アバター ─────────────────────────────────────────────────────
function Avatar({ name, size = 44, color = BRAND }: { name: string; size?: number; color?: string }) {
  const initial = name ? name.charAt(0) : '?'
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '33', borderWidth: 2, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontSize: size * 0.4, fontWeight: '800' }}>{initial}</Text>
    </View>
  )
}

// ── ロールバッジ ─────────────────────────────────────────────────
function RoleBadge({ role }: { role: MemberRole }) {
  const r = ROLES.find(x => x.value === role)!
  return (
    <View style={{ backgroundColor: r.color + '22', borderRadius: 4, borderWidth: 1, borderColor: r.color, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: r.color, fontSize: 10, fontWeight: '700' }}>{r.label}</Text>
    </View>
  )
}

// ── メンバーカード ────────────────────────────────────────────────
function MemberCard({ member, onDelete }: { member: TeamMember; onDelete: () => void }) {
  const roleColor = ROLES.find(r => r.value === member.role)?.color ?? TEXT.secondary
  return (
    <View style={styles.memberCard}>
      <Avatar name={member.name} size={40} color={roleColor} />
      <View style={styles.memberInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.memberName}>{member.name}</Text>
          {member.grade && <Text style={styles.memberGrade}>{member.grade}</Text>}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <RoleBadge role={member.role} />
          <Text style={styles.memberEvent}>{member.event}</Text>
          {member.pb_display && (
            <Text style={styles.memberPB}>{member.pb_display}</Text>
          )}
        </View>
        {member.notes ? <Text style={styles.memberNotes} numberOfLines={1}>{member.notes}</Text> : null}
      </View>
      <TouchableOpacity onPress={onDelete} style={{ padding: 6 }}>
        <Ionicons name="close-circle-outline" size={20} color={TEXT.hint} />
      </TouchableOpacity>
    </View>
  )
}

// ── コーチノートカード ────────────────────────────────────────────
function NoteCard({ note, onDelete, onTogglePin }: { note: CoachNote; onDelete: () => void; onTogglePin: () => void }) {
  return (
    <View style={[styles.noteCard, note.pinned && styles.noteCardPinned]}>
      <View style={styles.noteHeader}>
        <Text style={styles.noteDate}>{note.date}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={onTogglePin}>
            <Ionicons name={note.pinned ? 'pin' : 'pin-outline'} size={16} color={note.pinned ? NEON.amber : TEXT.hint} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete}>
            <Ionicons name="trash-outline" size={16} color={TEXT.hint} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.noteContent}>{note.content}</Text>
    </View>
  )
}

// ══════════════════════════════════════════════════════════════════
// メイン
// ══════════════════════════════════════════════════════════════════
export default function TeamScreen() {
  const [team, setTeam]       = useState<TeamProfile>(DEFAULT_TEAM)
  const [profile, setProfile] = useState<MyProfile>(DEFAULT_PROFILE)
  const [loading, setLoading] = useState(true)

  // モーダル管理
  const [showProfileModal,  setShowProfileModal]  = useState(false)
  const [showTeamModal,     setShowTeamModal]      = useState(false)
  const [showMemberModal,   setShowMemberModal]    = useState(false)
  const [showNoteModal,     setShowNoteModal]      = useState(false)

  // メンバーフォーム
  const [mName,    setMName]    = useState('')
  const [mEvent,   setMEvent]   = useState<AthleticsEvent>('100m')
  const [mRole,    setMRole]    = useState<MemberRole>('athlete')
  const [mGrade,   setMGrade]   = useState('1年')
  const [mPB,      setMPB]      = useState('')
  const [mNotes,   setMNotes]   = useState('')

  // ノートフォーム
  const [nContent, setNContent] = useState('')

  // ─── ロード ────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(TEAM_KEY),
      AsyncStorage.getItem(PROFILE_KEY),
    ]).then(([rawTeam, rawProfile]) => {
      if (rawTeam)    try { setTeam(JSON.parse(rawTeam)) } catch {}
      if (rawProfile) try { setProfile(JSON.parse(rawProfile)) } catch {}
      setLoading(false)
    })
  }, [])

  // ─── 保存ヘルパー ────────────────────────────────────────────────
  const saveTeam = useCallback(async (next: TeamProfile) => {
    await AsyncStorage.setItem(TEAM_KEY, JSON.stringify(next))
    setTeam(next)
  }, [])
  const saveProfile = useCallback(async (next: MyProfile) => {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next))
    setProfile(next)
  }, [])

  // ─── メンバー追加 ──────────────────────────────────────────────
  const handleAddMember = useCallback(async () => {
    if (!mName.trim()) { Toast.show({ type: 'error', text1: '名前を入力してください' }); return }
    const member: TeamMember = {
      id: `m_${Date.now()}`, name: mName.trim(), event: mEvent,
      role: mRole, grade: mGrade, pb_display: mPB || undefined, notes: mNotes || undefined,
    }
    await saveTeam({ ...team, members: [...team.members, member] })
    setMName(''); setMEvent('100m'); setMRole('athlete'); setMGrade('1年'); setMPB(''); setMNotes('')
    Sounds.save()
    setShowMemberModal(false)
    Toast.show({ type: 'success', text1: `✅ ${member.name} を追加しました` })
  }, [mName, mEvent, mRole, mGrade, mPB, mNotes, team, saveTeam])

  // ─── メンバー削除 ──────────────────────────────────────────────
  const handleDeleteMember = useCallback((id: string) => {
    Alert.alert('削除確認', 'このメンバーを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => { Sounds.delete(); saveTeam({ ...team, members: team.members.filter(m => m.id !== id) }) } },
    ])
  }, [team, saveTeam])

  // ─── コーチノート追加 ─────────────────────────────────────────
  const handleAddNote = useCallback(async () => {
    if (!nContent.trim()) { Toast.show({ type: 'error', text1: 'メモを入力してください' }); return }
    const note: CoachNote = {
      id: `n_${Date.now()}`, content: nContent.trim(),
      date: new Date().toISOString().slice(0, 10), pinned: false,
    }
    await saveTeam({ ...team, coach_notes: [note, ...team.coach_notes] })
    Sounds.save()
    setNContent(''); setShowNoteModal(false)
    Toast.show({ type: 'success', text1: 'メモを追加しました' })
  }, [nContent, team, saveTeam])

  // ─── ピン切替 ─────────────────────────────────────────────────
  const togglePin = useCallback((id: string) => {
    const updated = team.coach_notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n)
    saveTeam({ ...team, coach_notes: updated })
  }, [team, saveTeam])

  // ─── ノート削除 ───────────────────────────────────────────────
  const deleteNote = useCallback((id: string) => {
    saveTeam({ ...team, coach_notes: team.coach_notes.filter(n => n.id !== id) })
  }, [team, saveTeam])

  const pinnedNotes  = team.coach_notes.filter(n => n.pinned)
  const otherNotes   = team.coach_notes.filter(n => !n.pinned)
  const sortedNotes  = [...pinnedNotes, ...otherNotes]
  const athletes     = team.members.filter(m => m.role === 'athlete')
  const coaches      = team.members.filter(m => m.role === 'coach')
  const managers     = team.members.filter(m => m.role === 'manager')
  const { user, signOut, isGuest } = useAuth()
  const router = useRouter()

  // ══════════════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>

        {/* ヘッダー */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>チーム</Text>
            {user ? (
              <Text style={{ color: NEON.green, fontSize: 11, fontWeight: '600' }}>● {user.email}</Text>
            ) : isGuest ? (
              <Text style={{ color: TEXT.hint, fontSize: 11 }}>ゲストモード</Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* 招待ボタン */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => { Sounds.whoosh(); router.push('/team-invite') }}
              activeOpacity={0.8}
            >
              <Ionicons name="link-outline" size={18} color={NEON.blue} />
            </TouchableOpacity>
            {(user || isGuest) && (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => Alert.alert('ログアウト', 'ログアウトしますか？', [
                  { text: 'キャンセル', style: 'cancel' },
                  { text: 'ログアウト', style: 'destructive', onPress: () => { Sounds.delete(); signOut() } },
                ])}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={18} color={TEXT.secondary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowMemberModal(true)} activeOpacity={0.8}>
              <Ionicons name="person-add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* ── 自分のプロフィール ── */}
          <AnimatedSection delay={0} type="fade-up">
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <Avatar name={profile.name || '?'} size={52} color={BRAND} />
                <View style={{ flex: 1 }}>
                  {loading ? <Skeleton h={18} /> : (
                    <>
                      <Text style={styles.myName}>{profile.name || '名前を設定してください'}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <View style={styles.eventTag}>
                          <Text style={styles.eventTagText}>{profile.primary_event}</Text>
                        </View>
                        {profile.grade && <Text style={styles.gradeText}>{profile.grade}</Text>}
                      </View>
                      {profile.coach_name && (
                        <Text style={styles.coachRef}>コーチ: {profile.coach_name}</Text>
                      )}
                    </>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowProfileModal(true)} style={styles.editBtn}>
                <Ionicons name="create-outline" size={18} color={NEON.blue} />
              </TouchableOpacity>
            </View>
          </View>
          </AnimatedSection>

          {/* ── チーム情報 ── */}
          <AnimatedSection delay={80} type="fade-up">
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>チーム</Text>
                {loading ? <Skeleton h={20} /> : (
                  <>
                    <Text style={styles.teamName}>{team.team_name || 'チーム名未設定'}</Text>
                    {team.school_or_club ? <Text style={styles.schoolText}>{team.school_or_club}</Text> : null}
                    {team.coach_name ? (
                      <View style={styles.coachRow}>
                        <Avatar name={team.coach_name} size={28} color={NEON.green} />
                        <View>
                          <Text style={styles.coachName}>{team.coach_name} コーチ</Text>
                          {team.coach_specialty ? <Text style={styles.coachSpec}>{team.coach_specialty}専門</Text> : null}
                        </View>
                      </View>
                    ) : null}
                  </>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowTeamModal(true)} style={styles.editBtn}>
                <Ionicons name="create-outline" size={18} color={NEON.blue} />
              </TouchableOpacity>
            </View>

            {/* メンバーカウント */}
            {!loading && team.members.length > 0 && (
              <View style={styles.statsRow}>
                {[
                  { label: '選手', count: athletes.length, color: NEON.blue },
                  { label: 'コーチ', count: coaches.length, color: NEON.green },
                  { label: 'マネージャー', count: managers.length, color: NEON.amber },
                ].map(s => (
                  <View key={s.label} style={styles.statItem}>
                    <Text style={[styles.statCount, { color: s.color }]}>{s.count}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          </AnimatedSection>

          {/* ── コーチビュー ── */}
          <AnimatedSection delay={140} type="fade-up">
          <TouchableOpacity
            style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
            onPress={() => { Sounds.whoosh(); router.push('/coach-view') }}
            activeOpacity={0.8}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: NEON.green + '22', borderWidth: 1, borderColor: NEON.green, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="eye-outline" size={18} color={NEON.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: TEXT.primary, fontSize: 14, fontWeight: '700' }}>コーチビューを開く</Text>
              <Text style={{ color: TEXT.hint, fontSize: 12, marginTop: 2 }}>選手データをコーチ視点で確認</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={TEXT.hint} />
          </TouchableOpacity>
          </AnimatedSection>

          {/* ── コーチメモ ── */}
          <AnimatedSection delay={160} type="fade-up">
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Ionicons name="chatbox" size={16} color={NEON.amber} />
                <Text style={styles.cardTitle}>コーチメモ</Text>
                <Text style={styles.countBadge}>{team.coach_notes.length}</Text>
              </View>
              <TouchableOpacity style={styles.smallAddBtn} onPress={() => setShowNoteModal(true)}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.smallAddText}>追加</Text>
              </TouchableOpacity>
            </View>

            {loading ? <Skeleton h={60} /> : sortedNotes.length === 0 ? (
              <TouchableOpacity style={styles.emptyNote} onPress={() => setShowNoteModal(true)}>
                <Ionicons name="chatbox-outline" size={24} color={TEXT.hint} />
                <Text style={styles.emptyText}>コーチからのメモを追加</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ gap: 8 }}>
                {sortedNotes.map(n => (
                  <NoteCard key={n.id} note={n} onDelete={() => deleteNote(n.id)} onTogglePin={() => togglePin(n.id)} />
                ))}
              </View>
            )}
          </View>
          </AnimatedSection>

          {/* ── メンバー一覧 ── */}
          {['athlete', 'coach', 'manager'].map((role, roleIdx) => {
            const group = team.members.filter(m => m.role === role)
            if (group.length === 0) return null
            const info = ROLES.find(r => r.value === role)!
            return (
              <AnimatedSection key={role} delay={240 + roleIdx * 80} type="fade-up">
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: info.color }} />
                    <Text style={styles.cardTitle}>{info.label}</Text>
                    <Text style={styles.countBadge}>{group.length}名</Text>
                  </View>
                </View>
                <View style={{ gap: 8 }}>
                  {group.map(m => (
                    <MemberCard key={m.id} member={m} onDelete={() => handleDeleteMember(m.id)} />
                  ))}
                </View>
              </View>
              </AnimatedSection>
            )
          })}

          {/* メンバーゼロ時 */}
          {!loading && team.members.length === 0 && (
            <View style={styles.card}>
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={44} color={TEXT.hint} />
                <Text style={styles.emptyTitle}>メンバーを追加しよう</Text>
                <Text style={styles.emptyText}>選手・コーチ・マネージャーを登録することで、チーム全体の状況を管理できます</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowMemberModal(true)}>
                  <Text style={styles.emptyBtnText}>メンバーを追加</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── チームタイムライン ── */}
          <AnimatedSection delay={400} type="fade-up">
            <TimelineSection />
          </AnimatedSection>

        </ScrollView>
      </SafeAreaView>

      {/* ══════════════════ モーダル群 ══════════════════ */}

      {/* ── 自分のプロフィール編集 ── */}
      <ProfileEditModal
        visible={showProfileModal}
        profile={profile}
        onSave={async p => { Sounds.save(); await saveProfile(p); setShowProfileModal(false); Toast.show({ type: 'success', text1: 'プロフィールを保存しました' }) }}
        onClose={() => setShowProfileModal(false)}
      />

      {/* ── チーム情報編集 ── */}
      <TeamEditModal
        visible={showTeamModal}
        team={team}
        onSave={async t => { Sounds.save(); await saveTeam(t); setShowTeamModal(false); Toast.show({ type: 'success', text1: 'チーム情報を保存しました' }) }}
        onClose={() => setShowTeamModal(false)}
      />

      {/* ── メンバー追加 ── */}
      <Modal visible={showMemberModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowMemberModal(false)}><Text style={styles.cancelText}>キャンセル</Text></TouchableOpacity>
                <Text style={styles.modalTitle}>メンバーを追加</Text>
                <TouchableOpacity onPress={handleAddMember}><Text style={styles.saveText}>追加</Text></TouchableOpacity>
              </View>

              <Text style={styles.label}>名前</Text>
              <TextInput style={styles.input} value={mName} onChangeText={setMName} placeholder="例: 山田 太郎" placeholderTextColor="#445577" />

              <Text style={styles.label}>ロール</Text>
              <View style={styles.roleRow}>
                {ROLES.map(r => (
                  <TouchableOpacity key={r.value} style={[styles.roleBtn, mRole === r.value && { backgroundColor: r.color + '22', borderColor: r.color }]} onPress={() => setMRole(r.value)}>
                    <Text style={[styles.roleBtnText, mRole === r.value && { color: r.color }]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>種目</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={styles.chipRow}>
                  {ALL_EVENTS.map(e => (
                    <TouchableOpacity key={e} style={[styles.chip, mEvent === e && styles.chipActive]} onPress={() => setMEvent(e)}>
                      <Text style={[styles.chipText, mEvent === e && styles.chipTextActive]}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>学年</Text>
              <View style={styles.chipRow2}>
                {GRADES.map(g => (
                  <TouchableOpacity key={g} style={[styles.chip, mGrade === g && styles.chipActive]} onPress={() => setMGrade(g)}>
                    <Text style={[styles.chipText, mGrade === g && styles.chipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { marginTop: 14 }]}>PB（任意）</Text>
              <TextInput style={styles.input} value={mPB} onChangeText={setMPB} placeholder="例: 10.85 / 7m32" placeholderTextColor="#445577" />

              <Text style={styles.label}>メモ（任意）</Text>
              <TextInput style={[styles.input, { height: 60 }]} value={mNotes} onChangeText={setMNotes} multiline placeholder="怪我の状況・特記事項など..." placeholderTextColor="#445577" />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── コーチメモ追加 ── */}
      <Modal visible={showNoteModal} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowNoteModal(false)}><Text style={styles.cancelText}>キャンセル</Text></TouchableOpacity>
                <Text style={styles.modalTitle}>メモを追加</Text>
                <TouchableOpacity onPress={handleAddNote}><Text style={styles.saveText}>追加</Text></TouchableOpacity>
              </View>
              <Text style={styles.label}>内容</Text>
              <TextInput
                style={[styles.input, { height: 140, textAlignVertical: 'top' }]}
                value={nContent} onChangeText={setNContent} multiline
                placeholder="例: 今週は走量を落として調整。水曜の閾値走は80%で。"
                placeholderTextColor="#445577" autoFocus
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  )
}

// ── プロフィール編集モーダル ──────────────────────────────────────
function ProfileEditModal({ visible, profile, onSave, onClose }: {
  visible: boolean; profile: MyProfile;
  onSave: (p: MyProfile) => void; onClose: () => void
}) {
  const [name, setName]   = useState(profile.name)
  const [event, setEvent] = useState(profile.primary_event)
  const [grade, setGrade] = useState(profile.grade ?? '1年')
  const [coach, setCoach] = useState(profile.coach_name ?? '')

  useEffect(() => {
    setName(profile.name); setEvent(profile.primary_event)
    setGrade(profile.grade ?? '1年'); setCoach(profile.coach_name ?? '')
  }, [visible])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={onClose}><Text style={styles.cancelText}>キャンセル</Text></TouchableOpacity>
              <Text style={styles.modalTitle}>プロフィール編集</Text>
              <TouchableOpacity onPress={() => onSave({ name, primary_event: event, secondary_events: [], grade, coach_name: coach || undefined })}>
                <Text style={styles.saveText}>保存</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>名前</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="例: 田中 太郎" placeholderTextColor="#445577" />
            <Text style={styles.label}>主種目</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={styles.chipRow}>
                {ALL_EVENTS.map(e => (
                  <TouchableOpacity key={e} style={[styles.chip, event === e && styles.chipActive]} onPress={() => setEvent(e)}>
                    <Text style={[styles.chipText, event === e && styles.chipTextActive]}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.label}>学年</Text>
            <View style={[styles.chipRow2, { marginBottom: 14 }]}>
              {GRADES.map(g => (
                <TouchableOpacity key={g} style={[styles.chip, grade === g && styles.chipActive]} onPress={() => setGrade(g)}>
                  <Text style={[styles.chipText, grade === g && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>コーチ名（任意）</Text>
            <TextInput style={styles.input} value={coach} onChangeText={setCoach} placeholder="例: 鈴木 一郎" placeholderTextColor="#445577" />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

// ── チーム情報編集モーダル ────────────────────────────────────────
function TeamEditModal({ visible, team, onSave, onClose }: {
  visible: boolean; team: TeamProfile;
  onSave: (t: TeamProfile) => void; onClose: () => void
}) {
  const [tName,  setTName]  = useState(team.team_name)
  const [school, setSchool] = useState(team.school_or_club ?? '')
  const [coach,  setCoach]  = useState(team.coach_name ?? '')
  const [spec,   setSpec]   = useState(team.coach_specialty ?? '全般')

  useEffect(() => {
    setTName(team.team_name); setSchool(team.school_or_club ?? '')
    setCoach(team.coach_name ?? ''); setSpec(team.coach_specialty ?? '全般')
  }, [visible])

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={onClose}><Text style={styles.cancelText}>キャンセル</Text></TouchableOpacity>
              <Text style={styles.modalTitle}>チーム情報編集</Text>
              <TouchableOpacity onPress={() => onSave({ ...team, team_name: tName, school_or_club: school || undefined, coach_name: coach || undefined, coach_specialty: spec })}>
                <Text style={styles.saveText}>保存</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>チーム名</Text>
            <TextInput style={styles.input} value={tName} onChangeText={setTName} placeholder="例: ○○大学陸上競技部" placeholderTextColor="#445577" />
            <Text style={styles.label}>学校・クラブ名（任意）</Text>
            <TextInput style={styles.input} value={school} onChangeText={setSchool} placeholder="例: ○○高等学校" placeholderTextColor="#445577" />
            <Text style={styles.label}>コーチ名（任意）</Text>
            <TextInput style={styles.input} value={coach} onChangeText={setCoach} placeholder="例: 佐藤 健一" placeholderTextColor="#445577" />
            <Text style={styles.label}>専門</Text>
            <View style={[styles.chipRow2, { marginBottom: 14 }]}>
              {SPECIALTIES.map(s => (
                <TouchableOpacity key={s} style={[styles.chip, spec === s && styles.chipActive]} onPress={() => setSpec(s)}>
                  <Text style={[styles.chipText, spec === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
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
  card:    { backgroundColor: '#111111', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, gap: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cardLabel:  { color: TEXT.hint, fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 4 },
  cardTitle:  { color: TEXT.primary, fontSize: 15, fontWeight: '700', flex: 1 },
  countBadge: { color: TEXT.hint, fontSize: 12 },

  // 自分のプロフィール
  myName:    { color: TEXT.primary, fontSize: 18, fontWeight: '800' },
  eventTag:  { backgroundColor: `${BRAND}22`, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  eventTagText: { color: BRAND, fontSize: 11, fontWeight: '700' },
  gradeText: { color: TEXT.secondary, fontSize: 12 },
  coachRef:  { color: TEXT.hint, fontSize: 11, marginTop: 2 },
  editBtn:   { padding: 4 },

  // チーム情報
  teamName:  { color: TEXT.primary, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  schoolText:{ color: TEXT.secondary, fontSize: 13, marginBottom: 6 },
  coachRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  coachName: { color: TEXT.primary, fontSize: 13, fontWeight: '600' },
  coachSpec: { color: TEXT.hint, fontSize: 11 },
  statsRow:  { flexDirection: 'row', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(74,159,255,0.15)', paddingTop: 10 },
  statItem:  { flex: 1, alignItems: 'center' },
  statCount: { fontSize: 20, fontWeight: '800' },
  statLabel: { color: TEXT.hint, fontSize: 11, marginTop: 2 },

  // コーチメモ
  smallAddBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BRAND, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  smallAddText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  noteCard:     { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(74,159,255,0.12)', padding: 12 },
  noteCardPinned: { borderColor: `${NEON.amber}55`, backgroundColor: 'rgba(255,149,0,0.06)' },
  noteHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  noteDate:     { color: TEXT.hint, fontSize: 11 },
  noteContent:  { color: TEXT.secondary, fontSize: 14, lineHeight: 21 },
  emptyNote:    { alignItems: 'center', gap: 6, paddingVertical: 20 },

  // メンバーカード
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(74,159,255,0.1)', padding: 10, gap: 10 },
  memberInfo: { flex: 1 },
  memberName: { color: TEXT.primary, fontSize: 14, fontWeight: '700' },
  memberGrade:{ color: TEXT.hint, fontSize: 11 },
  memberEvent:{ color: TEXT.secondary, fontSize: 12 },
  memberPB:   { color: NEON.green, fontSize: 12, fontWeight: '700' },
  memberNotes:{ color: TEXT.hint, fontSize: 11, marginTop: 3 },

  // 空状態
  empty:        { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyTitle:   { color: TEXT.primary, fontSize: 16, fontWeight: '700' },
  emptyText:    { color: TEXT.hint, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  emptyBtn:     { backgroundColor: BRAND, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 6 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // モーダル共通
  modalSafe:    { flex: 1, backgroundColor: '#000000' },
  modalContent: { padding: 20, paddingBottom: 48, gap: 4 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle:   { color: TEXT.primary, fontSize: 17, fontWeight: '700' },
  cancelText:   { color: TEXT.secondary, fontSize: 16 },
  saveText:     { color: BRAND, fontSize: 16, fontWeight: '700' },
  label:        { color: TEXT.secondary, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input:        { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#FFFFFF', fontSize: 15, borderWidth: 1, borderColor: 'rgba(74,159,255,0.3)', marginBottom: 14 },
  chipRow:      { flexDirection: 'row', gap: 8 },
  chipRow2:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)' },
  chipActive:   { backgroundColor: BRAND, borderColor: BRAND },
  chipText:     { color: TEXT.secondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  roleRow:      { flexDirection: 'row', gap: 8, marginBottom: 14 },
  roleBtn:      { flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  roleBtnText:  { color: TEXT.secondary, fontSize: 13, fontWeight: '600' },
})
