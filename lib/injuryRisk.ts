// lib/injuryRisk.ts — 怪我リスク計算エンジン
// 10%ルール + ATL/CTL/TSB + 体調 + 睡眠 を統合

import type { TrainingSession, SleepRecord } from '../types'

export type RiskLevel = 'low' | 'moderate' | 'high'

export interface InjuryRiskResult {
  riskLevel: RiskLevel
  riskScore: number       // 0–100 (higher = more risky)
  signalColor: string     // hex color
  label: string
  recommendation: string
  reasons: string[]
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

export function calcInjuryRisk(
  sessions: TrainingSession[],
  sleepRecords: SleepRecord[],
  conditionLevel: number,   // 1–10
  hasRecentSymptom = false,
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
  const weeklyKm   = thisWeek.reduce((a, s) => a + (s.distance_m ?? 0), 0) / 1000
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

  // ── Sleep quality ────────────────────────────────────
  const recentSleep = sleepRecords
    .filter(r => now - new Date(r.sleep_date).getTime() <= 4 * MS_DAY)
    .slice(0, 3)
  const avgSleepQ = recentSleep.length
    ? recentSleep.reduce((a, r) => a + r.quality_score, 0) / recentSleep.length
    : 7

  // ── Composite risk score ──────────────────────────────
  let score = 0
  const reasons: string[] = []

  // Load increase (0–30 pts)
  if (loadIncreasePct > 30) {
    score += 30
    reasons.push(`週間距離が先週比 +${loadIncreasePct}%（急増注意）`)
  } else if (loadIncreasePct > 10) {
    score += 12
    reasons.push(`先週比 +${loadIncreasePct}%（10%ルールに注意）`)
  }

  // TSB fatigue (0–25 pts)
  if (tsb < -30) {
    score += 25
    reasons.push('累積疲労が高い — 休養が必要')
  } else if (tsb < -10) {
    score += 12
    reasons.push('疲労がやや蓄積している')
  }

  // Condition (0–20 pts)
  if (conditionLevel <= 3) {
    score += 20
    reasons.push('体調がかなり悪い')
  } else if (conditionLevel <= 5) {
    score += 10
    reasons.push('体調がやや悪い')
  }

  // Sleep (0–15 pts)
  if (avgSleepQ < 5) {
    score += 15
    reasons.push('睡眠の質が低い状態が続いている')
  } else if (avgSleepQ < 7) {
    score += 7
    reasons.push('睡眠の質をもう少し上げたい')
  }

  // Recent symptom (0–20 pts)
  if (hasRecentSymptom) {
    score += 20
    reasons.push('最近の違和感・痛みの記録あり')
  }

  score = Math.min(100, score)
  const riskLevel: RiskLevel = score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low'
  const signalColor = riskLevel === 'high' ? '#FF3B30' : riskLevel === 'moderate' ? '#FF9500' : '#34C759'
  const label = riskLevel === 'high' ? '怪我リスク 高' : riskLevel === 'moderate' ? '注意が必要' : 'コンディション良好'
  const recommendation =
    riskLevel === 'high'     ? '練習強度を下げるか休養を強く推奨' :
    riskLevel === 'moderate' ? '強度を落として様子を見ましょう' :
                               '通常通りの練習OK！'

  return {
    riskLevel, riskScore: score, signalColor, label, recommendation, reasons,
    weeklyKm: Math.round(weeklyKm * 10) / 10,
    prevWeeklyKm: Math.round(prevWeeklyKm * 10) / 10,
    loadIncreasePct,
    atl: Math.round(atl), ctl: Math.round(ctl), tsb,
  }
}
