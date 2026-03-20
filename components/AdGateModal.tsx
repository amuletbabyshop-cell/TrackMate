import React, { useEffect, useRef, useState } from 'react'
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BRAND, NEON, TEXT, SURFACE, SURFACE2, DIVIDER } from '../lib/theme'
import type { Feature } from '../lib/adGate'

// ─── Adsterra設定 ────────────────────────────────────────────────────────────
// Adsterra ダッシュボード → Create Ad → Display Banner → 300×250 で取得した Key を貼る
// https://publishers.adsterra.com/
const ADSTERRA_KEY_300x250 = '881ea8cb0feefb17ea4916b7fe6b2ed3'

const IS_AD_CONFIGURED = ADSTERRA_KEY_300x250 !== 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'

const COUNTDOWN_SECONDS = 15

interface Props {
  visible: boolean
  feature: Feature
  adCount?: number         // 何本見せるか（デフォルト1、動画は2）
  hardLimited?: boolean    // 絶対上限到達（今日はもう使えない）
  onClose: () => void
  onAdWatched: () => void
  onUpgrade: () => void
}

function featureTitle(feature: Feature): string {
  switch (feature) {
    case 'video':    return '動画分析の利用上限に達しました'
    case 'meal':     return '食事分析の利用上限に達しました'
    case 'recovery': return 'リカバリーAIの利用上限に達しました'
  }
}

function featureSubtitle(feature: Feature): string {
  switch (feature) {
    case 'video':    return '無料プランでは1日2回まで利用できます'
    case 'meal':     return '無料プランでは1日3回まで利用できます'
    case 'recovery': return '無料プランでは1日5回まで利用できます'
  }
}

// ─── Adsterra 広告注入（Web専用）─────────────────────────────────────────────
// Adsterra の Banner は atOptions オブジェクト + invoke.js の2段構成
function AdUnit({ visible }: { visible: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return
    const container = containerRef.current
    if (!container) return

    container.innerHTML = ''

    // 1) atOptions をインライン script で注入
    const opts = document.createElement('script')
    opts.type = 'text/javascript'
    opts.text = `
      atOptions = {
        'key'    : '${ADSTERRA_KEY_300x250}',
        'format' : 'iframe',
        'height' : 250,
        'width'  : 300,
        'params' : {}
      };
    `
    container.appendChild(opts)

    // 2) invoke.js を外部 script として注入
    const invoke = document.createElement('script')
    invoke.type = 'text/javascript'
    invoke.src  = `//www.highperformanceformat.com/${ADSTERRA_KEY_300x250}/invoke.js`
    invoke.async = true
    container.appendChild(invoke)
  }, [visible])

  if (Platform.OS !== 'web') return null

  return (
    <div
      ref={containerRef}
      style={{ width: 300, height: 250, overflow: 'hidden' }}
    />
  )
}

// ─── プレースホルダー（Key 未設定時）──────────────────────────────────────────
function AdPlaceholder() {
  return (
    <View style={styles.adPlaceholder}>
      <Text style={{ fontSize: 28 }}>📢</Text>
      <Text style={styles.adPlaceholderText}>広告スペース</Text>
      <Text style={styles.adPlaceholderSub}>Adsterra 300×250</Text>
    </View>
  )
}

