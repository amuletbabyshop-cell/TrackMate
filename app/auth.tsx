// app/auth.tsx — ログイン画面

import React, { useRef, useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Easing, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { BRAND, TEXT } from '../lib/theme'
import { Sounds, unlockAudio } from '../lib/sounds'

export default function AuthScreen() {
  const { signInWithGoogle, signUpWithEmail, signInWithEmail, continueAsGuest } = useAuth()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showSignup, setShowSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

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

  const handleGoogle = () => {
    unlockAudio(); Sounds.pop()
    setGoogleLoading(true)
    signInWithGoogle().finally(() => setGoogleLoading(false))
  }

  const handleSignup = async () => {
    if (!email.trim() || password.length < 6) return
    unlockAudio(); Sounds.pop()
    setLoading(true)
    try {
      await signUpWithEmail(email.trim(), password)
    } finally {
      setLoading(false)
    }
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

          <Animated.View style={[styles.content, { opacity: contentOpac, transform: [{ translateY: contentY }] }]}>

            {/* Googleログイン */}
            <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} disabled={googleLoading} activeOpacity={0.85}>
              {googleLoading ? (
                <ActivityIndicator color="#1a1a1a" size="small" />
              ) : (
                <>
                  <View style={styles.gIcon}>
                    <Text style={styles.gIconText}>G</Text>
                  </View>
                  <Text style={styles.googleText}>Google でログイン</Text>
                </>
              )}
            </TouchableOpacity>

            {/* 区切り */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>または</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* 新規アカウント作成トグル */}
            {!showSignup ? (
              <TouchableOpacity
                style={styles.signupToggle}
                onPress={() => { setShowSignup(true); Sounds.tap() }}
                activeOpacity={0.7}
              >
                <Ionicons name="person-add-outline" size={17} color={BRAND} />
                <Text style={styles.signupToggleText}>メールで新規アカウント作成</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ gap: 10 }}>
                <Text style={styles.signupTitle}>新規アカウント作成</Text>
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
                  />
                </View>
                <View style={styles.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={16} color={TEXT.hint} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="パスワード（6文字以上）"
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
                  style={[styles.primaryBtn, (!email.trim() || password.length < 6) && { opacity: 0.4 }]}
                  onPress={handleSignup}
                  disabled={loading || !email.trim() || password.length < 6}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                        <Ionicons name="person-add" size={17} color="#fff" />
                        <Text style={styles.primaryBtnText}>アカウント作成</Text>
                      </>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowSignup(false)} style={{ alignItems: 'center', paddingVertical: 6 }}>
                  <Text style={{ color: TEXT.hint, fontSize: 13 }}>キャンセル</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {/* ゲストログイン */}
          <Animated.View style={{ opacity: contentOpac, marginTop: 4 }}>
            <TouchableOpacity
              style={styles.guestBtn}
              onPress={() => { unlockAudio(); Sounds.tap(); continueAsGuest() }}
              activeOpacity={0.7}
            >
              <Ionicons name="person-outline" size={16} color={TEXT.hint} />
              <Text style={styles.guestText}>ゲストとして続ける</Text>
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

const SURFACE2 = 'rgba(255,255,255,0.1)'

const styles = StyleSheet.create({
  bg:   { flex: 1, backgroundColor: '#000' },
  grid: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.03)' },
  safe: { flex: 1, paddingHorizontal: 24 },

  logoArea:   { paddingTop: 60, paddingBottom: 40, alignItems: 'center', gap: 16 },
  logoMark:   { width: 80, height: 80, borderRadius: 22, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', shadowColor: BRAND, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 28 },
  logoLetter: { color: '#fff', fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  brand:      { color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: -1.5 },
  tagline:    { color: TEXT.secondary, fontSize: 13, letterSpacing: 1.5, marginTop: 4 },

  content: { gap: 14, paddingBottom: 8 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 16, paddingVertical: 17,
    shadowColor: '#fff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12,
  },
  gIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center' },
  gIconText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  googleText: { color: '#1a1a1a', fontSize: 17, fontWeight: '700' },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: TEXT.hint, fontSize: 12 },

  signupToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: BRAND, borderRadius: 16, paddingVertical: 16,
  },
  signupToggleText: { color: BRAND, fontSize: 16, fontWeight: '700' },

  signupTitle: { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center' },

  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 10 },
  input:     { flex: 1, color: '#fff', fontSize: 15, outlineStyle: 'none' as any },

  primaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  guestBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  guestText: { color: TEXT.hint, fontSize: 14 },

  footer: { color: TEXT.hint, fontSize: 10, textAlign: 'center', paddingVertical: 20, lineHeight: 16 },
})
