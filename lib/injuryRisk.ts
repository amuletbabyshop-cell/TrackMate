// lib/injuryRisk.ts — 怪我リスク計算エンジン
// 10%ルール + ATL/CTL/TSB + 体調 + 睡眠 + 食事 + スクリーンタイム を統合

import type { TrainingSession, SleepRecord } from '../types'

export type RiskLevel = 'low' | 'moderate' | 'high'

/** 各ファクターの寄与度（ホーム画面でのバー表示用） */
export interface RiskFactor {
  key: string
  name: string
  emoji: string
  score: number     // 0–100（そのファクターの問題度）
  maxScore: number  // このファクターの最大寄与点数
  description: string
}

export interface InjuryRiskResult {
  riskLevel: RiskLevel
  riskScore: number       // 0–100 (higher = more risky)
  signalColor: string     // hex color
  label: string
  recommendation: string
  reasons: string[]
  factors: RiskFactor[]   // 各ファクターの詳細（可視化用）
  weeklyKm: number
  prevWeeklyKm: number
  loadIncreasePct: number
  atl: number             // acute training load (7-day EWMA)
  ctl: number             // chronic training load (42-day EWMA)
  tsb: number             // training stress balance (positive = fresh)
}

/** Estimate session TSS from fatigue_level × estimated duration */
function sessionTSS(s: TrainingSession): number {
  const rpe = s.fatigue_level ?? 5
  // distance_m → rough duration in minutes (assuming ~6 min/km jog pace)
  const durationMin = s.distance_m
    ? Math.min((s.distance_m / 1000) * 6, 120)
    : 60
  return rpe * durationMin
}

export interface RiskInputExtra {
  mealQualityScore?: number    // 1–10 (食事の質、未記録なら undefined)
  screenTimeMinutes?: number   // 1日の平均スクリーンタイム（分）
  restDaysThisWeek?: number    // 今週の休養日数
}

