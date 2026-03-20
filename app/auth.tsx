// app/auth.tsx — ログイン画面

import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing, ActivityIndicator, Platform,
  TextInput, KeyboardAvoidingView, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { BRAND, TEXT } from '../lib/theme'
import { Sounds, unlockAudio } from '../lib/sounds'

type Phase = 'input' | 'otp_sent'   // OTPフロー
type Tab   = 'otp' | 'password' | 'oauth'

// iframe (プレビュー) 内かどうか
const isInIframe = typeof window !== 'undefined' && window.self !== window.top
const SITE_URL   = 'https://trackmate-fojpl.surge.sh'

export default function AuthScreen() {
  const {
    signInWithGoogle, signInWithApple,
    signInWithEmail, signUpWithEmail,
    sendOtp, verifyOtp,
    continueAsGuest,
  } = useAuth()

  const [tab,    setTab]    = useState<Tab>('otp')
  const [phase,  setPhase]  = useState<Phase>('input')

  // OTPフィールド
  const [email,       setEmail]       = useState('')
  const [otpCode,     setOtpCode]     = useState('')
  const [otpLoading,  setOtpLoading]  = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [resendSec,   setResendSec]   = useState(0)

  // パスワードフィールド
  const [pwMode,      setPwMode]      = useState<'login' | 'signup'>('login')
  const [pwEmail,     setPwEmail]     = useState('')
  const [password,    setPassword]    = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [pwLoading,   setPwLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [appleLoading,  setAppleLoading]  = useState(false)

  // ── ロゴアニメーション ────────────────────────────────────
  const logoScale   = useRef(new Animated.Value(0.7)).current
  const logoOpac    = useRef(new Animated.Value(0)).current
  const contentY    = useRef(new Animated.Value(30)).current
  const contentOpac = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 130, friction: 9, useNativeDriver: true }),
        Animated.timing(logoOpac,  { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(contentY,    { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(contentOpac, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]),
    ]).start()
  }, [])

  // ── リセンドクールダウン（localStorage永続化・120秒） ────
  const COOLDOWN_KEY = 'tm_otp_sent_at'
  const COOLDOWN_SEC = 120

  const startCooldown = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()))
    }
    setResendSec(COOLDOWN_SEC)
    const tick = () => {
      setResendSec(prev => {
        if (prev <= 1) return 0
        setTimeout(tick, 1000)
        return prev - 1
      })
    }
    setTimeout(tick, 1000)
  }, [])

  // マウント時に残り秒数を復元
  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    const sentAt = Number(localStorage.getItem(COOLDOWN_KEY) ?? 0)
    if (!sentAt) return
    const elapsed = Math.floor((Date.now() - sentAt) / 1000)
    const remaining = COOLDOWN_SEC - elapsed
    if (remaining > 0) {
      setResendSec(remaining)
      const tick = () => {
        setResendSec(prev => {
          if (prev <= 1) return 0
          setTimeout(tick, 1000)
          return prev - 1
        })
      }
      setTimeout(tick, 1000)
    }
  }, [])

  // ── OTP送信 ───────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!email.trim()) return
    unlockAudio(); Sounds.pop()
    setOtpLoading(true)
    try {
      const ok = await sendOtp(email.trim())
      if (ok) { setPhase('otp_sent'); startCooldown() }
    } finally { setOtpLoading(false) }
  }

  // ── OTP再送 ───────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (resendSec > 0) return
    unlockAudio(); Sounds.tap()
    setOtpLoading(true)
    try {
      const ok = await sendOtp(email.trim())
      if (ok) startCooldown()
    } finally { setOtpLoading(false) }
  }

  // ── OTP検証 ───────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpCode.length < 6) return
    unlockAudio(); Sounds.pop()
    setOtpVerifying(true)
    try { await verifyOtp(email.trim(), otpCode.trim()) }
    finally { setOtpVerifying(false) }
  }

  // ── パスワード認証 ────────────────────────────────────────
  const handlePasswordAuth = async () => {
    if (!pwEmail.trim() || !password.trim()) return
    unlockAudio(); Sounds.pop()
    setPwLoading(true)
    try {
      if (pwMode === 'login') {
        await signInWithEmail(pwEmail.trim(), password)
      } else {
        const result = await signUpWithEmail(pwEmail.trim(), password)
        if (result === 'confirm_email') {
          setTab('otp')
          setEmail(pwEmail.trim())
          setPhase('input')
        }
      }
    } finally { setPwLoading(false) }
  }

  const handleGuest = () => { unlockAudio(); Sounds.tap(); continueAsGuest() }

  // ── タブ切替 ─────────────────────────────────────────────
  const switchTab = (t: Tab) => {
    unlockAudio(); Sounds.tap()
    setTab(t)
    if (t !== 'otp') setPhase('input')
  }

  return (
    <KeyboardAvoidingView style={styles.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* グリッド装飾 */}
      <View style={styles.grid} pointerEvents="none">
        {[...Array(7)].map((_, i) => (
          <View key={i} style={[styles.gridLine, { left: `${(i + 1) * (100 / 8)}%` as any }]} />
        ))}
      </View>

      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ロゴ */}
          <View style={styles.logoArea}>
            <Animated.View style={[styles.logoMark, { opacity: logoOpac, transform: [{ scale: logoScale }] }]}>
              <Text style={styles.logoLetter}>T</Text>
            </Animated.View>
            <Animated.View style={{ opacity: logoOpac, alignItems: 'center' }}>
              <Text style={styles.brand}>TrackMate</Text>
              <Text style={styles.tagline}>陸上競技のパートナー</Text>
            </Animated.View>
          </View>

          {/* コンテンツ */}
          <Animated.View style={[styles.content, { opacity: contentOpac, transform: [{ translateY: contentY }] }]}>

            {/* タブバー */}
            <View style={styles.tabBar}>
              {([
                { key: 'otp',      label: 'メールコード', icon: 'mail' },
                { key: 'password', label: 'パスワード',   icon: 'lock-closed' },
                { key: 'oauth',    label: 'SNS',          icon: 'logo-google' },
              ] as { key: Tab; label: string; icon: any }[]).map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
                  onPress={() => switchTab(t.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={t.icon} size={13} color={tab === t.key ? '#fff' : TEXT.hint} />
                  <Text style={[styles.tabLabel, tab === t.key && { color: '#fff' }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── OTPタブ ── */}
            {tab === 'otp' && phase === 'input' && (
              <View style={{ gap: 12 }}>
                <Text style={styles.desc}>
                  メールアドレスを入力すると6桁のコードを送ります{'\n'}パスワード不要で即ログイン
                </Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={16} color={TEXT.hint} />
                  <TextInput
                    style={styles.input}
                    placeholder="メールアドレス"
                    placeholderTextColor={TEXT.hint}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="send"
                    onSubmitEditing={handleSendOtp}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.primaryBtn, !email.trim() && { opacity: 0.4 }]}
                  onPress={handleSendOtp}
                  disabled={otpLoading || !email.trim()}
                  activeOpacity={0.85}
                >
                  {otpLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                        <Ionicons name="send" size={17} color="#fff" />
                        <Text style={styles.primaryBtnText}>コードを送る</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            )}

            {tab === 'otp' && phase === 'otp_sent' && (
              <View style={{ gap: 14 }}>
                {/* 送信先表示 */}
                <View style={styles.sentBox}>
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>コードを送りました</Text>
                    <Text style={{ color: TEXT.hint, fontSize: 12 }} numberOfLines={1}>{email}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setPhase('input'); setOtpCode('') }}>
                    <Text style={{ color: TEXT.hint, fontSize: 12 }}>変更</Text>
                  </TouchableOpacity>
                </View>

                {/* 6桁入力 */}
                <View style={{ gap: 8 }}>
                  <Text style={styles.codeLabel}>届いたコードを入力</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="key-outline" size={16} color={TEXT.hint} />
                    <TextInput
                      style={[styles.input, { letterSpacing: 8, fontSize: 22, fontWeight: '800' }]}
                      placeholder="000000"
                      placeholderTextColor="rgba(255,255,255,0.2)"
                      value={otpCode}
                      onChangeText={v => {
                        const digits = v.replace(/\D/g, '').slice(0, 6)
                        setOtpCode(digits)
                      }}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />
                    {otpCode.length === 6 && (
                      <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    )}
                  </View>
                </View>

                {/* 認証ボタン */}
                <TouchableOpacity
                  style={[styles.primaryBtn, otpCode.length < 6 && { opacity: 0.4 }]}
                  onPress={handleVerifyOtp}
                  disabled={otpVerifying || otpCode.length < 6}
                  activeOpacity={0.85}
                >
                  {otpVerifying
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                        <Ionicons name="shield-checkmark" size={17} color="#fff" />
                        <Text style={styles.primaryBtnText}>ログイン</Text>
                      </>
                  }
                </TouchableOpacity>

                {/* 再送 */}
                <TouchableOpacity
                  style={[styles.resendBtn, (resendSec > 0 || otpLoading) && { opacity: 0.4 }]}
                  onPress={handleResendOtp}
                  disabled={resendSec > 0 || otpLoading}
                  activeOpacity={0.7}
                >
                  {otpLoading
                    ? <ActivityIndicator size="small" color={BRAND} />
                    : <Ionicons name="refresh" size={15} color={BRAND} />
                  }
                  <Text style={styles.resendText}>
                    {resendSec > 0 ? `再送 (${resendSec}秒後)` : 'コードを再送する'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.spamHint}>
                  届かない場合は迷惑メールフォルダを確認してください
                </Text>
              </View>
            )}

            {/* ── パスワードタブ ── */}
            {tab === 'password' && (
              <View style={{ gap: 10 }}>
                <View style={styles.modeRow}>
                  {(['login', 'signup'] as const).map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.modeBtn, pwMode === m && styles.modeBtnActive]}
                      onPress={() => { setPwMode(m); Sounds.tap() }}
                    >
                      <Text style={[styles.modeBtnText, pwMode === m && { color: '#fff' }]}>
                        {m === 'login' ? 'ログイン' : '新規登録'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={16} color={TEXT.hint} />
                  <TextInput
                    style={styles.input}
                    placeholder="メールアドレス"
                    placeholderTextColor={TEXT.hint}
                    value={pwEmail}
                    onChangeText={setPwEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={16} color={TEXT.hint} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder={pwMode === 'signup' ? 'パスワード（6文字以上）' : 'パスワード'}
                    placeholderTextColor={TEXT.hint}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={TEXT.hint} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.primaryBtn, (!pwEmail.trim() || !password.trim()) && { opacity: 0.4 }]}
                  onPress={handlePasswordAuth}
                  disabled={pwLoading || !pwEmail.trim() || !password.trim()}
                  activeOpacity={0.85}
                >
                  {pwLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                        <Ionicons name={pwMode === 'login' ? 'log-in' : 'person-add'} size={17} color="#fff" />
                        <Text style={styles.primaryBtnText}>{pwMode === 'login' ? 'ログイン' : 'アカウント作成'}</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            )}

            {/* ── OAuthタブ ── */}
            {tab === 'oauth' && (
              <View style={{ gap: 14 }}>
                {/* iframeプレビュー警告 */}
                {isInIframe ? (
                  <View style={styles.iframeWarn}>
                    <Ionicons name="warning" size={22} color="#FF9500" />
                    <View style={{ flex: 1, gap: 8 }}>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 20 }}>
                        プレビュー内ではOAuthが{'\n'}ブロックされます
                      </Text>
                      <Text style={{ color: TEXT.secondary, fontSize: 12, lineHeight: 18 }}>
                        下のURLをブラウザで直接開いてからGoogleログインを使ってください
                      </Text>
                      <TouchableOpacity
                        style={styles.copyUrlBtn}
                        onPress={() => {
                          if (typeof navigator !== 'undefined' && navigator.clipboard) {
                            navigator.clipboard.writeText(SITE_URL)
                          }
                          unlockAudio(); Sounds.tap()
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="copy-outline" size={14} color={BRAND} />
                        <Text style={{ color: BRAND, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                          {SITE_URL}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.oauthNote}>
                    Google / Apple アカウントで素早くログイン
                  </Text>
                )}

                <TouchableOpacity
                  style={[styles.googleBtn, isInIframe && { opacity: 0.4 }]}
                  onPress={() => {
                    if (isInIframe) return
                    unlockAudio(); Sounds.pop()
                    setGoogleLoading(true)
                    signInWithGoogle().finally(() => setGoogleLoading(false))
                  }}
                  disabled={googleLoading || isInIframe}
                  activeOpacity={0.85}
                >
                  {googleLoading ? <ActivityIndicator color="#1a1a1a" size="small" /> : <>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#4285F4' }}>G</Text>
                    </View>
                    <Text style={styles.googleText}>Google でログイン</Text>
                  </>}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.appleBtn, isInIframe && { opacity: 0.4 }]}
                  onPress={() => {
                    if (isInIframe) return
                    unlockAudio(); Sounds.pop()
                    setAppleLoading(true)
                    signInWithApple().finally(() => setAppleLoading(false))
                  }}
                  disabled={appleLoading || isInIframe}
                  activeOpacity={0.85}
                >
                  {appleLoading ? <ActivityIndicator color="#fff" size="small" /> : <>
                    <Ionicons name="logo-apple" size={20} color="#fff" />
                    <Text style={styles.appleText}>Apple でログイン</Text>
                  </>}
                </TouchableOpacity>

                {!isInIframe && (
                  <Text style={[styles.oauthNote, { fontSize: 11, marginTop: -4 }]}>
                    ※ SupabaseダッシュボードでGoogle OAuth設定が必要
                  </Text>
                )}
              </View>
            )}

            {/* 区切り */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>または</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ゲスト */}
            <TouchableOpacity style={styles.guestBtn} onPress={handleGuest} activeOpacity={0.7}>
              <Ionicons name="person-outline" size={16} color={TEXT.secondary} />
              <View>
                <Text style={styles.guestText}>ゲストで続ける</Text>
                <Text style={styles.guestNote}>（データはこの端末のみ保存）</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.Text style={[styles.footer, { opacity: contentOpac }]}>
            ログインすることで利用規約とプライバシーポリシーに同意したことになります
          </Animated.Text>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