// ─── メインモーダル ──────────────────────────────────────────────────────────
export default function AdGateModal({ visible, feature, adCount = 1, hardLimited = false, onClose, onAdWatched, onUpgrade }: Props) {
  const [step,        setStep]        = useState(1)   // 現在何本目か
  const [countdown,   setCountdown]   = useState(COUNTDOWN_SECONDS)
  const [canContinue, setCanContinue] = useState(false)
  const isAdConfigured = IS_AD_CONFIGURED

  // モーダルが開く / ステップが変わるたびにカウントダウンをリセット
  useEffect(() => {
    if (!visible) return
    setCountdown(COUNTDOWN_SECONDS)
    setCanContinue(false)
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); setCanContinue(true); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [visible, step])

  // モーダルを閉じたらステップをリセット
  useEffect(() => { if (!visible) setStep(1) }, [visible])

  function handleNext() {
    if (step < adCount) {
      // まだ次の広告がある
      setStep(s => s + 1)
    } else {
      // 全部見た → 完了
      onAdWatched()
    }
  }

  const isLastAd = step >= adCount

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>

          {/* ── ヘッダー ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="lock-closed" size={18} color={BRAND} />
              <Text style={styles.headerBadge}>無料プラン</Text>
              {adCount > 1 && (
                <Text style={styles.stepBadge}>{step} / {adCount}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color={TEXT.secondary} />
            </TouchableOpacity>
          </View>

          {/* ── タイトル ── */}
          <Text style={styles.title}>
            {hardLimited ? '本日の利用上限に達しました' : featureTitle(feature)}
          </Text>
          <Text style={styles.subtitle}>
            {hardLimited
              ? '明日またご利用いただけます。広告なしで使い続けるにはプレミアムへ。'
              : adCount > 1
                ? `広告を${adCount}本見ると分析できます（${step}本目）`
                : featureSubtitle(feature)}
          </Text>

          {/* ── 絶対上限時はロックアイコン、それ以外は広告 ── */}
          {hardLimited ? (
            <View style={styles.hardLimitBox}>
              <Text style={{ fontSize: 48 }}>🔒</Text>
              <Text style={styles.hardLimitText}>今日はここまで</Text>
              <Text style={styles.hardLimitSub}>明日 0:00 にリセットされます</Text>
            </View>
          ) : (
            <>
              <View style={styles.adContainer}>
                {Platform.OS === 'web' && isAdConfigured
                  ? <AdUnit visible={visible} />
                  : <AdPlaceholder />
                }
              </View>

              {/* カウントダウン */}
              {!canContinue && (
                <View style={styles.countdownRow}>
                  <Ionicons name="time-outline" size={14} color={TEXT.secondary} />
                  <Text style={styles.countdownText}>あと{countdown}秒...</Text>
                </View>
              )}

              {/* ボタン（カウントダウン後） */}
              {canContinue && (
                <TouchableOpacity style={styles.continueBtn} onPress={handleNext} activeOpacity={0.85}>
                  <Ionicons name={isLastAd ? 'checkmark-circle' : 'arrow-forward-circle'} size={18} color="#fff" />
                  <Text style={styles.continueBtnText}>
                    {isLastAd ? '分析する' : `次の広告へ（${step + 1}/${adCount}）`}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* ── プレミアムへのリンク ── */}
          <TouchableOpacity style={styles.upgradeLink} onPress={onUpgrade} activeOpacity={0.7}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.upgradeLinkText}>広告なしプレミアムへ ¥490/月</Text>
            <Ionicons name="chevron-forward" size={14} color={TEXT.hint} />
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#111111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 12,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBadge: {
    color: BRAND,
    fontSize: 12,
    fontWeight: '700',
  },
  hardLimitBox: {
    width: '100%', paddingVertical: 28,
    alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  hardLimitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  hardLimitSub:  { color: TEXT.hint, fontSize: 12 },
  stepBadge: {
    color: TEXT.hint,
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SURFACE2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text
  title: {
    color: TEXT.primary,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
  },
  subtitle: {
    color: TEXT.secondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Ad area
  adContainer: {
    width: 300,
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: DIVIDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Ad placeholder
  adPlaceholder: {
    width: 300,
    height: 250,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  adPlaceholderText: {
    color: TEXT.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  adPlaceholderSub: {
    color: TEXT.hint,
    fontSize: 12,
  },

  // Countdown
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SURFACE2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  countdownText: {
    color: TEXT.secondary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Continue button
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: NEON.green,
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  // Upgrade link
  upgradeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  upgradeLinkText: {
    color: TEXT.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
})
