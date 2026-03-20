// hooks/useCompetitionPlan.ts — 試合計画生成・管理フック

import { useState, useCallback } from 'react'
import Toast from 'react-native-toast-message'
import { generateCompetitionPlan } from '../lib/claude'
import { saveCompetitionPlan, getUpcomingCompetitions } from '../lib/supabase'
import type { CompetitionPlan, LoadingState, UserProfile } from '../types'

interface UseCompetitionPlanReturn {
  plans: CompetitionPlan[]
  currentPlan: CompetitionPlan | null
  loading: LoadingState
  fetchPlans: (userId: string) => Promise<void>
  generatePlan: (
    competitionDate: Date,
    competitionName: string,
    profile: UserProfile
  ) => Promise<CompetitionPlan | null>
  selectPlan: (plan: CompetitionPlan) => void
}

export function useCompetitionPlan(): UseCompetitionPlanReturn {
  const [plans, setPlans] = useState<CompetitionPlan[]>([])
  const [currentPlan, setCurrentPlan] = useState<CompetitionPlan | null>(null)
  const [loading, setLoading] = useState<LoadingState>('idle')

  // ─────────────────────────────────────────
  // 直近の試合計画一覧を取得
  // ─────────────────────────────────────────
  const fetchPlans = useCallback(async (userId: string): Promise<void> => {
    setLoading('loading')
    try {
      const data = await getUpcomingCompetitions(userId)
      const fetched = (data ?? []) as CompetitionPlan[]
      setPlans(fetched)

      // 最も近い試合計画を currentPlan にセット
      if (fetched.length > 0 && currentPlan === null) {
        setCurrentPlan(fetched[0])
      }

      setLoading('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : '試合計画の取得に失敗しました'
      setLoading('error')
      Toast.show({
        type: 'error',
        text1: '試合計画の取得に失敗',
        text2: message,
      })
    }
  }, [currentPlan])

  // ─────────────────────────────────────────
  // AI で試合計画を生成して DB に保存
  // ─────────────────────────────────────────
  const generatePlan = useCallback(
    async (
      competitionDate: Date,
      competitionName: string,
      profile: UserProfile
    ): Promise<CompetitionPlan | null> => {
      setLoading('loading')
      try {
        // Claude API で計画を生成
        const aiResult = await generateCompetitionPlan(
          competitionDate,
          competitionName,
          profile
        )

        // aiResult の最低限バリデーション
        if (!aiResult || !Array.isArray((aiResult as { phases?: unknown[] }).phases ?? aiResult)) {
          throw new Error('AI からの計画データが不正な形式です')
        }

        // Claude の返値は phases 配列 + peak_week / taper_start_week / key_advice を含む型
        const phases = Array.isArray(aiResult)
          ? aiResult
          : (aiResult as unknown as CompetitionPlan).phases

        const peak_week: number =
          (aiResult as { peak_week?: number }).peak_week ?? 2

        const taper_start_week: number =
          (aiResult as { taper_start_week?: number }).taper_start_week ?? 1

        const key_advice: string =
          (aiResult as { key_advice?: string }).key_advice ?? ''

        const daysUntil = Math.ceil(
          (competitionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )

        const planPayload: Omit<CompetitionPlan, 'id' | 'created_at'> = {
          user_id: profile.id,
          competition_name: competitionName,
          competition_date: competitionDate.toISOString().slice(0, 10),
          event: profile.primary_event,
          target_time_ms: profile.target_time_ms ?? 0,
          days_until: daysUntil,
          phases,
          peak_week,
          taper_start_week,
          key_advice,
        }

        const saved = await saveCompetitionPlan(planPayload)
        const newPlan = saved as CompetitionPlan

        setPlans(prev => [newPlan, ...prev])
        setCurrentPlan(newPlan)
        setLoading('success')
        return newPlan
      } catch (err) {
        const message = err instanceof Error ? err.message : '試合計画の生成に失敗しました'
        setLoading('error')
        Toast.show({
          type: 'error',
          text1: '試合計画の生成に失敗',
          text2: message,
        })
        return null
      }
    },
    []
  )

  // ─────────────────────────────────────────
  // 表示する計画を選択
  // ─────────────────────────────────────────
  const selectPlan = useCallback((plan: CompetitionPlan): void => {
    setCurrentPlan(plan)
  }, [])

  return {
    plans,
    currentPlan,
    loading,
    fetchPlans,
    generatePlan,
    selectPlan,
  }
}
