// app/(tabs)/team.tsx — チーム機能 v2（コード参加 + メッセージ）
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Clipboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Toast from 'react-native-toast-message'
import { BRAND, TEXT } from '../../lib/theme'
import { calcInjuryRisk } from '../../lib/injuryRisk'
import type { TrainingSession } from '../../types'

// ── ストレージキー ──────────────────────────────────────────
const ROLE_KEY     = 'trackmate_team_role'
const SESSIONS_KEY = 'trackmate_sessions'
const SETUP_KEY    = 'trackmate_team_setup'   // コーチが作ったチーム情報
const JOINED_KEY   = 'trackmate_team_joined'  // 選手が参加したチーム情報
const MESSAGES_KEY = 'trackmate_team_messages'

type Role = 'coach' | 'player'

// ── 型定義 ──────────────────────────────────────────────────
interface TeamSetup {
  teamName: string
  coachName: string
  code: string        // 6文字の参加コード
  createdAt: string
}

interface JoinedTeam {
  code: string
  teamName: string
  coachName: string
  joinedAt: string
}

interface TeamMessage {
  id: string
  content: string
  authorName: string
  timestamp: string
  isPinned: boolean
}

// ── 疲労マップ ───────────────────────────────────────────────
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

// ── コード生成 ───────────────────────────────────────────────
function generateCode(): string {
  return Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6).padEnd(6, '0')
}

function formatCode(raw: string): string {
  // XXX-XXX 形式で表示
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
  return c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c
}

