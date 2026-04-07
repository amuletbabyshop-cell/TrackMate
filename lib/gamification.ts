// lib/gamification.ts — シンプル育成ゲームシステム

export interface LevelInfo {
  level: number
  title: string
  emoji: string
  xp: number
  xpToNext: number
  progress: number  // 0.0–1.0
}

interface TitleEntry { min: number; title: string; emoji: string }

const LEVEL_TITLES: TitleEntry[] = [
  { min: 0,  title: 'ビギナー',  emoji: '🌱' },
  { min: 5,  title: 'ランナー',  emoji: '⚡' },
  { min: 10, title: '中級者',    emoji: '🔥' },
  { min: 20, title: '上級者',    emoji: '💪' },
  { min: 35, title: 'エリート',  emoji: '🏆' },
  { min: 50, title: 'レジェンド', emoji: '👑' },
]

const XP_PER_SESSION = 100
const XP_PER_LEVEL   = 500

export function calcLevelInfo(totalSessions: number): LevelInfo {
  const xp        = totalSessions * XP_PER_SESSION
  const level     = Math.floor(xp / XP_PER_LEVEL) + 1
  const xpInLevel = xp - (level - 1) * XP_PER_LEVEL
  const progress  = xpInLevel / XP_PER_LEVEL
  const xpToNext  = XP_PER_LEVEL - xpInLevel

  const titleInfo =
    [...LEVEL_TITLES].reverse().find(t => level >= t.min) ?? LEVEL_TITLES[0]

  return {
    level,
    title: titleInfo.title,
    emoji: titleInfo.emoji,
    xp,
    xpToNext,
    progress: Math.min(1, progress),
  }
}

/** セッション保存時に呼ぶ。レベルアップしたらメッセージを返す */
export function checkLevelUp(prevCount: number, newCount: number): string | null {
  const prev = calcLevelInfo(prevCount)
  const next  = calcLevelInfo(newCount)
  if (next.level > prev.level) {
    return `${next.emoji} Lv.${next.level} ${next.title} に昇格！`
  }
  return null
}