const SURFACE  = 'rgba(255,255,255,0.06)'
const SURFACE2 = 'rgba(255,255,255,0.1)'

const styles = StyleSheet.create({
  bg:   { flex: 1, backgroundColor: '#000' },
  grid: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.03)' },
  safe: { flex: 1, paddingHorizontal: 24 },

  logoArea:   { paddingTop: 40, paddingBottom: 28, alignItems: 'center', gap: 16 },
  logoMark:   { width: 72, height: 72, borderRadius: 20, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', shadowColor: BRAND, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 24 },
  logoLetter: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  brand:      { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1.5, textAlign: 'center' },
  tagline:    { color: TEXT.secondary, fontSize: 13, letterSpacing: 1.5, textAlign: 'center', marginTop: 4 },

  content:  { gap: 14, paddingBottom: 8 },

  tabBar:      { flexDirection: 'row', backgroundColor: SURFACE, borderRadius: 12, padding: 4, gap: 4 },
  tabBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 9 },
  tabBtnActive:{ backgroundColor: 'rgba(255,255,255,0.15)' },
  tabLabel:    { color: TEXT.hint, fontSize: 12, fontWeight: '700' },

  desc: { color: TEXT.secondary, fontSize: 13, lineHeight: 20, textAlign: 'center' },

  sentBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(52,199,89,0.1)',
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(52,199,89,0.25)',
  },
  codeLabel: { color: TEXT.hint, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  resendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  resendText: { color: BRAND, fontSize: 14, fontWeight: '700' },
  spamHint:   { color: TEXT.hint, fontSize: 11, textAlign: 'center' },

  modeRow:       { flexDirection: 'row', gap: 8 },
  modeBtn:       { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  modeBtnActive: { backgroundColor: BRAND, borderColor: BRAND },
  modeBtnText:   { color: TEXT.secondary, fontSize: 14, fontWeight: '700' },

  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 10 },
  input:     { flex: 1, color: '#fff', fontSize: 15, outlineStyle: 'none' as any },

  primaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  oauthNote:   { color: TEXT.hint, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  iframeWarn:  {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: 'rgba(255,149,0,0.1)',
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,149,0,0.3)',
  },
  copyUrlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,51,51,0.12)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,51,51,0.25)',
  },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 15 },
  googleText:{ color: '#1a1a1a', fontSize: 16, fontWeight: '700' },
  appleBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1a1a1a', borderRadius: 14, paddingVertical: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  appleText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: TEXT.hint, fontSize: 12 },

  guestBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 10 },
  guestText: { color: TEXT.secondary, fontSize: 15, fontWeight: '600' },
  guestNote: { color: TEXT.hint, fontSize: 11, marginTop: 1 },

  footer: { color: TEXT.hint, fontSize: 10, textAlign: 'center', paddingVertical: 20, lineHeight: 16 },
})