export function calcInjuryRisk(
  sessions: TrainingSession[],
  sleepRecords: SleepRecord[],
  conditionLevel: number,   // 1–10
  hasRecentSymptom = false,
  extra: RiskInputExtra = {},
): InjuryRiskResult {
  const now = Date.now()
  const MS_DAY = 86_400_000

  // ── Weekly km (10% rule) ──────────────────────────────
  const thisWeek = sessions.filter(s =>
    now - new Date(s.session_date).getTime() <= 7 * MS_DAY
  )
  const prevWeek = sessions.filter(s => {
    const age = now - new Date(s.session_date).getTime()
    return age > 7 * MS_DAY && age <= 14 * MS_DAY
  })
  const weeklyKm     = thisWeek.reduce((a, s) => a + (s.distance_m ?? 0), 0) / 1000
  const prevWeeklyKm = prevWeek.reduce((a, s) => a + (s.distance_m ?? 0), 0) / 1000
  const loadIncreasePct = prevWeeklyKm > 0.5
    ? Math.round(((weeklyKm - prevWeeklyKm) / prevWeeklyKm) * 100)
    : 0

  // ── ATL / CTL / TSB (EWMA) ───────────────────────────
  const α7  = 2 / 8
  const α42 = 2 / 43
  let atl = 0, ctl = 0
  const dailyTSS: Record<string, number> = {}
  sessions.forEach(s => {
    const d = s.session_date.slice(0, 10)
    dailyTSS[d] = (dailyTSS[d] ?? 0) + sessionTSS(s)
  })
  for (let i = 41; i >= 0; i--) {
    const d = new Date(now - i * MS_DAY).toISOString().slice(0, 10)
    const tss = dailyTSS[d] ?? 0
    atl = atl + α7  * (tss - atl)
    ctl = ctl + α42 * (tss - ctl)
  }
  const tsb = Math.round(ctl - atl)  // positive = fresh

  // ── Sleep quality ─────────────────────────────────────
  const recentSleep = sleepRecords
    .filter(r => now - new Date(r.sleep_date).getTime() <= 4 * MS_DAY)
    .slice(0, 3)
  const avgSleepQ = recentSleep.length
    ? recentSleep.reduce((a, r) => a + r.quality_score, 0) / recentSleep.length
    : 7  // デフォルト: データなし = 7/10

  // ── 疲労トレンド (直近3セッション) ────────────────────
  const recentFatigue = sessions.slice(0, 3).map(s => s.fatigue_level ?? 5)
  const avgRecentFatigue = recentFatigue.length
    ? recentFatigue.reduce((a, v) => a + v, 0) / recentFatigue.length
    : 5

  // ── 各ファクターのスコア計算 ───────────────────────────
  // 練習負荷 (max 30)
  let loadScore = 0
  if      (loadIncreasePct > 30) loadScore = 30
  else if (loadIncreasePct > 15) loadScore = 18
  else if (loadIncreasePct > 5)  loadScore = 8

  // 疲労蓄積 TSB (max 25)
  let tsbScore = 0
  if      (tsb < -30) tsbScore = 25
  else if (tsb < -10) tsbScore = 14
  else if (tsb < 0)   tsbScore = 6

  // 体調 (max 20)
  let condScore = 0
  if      (conditionLevel <= 2) condScore = 20
  else if (conditionLevel <= 4) condScore = 12
  else if (conditionLevel <= 5) condScore = 6

  // 睡眠 (max 15)
  let sleepScore = 0
  if      (avgSleepQ < 4) sleepScore = 15
  else if (avgSleepQ < 6) sleepScore = 9
  else if (avgSleepQ < 7) sleepScore = 4

  // 直近疲労度 (max 15)
  let fatigueScore = 0
  if      (avgRecentFatigue >= 9) fatigueScore = 15
  else if (avgRecentFatigue >= 7) fatigueScore = 8
  else if (avgRecentFatigue >= 6) fatigueScore = 3

  // 食事の質 (max 10)
  let mealScore = 0
  const mealQ = extra.mealQualityScore
  if (mealQ !== undefined) {
    if      (mealQ <= 3) mealScore = 10
    else if (mealQ <= 5) mealScore = 5
    else if (mealQ <= 7) mealScore = 2
  }

  // スクリーンタイム (max 10 — 3時間以上で影響)
  let screenScore = 0
  const st = extra.screenTimeMinutes
  if (st !== undefined) {
    if      (st >= 360) screenScore = 10
    else if (st >= 240) screenScore = 6
    else if (st >= 180) screenScore = 3
  }

  // 違和感・痛み (max 20)
  const symptomScore = hasRecentSymptom ? 20 : 0

  // ── 合計スコア ────────────────────────────────────────
  let score = loadScore + tsbScore + condScore + sleepScore + fatigueScore
            + mealScore + screenScore + symptomScore
  score = Math.min(100, score)

  // ── 理由リスト ────────────────────────────────────────
  const reasons: string[] = []
  if (loadScore >= 18)   reasons.push(`週間距離が先週比 +${loadIncreasePct}%（急増注意）`)
  else if (loadScore > 0) reasons.push(`先週比 +${loadIncreasePct}%（10%ルールに注意）`)
  if (tsbScore >= 25)    reasons.push('累積疲労が高い — 休養が必要')
  else if (tsbScore > 0) reasons.push('疲労がやや蓄積している')
  if (condScore >= 12)   reasons.push('体調がかなり悪い')
  else if (condScore > 0) reasons.push('体調がやや悪い')
  if (sleepScore >= 9)   reasons.push('睡眠の質が低い状態が続いている')
  else if (sleepScore > 0) reasons.push('睡眠の質をもう少し上げたい')
  if (fatigueScore >= 8) reasons.push('直近の練習で疲労が高い傾向')
  if (mealScore >= 5)    reasons.push('食事の質が低い — 栄養補給を意識して')
  if (screenScore >= 6)  reasons.push('スクリーンタイムが多い — 睡眠に影響の可能性')
  if (symptomScore > 0)  reasons.push('最近の違和感・痛みの記録あり')

  // ── ファクター詳細（可視化用） ────────────────────────
  const factors: RiskFactor[] = [
    {
      key: 'load',
      name: '練習負荷',
      emoji: '🏃',
      score: Math.round((loadScore / 30) * 100),
      maxScore: 30,
      description: weeklyKm > 0
        ? `今週 ${Math.round(weeklyKm * 10) / 10}km · 先週比 ${loadIncreasePct > 0 ? '+' : ''}${loadIncreasePct}%`
        : '記録なし',
    },
    {
      key: 'fatigue',
      name: '疲労蓄積',
      emoji: '⚡',
      score: Math.round((tsbScore / 25) * 100),
      maxScore: 25,
      description: `TSB ${tsb > 0 ? '+' : ''}${tsb} · 直近疲労 ${avgRecentFatigue.toFixed(1)}/10`,
    },
    {
      key: 'condition',
      name: '体調',
      emoji: '💪',
      score: Math.round((condScore / 20) * 100),
      maxScore: 20,
      description: `体調スコア ${conditionLevel}/10`,
    },
    {
      key: 'sleep',
      name: '睡眠',
      emoji: '😴',
      score: Math.round((sleepScore / 15) * 100),
      maxScore: 15,
      description: recentSleep.length
        ? `直近の睡眠品質 ${avgSleepQ.toFixed(1)}/10`
        : '睡眠記録なし',
    },
    {
      key: 'recentFatigue',
      name: '直近疲労度',
      emoji: '🔋',
      score: Math.round((fatigueScore / 15) * 100),
      maxScore: 15,
      description: recentFatigue.length
        ? `直近${recentFatigue.length}回平均 ${avgRecentFatigue.toFixed(1)}/10`
        : '記録なし',
    },
    {
      key: 'meal',
      name: '食事',
      emoji: '🍽️',
      score: mealQ !== undefined ? Math.round((mealScore / 10) * 100) : -1,
      maxScore: 10,
      description: mealQ !== undefined ? `食事品質 ${mealQ}/10` : '未記録',
    },
    {
      key: 'screen',
      name: 'スクリーン',
      emoji: '📱',
      score: st !== undefined ? Math.round((screenScore / 10) * 100) : -1,
      maxScore: 10,
      description: st !== undefined ? `1日 ${Math.floor(st / 60)}時間${st % 60}分` : '未記録',
    },
  ]

  const riskLevel: RiskLevel = score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low'
  const signalColor = riskLevel === 'high' ? '#FF3B30' : riskLevel === 'moderate' ? '#FF9500' : '#34C759'
  const label =
    riskLevel === 'high'     ? '怪我リスク 高' :
    riskLevel === 'moderate' ? '注意が必要'    : 'コンディション良好'
  const recommendation =
    riskLevel === 'high'     ? '練習強度を下げるか休養を強く推奨' :
    riskLevel === 'moderate' ? '強度を落として様子を見ましょう' :
                               '通常通りの練習OK！'

  return {
    riskLevel, riskScore: score, signalColor, label, recommendation,
    reasons, factors,
    weeklyKm: Math.round(weeklyKm * 10) / 10,
    prevWeeklyKm: Math.round(prevWeeklyKm * 10) / 10,
    loadIncreasePct,
    atl: Math.round(atl), ctl: Math.round(ctl), tsb,
  }
}
