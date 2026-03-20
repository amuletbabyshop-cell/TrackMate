// lib/theme.ts — Nike Podium インスパイアドデザインシステム
// 哲学: 黒と白を基盤に、色は機能的にのみ使う

// ── ブランドカラー ────────────────────────────────────────
export const BRAND = '#E53E3E'   // TrackMate レッド（CTAボタン・強調）

// ── 背景 ─────────────────────────────────────────────────
/** 純ブラック背景 */
export const BG_GRADIENT = ['#000000', '#000000', '#000000'] as const

// ── サーフェス ────────────────────────────────────────────
/** カード・セルの背景 */
export const SURFACE  = '#111111'
/** 少し浮いた要素（モーダル等） */
export const SURFACE2 = '#1A1A1A'
/** 区切り線 */
export const DIVIDER  = 'rgba(255,255,255,0.08)'

// ── テキスト ──────────────────────────────────────────────
export const TEXT = {
  primary:   '#FFFFFF',
  secondary: '#888888',
  hint:      '#555555',
} as const

// ── 機能的カラー（最小限） ────────────────────────────────
/** 状態表示にのみ使用 */
export const NEON = {
  blue:   '#4A9FFF',
  purple: '#9B6BFF',
  cyan:   '#00D4FF',
  pink:   '#FF4FC8',
  green:  '#34C759',
  amber:  '#FF9500',
} as const

// ── カード ────────────────────────────────────────────────
/** GlassCard 用互換トークン */
export const GLASS = {
  backgroundColor: '#111111',
  borderRadius: 12,
} as const

export const BLUR_INTENSITY = 0