function daysSince(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (diff === 0) return '今日'
  if (diff === 1) return '昨日'
  return `${diff}日前`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (diffMin < 1)  return 'たった今'
  if (diffMin < 60) return `${diffMin}分前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `${diffH}時間前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ── デモメンバー ─────────────────────────────────────────────
type Member = { id: string; name: string; event: string; sessions: TrainingSession[]; lastActive: string; note?: string }
const DEMO_MEMBERS: Member[] = [
  {
    id: 'demo-tanaka', name: '田中 翼', event: '100m / 200m',
    lastActive: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    note: '先週から膝に違和感あり',
    sessions: [
      { id:'s1', user_id:'demo-tanaka', session_date: new Date(Date.now()-86400000).toISOString().slice(0,10), session_type:'interval', fatigue_level:8, condition_level:5, distance_m:3000, created_at:new Date().toISOString() },
      { id:'s2', user_id:'demo-tanaka', session_date: new Date(Date.now()-172800000).toISOString().slice(0,10), session_type:'interval', fatigue_level:8, condition_level:5, distance_m:4000, created_at:new Date().toISOString() },
    ],
  },
  {
    id: 'demo-suzuki', name: '鈴木 愛', event: '5000m / 10000m',
    lastActive: new Date().toISOString().slice(0, 10),
    sessions: [
      { id:'s3', user_id:'demo-suzuki', session_date: new Date().toISOString().slice(0,10), session_type:'easy', fatigue_level:4, condition_level:8, distance_m:10000, created_at:new Date().toISOString() },
      { id:'s4', user_id:'demo-suzuki', session_date: new Date(Date.now()-86400000).toISOString().slice(0,10), session_type:'long', fatigue_level:6, condition_level:7, distance_m:15000, created_at:new Date().toISOString() },
    ],
  },
  {
    id: 'demo-sato', name: '佐藤 ひな', event: '400m / 400mH',
    lastActive: new Date(Date.now()-259200000).toISOString().slice(0, 10),
    note: '試験期間のため練習少なめ',
    sessions: [
      { id:'s5', user_id:'demo-sato', session_date: new Date(Date.now()-259200000).toISOString().slice(0,10), session_type:'interval', fatigue_level:10, condition_level:4, distance_m:3200, created_at:new Date().toISOString() },
      { id:'s6', user_id:'demo-sato', session_date: new Date(Date.now()-345600000).toISOString().slice(0,10), session_type:'interval', fatigue_level:9, condition_level:4, distance_m:2800, created_at:new Date().toISOString() },
    ],
  },
  {
    id: 'demo-ito', name: '伊藤 拓海', event: '1500m / 3000mSC',
    lastActive: new Date().toISOString().slice(0, 10),
    sessions: [
      { id:'s7', user_id:'demo-ito', session_date: new Date().toISOString().slice(0,10), session_type:'easy', fatigue_level:2, condition_level:9, distance_m:8000, created_at:new Date().toISOString() },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// 共通コンポーネント
// ─────────────────────────────────────────────────────────────
function Avatar({ name, size = 44, color = BRAND }: { name: string; size?: number; color?: string }) {
  return (
    <View style={{ width:size, height:size, borderRadius:size/2, backgroundColor:color+'22', borderWidth:1.5, borderColor:color+'44', alignItems:'center', justifyContent:'center' }}>
      <Text style={{ color, fontSize:size*0.38, fontWeight:'800' }}>{name.charAt(0)}</Text>
    </View>
  )
}

function RiskBadge({ score }: { score: number }) {
  const level  = score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low'
  const color  = level === 'high' ? '#FF3B30' : level === 'moderate' ? '#FF9500' : '#34C759'
  const label  = level === 'high' ? '要注意' : level === 'moderate' ? '注意' : '良好'
  return (
    <View style={{ flexDirection:'row', alignItems:'center', gap:4, backgroundColor:color+'18', borderRadius:8, paddingHorizontal:8, paddingVertical:4, borderWidth:1, borderColor:color+'40' }}>
      <View style={{ width:5, height:5, borderRadius:3, backgroundColor:color }} />
      <Text style={{ color, fontSize:11, fontWeight:'700' }}>{label}</Text>
    </View>
  )
}

// ─────────────────────────────────────────────────────────────
// MessageCard
// ─────────────────────────────────────────────────────────────
function MessageCard({ msg, onPin, onDelete, isCoach }: {
  msg: TeamMessage
  onPin?: () => void
  onDelete?: () => void
  isCoach: boolean
}) {
  return (
    <View style={[msgSt.card, msg.isPinned && msgSt.pinned]}>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:6 }}>
        {msg.isPinned && <Ionicons name="pin" size={12} color="#FF9500" />}
        <Text style={msgSt.author}>{msg.authorName}</Text>
        <Text style={msgSt.time}>{formatTime(msg.timestamp)}</Text>
        {isCoach && (
          <View style={{ flexDirection:'row', gap:10, marginLeft:'auto' as any }}>
            <TouchableOpacity onPress={onPin} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Ionicons name={msg.isPinned ? 'pin' : 'pin-outline'} size={14} color={msg.isPinned ? '#FF9500' : '#555'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Ionicons name="trash-outline" size={14} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
      </View>
      <Text style={msgSt.content}>{msg.content}</Text>
    </View>
  )
}

const msgSt = StyleSheet.create({
  card:    { backgroundColor:'rgba(255,255,255,0.05)', borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.08)', padding:14 },
  pinned:  { borderColor:'rgba(255,149,0,0.4)', backgroundColor:'rgba(255,149,0,0.06)' },
  author:  { color:BRAND, fontSize:12, fontWeight:'800' },
  time:    { color:'#555', fontSize:11 },
  content: { color:'#ddd', fontSize:14, lineHeight:22 },
})

// ─────────────────────────────────────────────────────────────
// MessageComposer（コーチ用）
// ─────────────────────────────────────────────────────────────
function MessageComposer({ coachName, onSent }: { coachName: string; onSent: () => void }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function send() {
    const trimmed = text.trim()
    if (!trimmed) return
    setSending(true)
    try {
      const raw = await AsyncStorage.getItem(MESSAGES_KEY)
      const msgs: TeamMessage[] = raw ? JSON.parse(raw) : []
      const newMsg: TeamMessage = {
        id: `msg_${Date.now()}`,
        content: trimmed,
        authorName: coachName || 'コーチ',
        timestamp: new Date().toISOString(),
        isPinned: false,
      }
      msgs.unshift(newMsg)
      await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs))
      setText('')
      onSent()
      Toast.show({ type:'success', text1:'メッセージを送信しました', visibilityTime:1600 })
    } finally {
      setSending(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={comp.wrap}>
        <TextInput
          style={comp.input}
          value={text}
          onChangeText={setText}
          placeholder="チームへのメッセージを入力..."
          placeholderTextColor="#444"
          multiline
          maxLength={300}
        />
        <TouchableOpacity
          style={[comp.btn, (!text.trim() || sending) && { opacity:0.4 }]}
          onPress={send}
          disabled={!text.trim() || sending}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const comp = StyleSheet.create({
  wrap:  { flexDirection:'row', gap:10, alignItems:'flex-end' },
  input: { flex:1, backgroundColor:'rgba(255,255,255,0.07)', borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.12)', color:'#fff', fontSize:14, paddingHorizontal:14, paddingVertical:10, minHeight:44, maxHeight:100 },
  btn:   { width:44, height:44, borderRadius:12, backgroundColor:BRAND, alignItems:'center', justifyContent:'center' },
})

// ─────────────────────────────────────────────────────────────
// RoleSelectionScreen
// ─────────────────────────────────────────────────────────────
function RoleSelectionScreen({ onSelect }: { onSelect: (role: Role) => void }) {
  return (
    <View style={{ flex:1, backgroundColor:'#000' }}>
      <SafeAreaView style={{ flex:1 }}>
        <ScrollView contentContainerStyle={rs.container} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems:'center', marginBottom:8 }}>
            <Ionicons name="people" size={52} color={BRAND} />
          </View>
          <Text style={rs.title}>チーム機能</Text>
          <Text style={rs.sub}>あなたの役割を選択してください{'\n'}あとから変更することもできます</Text>

          <TouchableOpacity style={rs.roleCard} activeOpacity={0.85} onPress={() => onSelect('coach')}>
            <View style={[rs.roleIcon, { backgroundColor:'rgba(255,59,48,0.15)' }]}>
              <Ionicons name="clipboard" size={30} color={BRAND} />
            </View>
            <View style={{ flex:1, gap:3 }}>
              <Text style={rs.roleTitle}>コーチ・監督</Text>
              <Text style={rs.roleDesc}>チームを作成して選手を招待。全員の疲労・怪我リスクを管理できます</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#444" />
          </TouchableOpacity>

          <TouchableOpacity style={rs.roleCard} activeOpacity={0.85} onPress={() => onSelect('player')}>
            <View style={[rs.roleIcon, { backgroundColor:'rgba(52,199,89,0.12)' }]}>
              <Ionicons name="person-circle" size={30} color="#34C759" />
            </View>
            <View style={{ flex:1, gap:3 }}>
              <Text style={rs.roleTitle}>選手・アスリート</Text>
              <Text style={rs.roleDesc}>コードを入力してチームに参加。コーチからのメッセージを受け取れます</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#444" />
          </TouchableOpacity>

          <Text style={rs.note}>※ この設定はあとから変更できます</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}
const rs = StyleSheet.create({
  container:{ padding:24, paddingTop:48, gap:16 },
  title:    { color:'#fff', fontSize:26, fontWeight:'800', textAlign:'center' },
  sub:      { color:TEXT.secondary, fontSize:14, lineHeight:22, textAlign:'center', marginBottom:4 },
  roleCard: { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:16, borderWidth:1, borderColor:'rgba(255,255,255,0.1)', padding:18 },
  roleIcon: { width:54, height:54, borderRadius:14, alignItems:'center', justifyContent:'center' },
  roleTitle:{ color:'#fff', fontSize:17, fontWeight:'800' },
  roleDesc: { color:TEXT.secondary, fontSize:12, lineHeight:17 },
  note:     { color:'#444', fontSize:11, textAlign:'center' },
})

// ─────────────────────────────────────────────────────────────
// CoachSetupScreen（チーム作成）
// ─────────────────────────────────────────────────────────────
function CoachSetupScreen({ onCreated, onBack }: { onCreated: (setup: TeamSetup) => void; onBack: () => void }) {
  const [teamName,  setTeamName]  = useState('')
  const [coachName, setCoachName] = useState('')
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!teamName.trim() || !coachName.trim()) {
      Toast.show({ type:'error', text1:'チーム名とコーチ名を入力してください' })
      return
    }
    setSaving(true)
    const setup: TeamSetup = {
      teamName: teamName.trim(),
      coachName: coachName.trim(),
      code: generateCode(),
      createdAt: new Date().toISOString(),
    }
    await AsyncStorage.setItem(SETUP_KEY, JSON.stringify(setup))
    onCreated(setup)
  }

  return (
    <View style={{ flex:1, backgroundColor:'#000' }}>
      <SafeAreaView style={{ flex:1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex:1 }}>
          <ScrollView contentContainerStyle={{ padding:24, gap:20 }} showsVerticalScrollIndicator={false}>
            {/* 戻るボタン */}
            <TouchableOpacity onPress={onBack} style={{ flexDirection:'row', alignItems:'center', gap:6, alignSelf:'flex-start' }} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={TEXT.secondary} />
              <Text style={{ color:TEXT.secondary, fontSize:14 }}>戻る</Text>
            </TouchableOpacity>

            <View style={{ alignItems:'center', gap:8, marginBottom:8 }}>
              <View style={{ width:64, height:64, borderRadius:18, backgroundColor:BRAND+'20', alignItems:'center', justifyContent:'center' }}>
                <Ionicons name="shield-checkmark" size={32} color={BRAND} />
              </View>
              <Text style={{ color:'#fff', fontSize:22, fontWeight:'800' }}>チームを作成</Text>
              <Text style={{ color:TEXT.secondary, fontSize:13, textAlign:'center', lineHeight:20 }}>
                作成後に参加コードが発行されます{'\n'}選手に共有してチームを招集しましょう
              </Text>
            </View>

            <View style={{ gap:6 }}>
              <Text style={setup_s.label}>チーム名</Text>
              <TextInput
                style={setup_s.input}
                value={teamName}
                onChangeText={setTeamName}
                placeholder="例: ○○高校陸上部、△△AC..."
                placeholderTextColor="#444"
                maxLength={30}
              />
            </View>

            <View style={{ gap:6 }}>
              <Text style={setup_s.label}>コーチ名・監督名</Text>
              <TextInput
                style={setup_s.input}
                value={coachName}
                onChangeText={setCoachName}
                placeholder="例: 山本 太郎"
                placeholderTextColor="#444"
                maxLength={20}
              />
            </View>

            <TouchableOpacity
              style={[setup_s.btn, saving && { opacity:0.5 }]}
              onPress={create}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={{ color:'#fff', fontSize:16, fontWeight:'800' }}>チームを作成する</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}
const setup_s = StyleSheet.create({
  label:{ color:TEXT.hint, fontSize:11, fontWeight:'700', letterSpacing:0.8 },
  input:{ backgroundColor:'rgba(255,255,255,0.07)', borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.12)', color:'#fff', fontSize:15, paddingHorizontal:14, paddingVertical:12 },
  btn:  { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:BRAND, borderRadius:14, paddingVertical:15, marginTop:8 },
})

// ─────────────────────────────────────────────────────────────
// PlayerJoinScreen（コード入力）
// ─────────────────────────────────────────────────────────────
function PlayerJoinScreen({ onJoined, onBack }: { onJoined: (joined: JoinedTeam) => void; onBack: () => void }) {
  const [code,    setCode]    = useState('')
  const [joining, setJoining] = useState(false)

  async function join() {
    const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleaned.length < 6) {
      Toast.show({ type:'error', text1:'6文字のコードを入力してください' })
      return
    }
    setJoining(true)
    try {
      // 実運用ではサーバーでコードを照合する
      // ここではコーチ側のローカルデータを参照（同一デバイスのデモ）
      const raw = await AsyncStorage.getItem(SETUP_KEY)
      let teamName = 'チーム', coachName = 'コーチ'
      if (raw) {
        const setup: TeamSetup = JSON.parse(raw)
        if (setup.code === cleaned) {
          teamName  = setup.teamName
          coachName = setup.coachName
        } else {
          // デモ用：コードが一致しなくてもデモとして参加可能
          teamName  = 'デモチーム'
          coachName = 'デモコーチ'
        }
      }
      const joined: JoinedTeam = {
        code: cleaned,
        teamName,
        coachName,
        joinedAt: new Date().toISOString(),
      }
      await AsyncStorage.setItem(JOINED_KEY, JSON.stringify(joined))
      Toast.show({ type:'success', text1:`${teamName} に参加しました！`, visibilityTime:2000 })
      onJoined(joined)
    } finally {
      setJoining(false)
    }
  }

  const displayCode = formatCode(code)

  return (
    <View style={{ flex:1, backgroundColor:'#000' }}>
      <SafeAreaView style={{ flex:1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex:1 }}>
          <ScrollView contentContainerStyle={{ padding:24, gap:20 }} showsVerticalScrollIndicator={false}>
            {/* 戻るボタン */}
            <TouchableOpacity onPress={onBack} style={{ flexDirection:'row', alignItems:'center', gap:6, alignSelf:'flex-start' }} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={TEXT.secondary} />
              <Text style={{ color:TEXT.secondary, fontSize:14 }}>戻る</Text>
            </TouchableOpacity>

            <View style={{ alignItems:'center', gap:8, marginBottom:8 }}>
              <View style={{ width:64, height:64, borderRadius:18, backgroundColor:'#34C759'+'20', alignItems:'center', justifyContent:'center' }}>
                <Ionicons name="enter-outline" size={32} color="#34C759" />
              </View>
              <Text style={{ color:'#fff', fontSize:22, fontWeight:'800' }}>チームに参加</Text>
              <Text style={{ color:TEXT.secondary, fontSize:13, textAlign:'center', lineHeight:20 }}>
                コーチから受け取った{'\n'}6文字の参加コードを入力してください
              </Text>
            </View>

            {/* コード入力 */}
            <View style={{ gap:10 }}>
              <TextInput
                style={join_s.codeInput}
                value={displayCode}
                onChangeText={v => setCode(v.replace(/[^A-Za-z0-9]/g, '').slice(0,6))}
                placeholder="ABC-123"
                placeholderTextColor="#333"
                autoCapitalize="characters"
                maxLength={7}
                autoFocus
              />
              <Text style={{ color:'#444', fontSize:11, textAlign:'center' }}>
                コードはコーチのチームダッシュボードに表示されています
              </Text>
            </View>

            <TouchableOpacity
              style={[join_s.btn, (code.replace(/[^A-Za-z0-9]/g,'').length < 6 || joining) && { opacity:0.4 }]}
              onPress={join}
              disabled={code.replace(/[^A-Za-z0-9]/g,'').length < 6 || joining}
              activeOpacity={0.85}
            >
              <Ionicons name="enter-outline" size={20} color="#fff" />
              <Text style={{ color:'#fff', fontSize:16, fontWeight:'800' }}>{joining ? '参加中...' : 'チームに参加する'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}
const join_s = StyleSheet.create({
  codeInput:{ backgroundColor:'rgba(255,255,255,0.06)', borderRadius:16, borderWidth:2, borderColor:'rgba(255,255,255,0.15)', color:'#fff', fontSize:32, fontWeight:'900', textAlign:'center', letterSpacing:8, paddingVertical:20 },
  btn:      { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'#34C759', borderRadius:14, paddingVertical:15 },
})

// ─────────────────────────────────────────────────────────────
// CoachDashboard
// ─────────────────────────────────────────────────────────────
function CoachDashboard({ setup, onReset }: { setup: TeamSetup; onReset: () => void }) {
  const [messages,       setMessages]       = useState<TeamMessage[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)

  const loadMessages = useCallback(async () => {
    const raw = await AsyncStorage.getItem(MESSAGES_KEY)
    setMessages(raw ? JSON.parse(raw) : [])
  }, [])

  useEffect(() => { loadMessages() }, [loadMessages])

  async function pinToggle(id: string) {
    const updated = messages.map(m => m.id === id ? { ...m, isPinned: !m.isPinned } : m)
    setMessages(updated)
    await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(updated))
  }

  async function deleteMsg(id: string) {
    const updated = messages.filter(m => m.id !== id)
    setMessages(updated)
    await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(updated))
  }

  function copyCode() {
    Clipboard.setString(setup.code)
    Toast.show({ type:'success', text1:`コード ${formatCode(setup.code)} をコピーしました`, visibilityTime:1600 })
  }

  const highRiskCount   = DEMO_MEMBERS.filter(m => calcInjuryRisk(m.sessions, [], m.sessions[0]?.condition_level ?? 6, !!m.note).riskScore >= 50).length
  const activeToday     = DEMO_MEMBERS.filter(m => m.lastActive === new Date().toISOString().slice(0,10)).length
  const pinnedMessages  = messages.filter(m => m.isPinned)
  const regularMessages = messages.filter(m => !m.isPinned)

  return (
    <View style={{ flex:1, backgroundColor:'#000' }}>
      <SafeAreaView style={{ flex:1 }}>
        <ScrollView contentContainerStyle={cd.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ヘッダー */}
          <View style={cd.header}>
            <View style={{ gap:2 }}>
              <Text style={cd.title}>{setup.teamName}</Text>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <View style={{ backgroundColor:BRAND+'20', borderRadius:6, paddingHorizontal:8, paddingVertical:2 }}>
                  <Text style={{ color:BRAND, fontSize:11, fontWeight:'700' }}>コーチ・監督</Text>
                </View>
                <Text style={{ color:'#555', fontSize:11 }}>{setup.coachName}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onReset} style={cd.roleBtn} activeOpacity={0.7}>
              <Ionicons name="swap-horizontal-outline" size={15} color={TEXT.secondary} />
              <Text style={{ color:TEXT.secondary, fontSize:11 }}>切替</Text>
            </TouchableOpacity>
          </View>

          {/* 参加コード */}
          <TouchableOpacity style={cd.codeCard} onPress={copyCode} activeOpacity={0.85}>
            <View style={{ flex:1, gap:4 }}>
              <Text style={{ color:TEXT.hint, fontSize:10, fontWeight:'700', letterSpacing:1 }}>チーム参加コード</Text>
              <Text style={cd.codeText}>{formatCode(setup.code)}</Text>
              <Text style={{ color:'#555', fontSize:11 }}>選手にこのコードを共有してください</Text>
            </View>
            <View style={{ alignItems:'center', gap:6 }}>
              <Ionicons name="copy-outline" size={22} color={BRAND} />
              <Text style={{ color:BRAND, fontSize:10, fontWeight:'700' }}>コピー</Text>
            </View>
          </TouchableOpacity>

          {/* 概要 */}
          <View style={cd.statsRow}>
            <View style={cd.statBox}>
              <Text style={cd.statNum}>{DEMO_MEMBERS.length}</Text>
              <Text style={cd.statLabel}>メンバー</Text>
            </View>
            <View style={[cd.statBox, highRiskCount > 0 && { borderColor:'#FF3B30'+'40' }]}>
              <Text style={[cd.statNum, highRiskCount > 0 && { color:'#FF3B30' }]}>{highRiskCount}</Text>
              <Text style={cd.statLabel}>要注意</Text>
            </View>
            <View style={cd.statBox}>
              <Text style={[cd.statNum, { color:'#34C759' }]}>{activeToday}</Text>
              <Text style={cd.statLabel}>今日活動</Text>
            </View>
          </View>

          {highRiskCount > 0 && (
            <View style={cd.alertBanner}>
              <Ionicons name="warning-outline" size={15} color="#FF3B30" />
              <Text style={{ color:'#FF3B30', fontSize:13, fontWeight:'700', flex:1 }}>
                {highRiskCount}人のメンバーに怪我リスクの上昇が見られます
              </Text>
            </View>
          )}

          {/* メッセージ送信 */}
          <View style={cd.section}>
            <Text style={cd.sectionTitle}>📣 チームへのメッセージ</Text>
            <MessageComposer coachName={setup.coachName} onSent={loadMessages} />
          </View>

          {/* ピン留め */}
          {pinnedMessages.length > 0 && (
            <View style={cd.section}>
              <Text style={[cd.sectionTitle, { color:'#FF9500' }]}>📌 ピン留め</Text>
              <View style={{ gap:8 }}>
                {pinnedMessages.map(msg => (
                  <MessageCard key={msg.id} msg={msg} isCoach onPin={() => pinToggle(msg.id)} onDelete={() => deleteMsg(msg.id)} />
                ))}
              </View>
            </View>
          )}

          {/* 通常メッセージ */}
          {regularMessages.length > 0 && (
            <View style={cd.section}>
              <Text style={cd.sectionTitle}>送信済みメッセージ</Text>
              <View style={{ gap:8 }}>
                {regularMessages.map(msg => (
                  <MessageCard key={msg.id} msg={msg} isCoach onPin={() => pinToggle(msg.id)} onDelete={() => deleteMsg(msg.id)} />
                ))}
              </View>
            </View>
          )}

          {/* メンバーリスト */}
          <View style={cd.section}>
            <Text style={cd.sectionTitle}>メンバー一覧</Text>
            <View style={{ gap:10 }}>
              {DEMO_MEMBERS.map(member => {
                const lastSession = member.sessions[0]
                const fatigue     = lastSession ? fatigueInfo(lastSession.fatigue_level) : fatigueInfo(6)
                const risk        = calcInjuryRisk(member.sessions, [], lastSession?.condition_level ?? 6, !!member.note)
                const colors      = ['#FF3B30','#FF9500','#34C759','#007AFF','#AF52DE']
                const avatarColor = colors[member.name.charCodeAt(0) % colors.length]
                return (
                  <TouchableOpacity key={member.id} style={mc.card} activeOpacity={0.85} onPress={() => setSelectedMember(member)}>
                    <Avatar name={member.name} size={44} color={avatarColor} />
                    <View style={{ flex:1, gap:5 }}>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                        <Text style={mc.name}>{member.name}</Text>
                        <Text style={mc.event}>{member.event}</Text>
                      </View>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                          <Text style={{ fontSize:15 }}>{fatigue.emoji}</Text>
                          <Text style={[mc.fatigueLabel, { color:fatigue.color }]}>{fatigue.label}</Text>
                        </View>
                        <Text style={{ color:'#333' }}>·</Text>
                        <RiskBadge score={risk.riskScore} />
                      </View>
                      {member.note && <Text style={mc.note} numberOfLines={1}>📌 {member.note}</Text>}
                    </View>
                    <View style={{ alignItems:'flex-end', gap:4 }}>
                      <Text style={mc.lastActive}>{daysSince(member.lastActive)}</Text>
                      <Ionicons name="chevron-forward" size={15} color="#333" />
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View style={{ flexDirection:'row', gap:6, alignItems:'flex-start' }}>
            <Ionicons name="lock-closed-outline" size={12} color="#333" />
            <Text style={{ color:'#333', fontSize:11, flex:1, lineHeight:16 }}>
              疲労度・怪我リスクは練習記録から自動計算されます。体重等のプライベートな情報は表示されません。
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* メンバー詳細 */}
      {selectedMember && (
        <MemberDetailSheet member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </View>
  )
}

const cd = StyleSheet.create({
  scroll:      { padding:16, paddingBottom:48, gap:14 },
  header:      { flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between' },
  title:       { color:'#fff', fontSize:22, fontWeight:'800' },
  roleBtn:     { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:10, paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  codeCard:    { flexDirection:'row', alignItems:'center', gap:16, backgroundColor:'rgba(255,51,51,0.08)', borderRadius:14, borderWidth:1.5, borderColor:BRAND+'40', padding:16 },
  codeText:    { color:'#fff', fontSize:28, fontWeight:'900', letterSpacing:6 },
  statsRow:    { flexDirection:'row', gap:10 },
  statBox:     { flex:1, alignItems:'center', backgroundColor:'rgba(255,255,255,0.05)', borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.08)', paddingVertical:14, gap:4 },
  statNum:     { color:'#fff', fontSize:22, fontWeight:'800' },
  statLabel:   { color:'#555', fontSize:11 },
  alertBanner: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#FF3B30'+'12', borderRadius:12, borderWidth:1, borderColor:'#FF3B30'+'30', padding:12 },
  section:     { gap:10 },
  sectionTitle:{ color:TEXT.hint, fontSize:11, fontWeight:'700', letterSpacing:1 },
})
const mc = StyleSheet.create({
  card:        { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'rgba(255,255,255,0.05)', borderRadius:14, borderWidth:1, borderColor:'rgba(255,255,255,0.08)', padding:14 },
  name:        { color:'#fff', fontSize:15, fontWeight:'800' },
  event:       { color:TEXT.hint, fontSize:11, fontWeight:'600' },
  fatigueLabel:{ fontSize:12, fontWeight:'700' },
  note:        { color:TEXT.hint, fontSize:11 },
  lastActive:  { color:'#555', fontSize:10 },
})

// ─────────────────────────────────────────────────────────────
// MemberDetailSheet
// ─────────────────────────────────────────────────────────────
function MemberDetailSheet({ member, onClose }: { member: Member; onClose: () => void }) {
  const risk    = calcInjuryRisk(member.sessions, [], member.sessions[0]?.condition_level ?? 6, !!member.note)
  const fatigue = member.sessions[0] ? fatigueInfo(member.sessions[0].fatigue_level) : fatigueInfo(6)
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor:'rgba(0,0,0,0.85)', justifyContent:'flex-end' }]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={mds.sheet}>
        <View style={{ width:36, height:4, borderRadius:2, backgroundColor:'rgba(255,255,255,0.2)', alignSelf:'center', marginBottom:16 }} />
        <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:20 }}>
          <Avatar name={member.name} size={50} />
          <View>
            <Text style={{ color:'#fff', fontSize:20, fontWeight:'800' }}>{member.name}</Text>
            <Text style={{ color:TEXT.hint, fontSize:13 }}>{member.event}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ marginLeft:'auto' as any }} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
            <Ionicons name="close" size={22} color={TEXT.secondary} />
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection:'row', gap:10, marginBottom:14 }}>
          <View style={mds.metricBox}>
            <Text style={{ fontSize:26 }}>{fatigue.emoji}</Text>
            <Text style={{ color:fatigue.color, fontSize:13, fontWeight:'700', marginTop:2 }}>{fatigue.label}</Text>
            <Text style={mds.metricLabel}>最新疲労度</Text>
          </View>
          <View style={mds.metricBox}>
            <Text style={{ color:risk.signalColor, fontSize:22, fontWeight:'800' }}>{risk.riskScore}</Text>
            <Text style={{ color:risk.signalColor, fontSize:11, fontWeight:'700', marginTop:2 }}>{risk.label}</Text>
            <Text style={mds.metricLabel}>怪我リスク</Text>
          </View>
          <View style={mds.metricBox}>
            <Text style={{ color:'#fff', fontSize:18, fontWeight:'800' }}>{risk.weeklyKm}<Text style={{ fontSize:11, color:'#666' }}>km</Text></Text>
            <Text style={{ color:'#666', fontSize:11, marginTop:2 }}>先週 {risk.prevWeeklyKm}km</Text>
            <Text style={mds.metricLabel}>今週の距離</Text>
          </View>
        </View>
        {risk.reasons.length > 0 ? (
          <View style={mds.reasonBox}>
            <Text style={{ color:'#fff', fontSize:13, fontWeight:'700', marginBottom:8 }}>⚠️ 注意ポイント</Text>
            {risk.reasons.map((r,i) => (
              <View key={i} style={{ flexDirection:'row', gap:6, marginBottom:4 }}>
                <Text style={{ color:'#FF9500', fontSize:12 }}>•</Text>
                <Text style={{ color:TEXT.secondary, fontSize:12, flex:1 }}>{r}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={[mds.reasonBox, { borderColor:'#34C759'+'30' }]}>
            <Text style={{ color:'#34C759', fontSize:13, fontWeight:'700' }}>✓ {risk.recommendation}</Text>
          </View>
        )}
        {member.note && (
          <View style={[mds.reasonBox, { marginTop:10, borderColor:'#9B6BFF'+'40' }]}>
            <Text style={{ color:'#9B6BFF', fontSize:12, fontWeight:'700', marginBottom:4 }}>📌 メモ</Text>
            <Text style={{ color:TEXT.secondary, fontSize:13 }}>{member.note}</Text>
          </View>
        )}
        <Text style={{ color:'#444', fontSize:11, textAlign:'center', marginTop:14 }}>最終練習: {daysSince(member.lastActive)}</Text>
      </View>
    </View>
  )
}
const mds = StyleSheet.create({
  sheet:     { backgroundColor:'#111', borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:44, borderTopWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  metricBox: { flex:1, alignItems:'center', gap:2, backgroundColor:'rgba(255,255,255,0.05)', borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.08)', paddingVertical:14 },
  metricLabel:{ color:'#555', fontSize:10, marginTop:2 },
  reasonBox: { backgroundColor:'rgba(255,149,0,0.08)', borderRadius:12, borderWidth:1, borderColor:'rgba(255,149,0,0.3)', padding:12 },
})

// ─────────────────────────────────────────────────────────────
// PlayerDashboard
// ─────────────────────────────────────────────────────────────
function PlayerDashboard({ joined, onReset }: { joined: JoinedTeam; onReset: () => void }) {
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [messages, setMessages] = useState<TeamMessage[]>([])

  const load = useCallback(async () => {
    const [sRaw, mRaw] = await Promise.all([
      AsyncStorage.getItem(SESSIONS_KEY),
      AsyncStorage.getItem(MESSAGES_KEY),
    ])
    setSessions(sRaw ? JSON.parse(sRaw) : [])
    setMessages(mRaw ? JSON.parse(mRaw) : [])
  }, [])

  useEffect(() => { load() }, [load])

  const lastSession = sessions[0]
  const fatigue     = lastSession ? fatigueInfo(lastSession.fatigue_level) : null
  const risk        = calcInjuryRisk(sessions, [], lastSession?.condition_level ?? 7)
  const thisWeek    = sessions.filter(s => Date.now() - new Date(s.session_date).getTime() <= 7 * 86400000)
  const pinnedMsgs  = messages.filter(m => m.isPinned)
  const allMsgs     = messages

  return (
    <View style={{ flex:1, backgroundColor:'#000' }}>
      <SafeAreaView style={{ flex:1 }}>
        <ScrollView contentContainerStyle={pd.scroll} showsVerticalScrollIndicator={false}>

          {/* ヘッダー */}
          <View style={{ flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between' }}>
            <View style={{ gap:2 }}>
              <Text style={{ color:'#fff', fontSize:22, fontWeight:'800' }}>{joined.teamName}</Text>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <View style={{ backgroundColor:'#34C759'+'20', borderRadius:6, paddingHorizontal:8, paddingVertical:2 }}>
                  <Text style={{ color:'#34C759', fontSize:11, fontWeight:'700' }}>選手</Text>
                </View>
                <Text style={{ color:'#555', fontSize:11 }}>コーチ: {joined.coachName}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onReset}
              style={{ flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:10, paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor:'rgba(255,255,255,0.1)' }}
              activeOpacity={0.7}
            >
              <Ionicons name="swap-horizontal-outline" size={15} color={TEXT.secondary} />
              <Text style={{ color:TEXT.secondary, fontSize:11 }}>切替</Text>
            </TouchableOpacity>
          </View>

          {/* ピン留めメッセージ（最優先表示） */}
          {pinnedMsgs.length > 0 && (
            <View style={{ gap:8 }}>
              <Text style={[pd.sectionTitle, { color:'#FF9500' }]}>📌 コーチからのお知らせ</Text>
              {pinnedMsgs.map(msg => (
                <MessageCard key={msg.id} msg={msg} isCoach={false} />
              ))}
            </View>
          )}

          {/* 通常メッセージ */}
          {allMsgs.length > 0 && (
            <View style={{ gap:8 }}>
              <Text style={pd.sectionTitle}>📣 コーチからのメッセージ</Text>
              {allMsgs.slice(0, 5).map(msg => (
                <MessageCard key={msg.id} msg={msg} isCoach={false} />
              ))}
              {allMsgs.length === 0 && (
                <View style={{ padding:20, alignItems:'center' }}>
                  <Text style={{ color:'#444', fontSize:13 }}>まだメッセージはありません</Text>
                </View>
              )}
            </View>
          )}

          {allMsgs.length === 0 && (
            <View style={{ backgroundColor:'rgba(255,255,255,0.04)', borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.08)', padding:20, alignItems:'center', gap:6 }}>
              <Ionicons name="chatbubble-outline" size={28} color="#333" />
              <Text style={{ color:'#555', fontSize:13 }}>コーチからのメッセージはまだありません</Text>
            </View>
          )}

          {/* 自分のコンディション */}
          <Text style={pd.sectionTitle}>マイ コンディション</Text>
          <View style={pd.condCard}>
            <View style={{ flexDirection:'row', gap:10, marginBottom:12 }}>
              <View style={pd.metricBox}>
                <Text style={{ fontSize:28 }}>{fatigue?.emoji ?? '—'}</Text>
                <Text style={[{ fontSize:13, fontWeight:'700', marginTop:3 }, { color:fatigue?.color ?? '#888' }]}>{fatigue?.label ?? 'データなし'}</Text>
                <Text style={pd.metricLabel}>最新疲労度</Text>
              </View>
              <View style={pd.metricBox}>
                <Text style={{ color:risk.signalColor, fontSize:26, fontWeight:'900' }}>{risk.riskScore}</Text>
                <Text style={{ color:risk.signalColor, fontSize:11, fontWeight:'700', marginTop:3 }}>{risk.label}</Text>
                <Text style={pd.metricLabel}>怪我リスク</Text>
              </View>
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-around', backgroundColor:'rgba(255,255,255,0.04)', borderRadius:10, paddingVertical:12 }}>
              <View style={{ alignItems:'center', gap:2 }}>
                <Text style={{ color:'#fff', fontSize:18, fontWeight:'800' }}>{thisWeek.length}</Text>
                <Text style={pd.metricLabel}>今週の練習</Text>
              </View>
              <View style={{ width:1, backgroundColor:'rgba(255,255,255,0.08)' }} />
              <View style={{ alignItems:'center', gap:2 }}>
                <Text style={{ color:'#fff', fontSize:18, fontWeight:'800' }}>
                  {(thisWeek.reduce((a,s) => a + (s.distance_m ?? 0), 0) / 1000).toFixed(1)}
                  <Text style={{ fontSize:11, color:'#666' }}>km</Text>
                </Text>
                <Text style={pd.metricLabel}>今週の距離</Text>
              </View>
              <View style={{ width:1, backgroundColor:'rgba(255,255,255,0.08)' }} />
              <View style={{ alignItems:'center', gap:2 }}>
                <Text style={{ color:'#fff', fontSize:18, fontWeight:'800' }}>{sessions.length}</Text>
                <Text style={pd.metricLabel}>総練習数</Text>
              </View>
            </View>
          </View>

          {/* チームメンバー */}
          <Text style={pd.sectionTitle}>チームメンバー</Text>
          <View style={{ gap:8 }}>
            {DEMO_MEMBERS.map(m => {
              const colors = ['#FF3B30','#FF9500','#34C759','#007AFF','#AF52DE']
              const c = colors[m.name.charCodeAt(0) % colors.length]
              return (
                <View key={m.id} style={{ flexDirection:'row', alignItems:'center', gap:12, backgroundColor:'rgba(255,255,255,0.05)', borderRadius:12, borderWidth:1, borderColor:'rgba(255,255,255,0.08)', padding:12 }}>
                  <Avatar name={m.name} size={36} color={c} />
                  <View style={{ flex:1 }}>
                    <Text style={{ color:'#fff', fontSize:14, fontWeight:'700' }}>{m.name}</Text>
                    <Text style={{ color:TEXT.hint, fontSize:11 }}>{m.event}</Text>
                  </View>
                  <Text style={{ color:'#444', fontSize:11 }}>{daysSince(m.lastActive)}</Text>
                </View>
              )
            })}
          </View>

          <View style={{ flexDirection:'row', gap:6, alignItems:'flex-start' }}>
            <Ionicons name="lock-closed-outline" size={12} color="#333" />
            <Text style={{ color:'#333', fontSize:11, flex:1, lineHeight:16 }}>
              チームへの共有は疲労度・練習記録のみです。体重などのプライベートな情報は共有されません。
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  )
}
const pd = StyleSheet.create({
  scroll:      { padding:16, paddingBottom:48, gap:14 },
  sectionTitle:{ color:TEXT.hint, fontSize:11, fontWeight:'700', letterSpacing:1 },
  condCard:    { backgroundColor:'rgba(255,255,255,0.05)', borderRadius:16, borderWidth:1, borderColor:'rgba(255,255,255,0.08)', padding:14 },
  metricBox:   { flex:1, alignItems:'center', backgroundColor:'rgba(255,255,255,0.04)', borderRadius:12, paddingVertical:14, gap:2 },
  metricLabel: { color:'#555', fontSize:10, marginTop:2 },
})

// ─────────────────────────────────────────────────────────────
// TeamScreen（エントリーポイント）
// ─────────────────────────────────────────────────────────────
export default function TeamScreen() {
  type State = 'loading' | 'select-role' | 'coach-setup' | 'coach' | 'player-join' | 'player'
  const [state,   setState]   = useState<State>('loading')
  const [setup,   setSetup]   = useState<TeamSetup | null>(null)
  const [joined,  setJoined]  = useState<JoinedTeam | null>(null)

  useEffect(() => {
    async function init() {
      const [roleRaw, setupRaw, joinedRaw] = await Promise.all([
        AsyncStorage.getItem(ROLE_KEY),
        AsyncStorage.getItem(SETUP_KEY),
        AsyncStorage.getItem(JOINED_KEY),
      ])
      const role = roleRaw as Role | null
      if (!role) { setState('select-role'); return }

      if (role === 'coach') {
        if (setupRaw) {
          setSetup(JSON.parse(setupRaw))
          setState('coach')
        } else {
          setState('coach-setup')
        }
      } else {
        if (joinedRaw) {
          setJoined(JSON.parse(joinedRaw))
          setState('player')
        } else {
          setState('player-join')
        }
      }
    }
    init()
  }, [])

  async function handleSelectRole(role: Role) {
    await AsyncStorage.setItem(ROLE_KEY, role)
    setState(role === 'coach' ? 'coach-setup' : 'player-join')
  }

  function handleCoachCreated(s: TeamSetup) {
    setSetup(s)
    setState('coach')
  }

  function handlePlayerJoined(j: JoinedTeam) {
    setJoined(j)
    setState('player')
  }

  async function handleReset() {
    await AsyncStorage.multiRemove([ROLE_KEY, SETUP_KEY, JOINED_KEY])
    setSetup(null); setJoined(null)
    setState('select-role')
  }

  if (state === 'loading') return <View style={{ flex:1, backgroundColor:'#000' }} />
  if (state === 'select-role')  return <RoleSelectionScreen onSelect={handleSelectRole} />
  if (state === 'coach-setup')  return <CoachSetupScreen onCreated={handleCoachCreated} onBack={() => setState('select-role')} />
  if (state === 'coach' && setup) return <CoachDashboard setup={setup} onReset={handleReset} />
  if (state === 'player-join')  return <PlayerJoinScreen onJoined={handlePlayerJoined} onBack={() => setState('select-role')} />
  if (state === 'player' && joined) return <PlayerDashboard joined={joined} onReset={handleReset} />
  return <View style={{ flex:1, backgroundColor:'#000' }} />
}
