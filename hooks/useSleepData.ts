// hooks/useSleepData.ts — 睡眠記録管理・回復状態算出フック

import { useState, useCallback } from 'react'
import Toast from 'react-native-toast-message'
import { getRecoveryAdvice } from '../lib/claude'
import { upsertSleep, getRecentSleep, getRecentSessions } from '../lib/supabase'
import type { SleepRecord, RecoveryStatus, LoadingState } from '../types'

interface UseSleepDataReturn {
  records: SleepRecord[]
  recovery: RecoveryStatus | null
  loading: LoadingState
  fetchRecords: (userId: string) => Promise<void>
  saveSleepRecord: (record: Omit<SleepRecord, 'id' | 'created_at'>) => Promise<SleepRecord | null>
  computeRecovery: (userId: string) => Promise<RecoveryStatus | null>
}

export function useSleepData(): UseSleepDataReturn {
  const [records, setRecords] = useState<SleepRecord[]>([])
  const [recovery, setRecovery] = useState<RecoveryStatus | null>(null)
  const [loading, setLoading] = useState<LoadingState>('idle')

  // ─────────────────────────────────────────
  // 睡眠記録一覧を取得
  // ─────────────────────────────────────────
  const fetchRecords = useCallback(async (userId: string): Promise<void> => {
    setLoading('loading')
    try {
      const data = await getRecentSleep(userId, 14)
      setRecords((data ?? []) as SleepRecord[])
      setLoading('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : '睡眠記録の取得に失敗しました'
      setLoading('error')
      Toast.show({
        type: 'error',
        text1: '睡眠記録の取得に失敗',
        text2: message,
      })
    }
  }, [])

  // ─────────────────────────────────────────
  // 睡眠記録を保存（upsert — 同日の記録は上書き）
  // ─────────────────────────────────────────
  const saveSleepRecord = useCallback(
    async (
      record: Omit<SleepRecord, 'id' | 'created_at'>
    ): Promise<SleepRecord | null> => {
      setLoading('loading')
      try {
        const saved = await upsertSleep(record)
        const upserted = saved as SleepRecord

        setRecords(prev => {
          const exists = prev.some(r => r.sleep_date === upserted.sleep_date)
          if (exists) {
            return prev.map(r =>
              r.sleep_date === upserted.sleep_date ? upserted : r
            )
          }
          return [upserted, ...prev]
        })

        setLoading('success')
        return upserted
      } catch (err) {
        const message = err instanceof Error ? err.message : '睡眠記録の保存に失敗しました'
        setLoading('error')
        Toast.show({
          type: 'error',
          text1: '睡眠記録の保存に失敗',
          text2: message,
        })
        return null
      }
    },
    []
  )

  // ─────────────────────────────────────────
  // 直近の睡眠 + トレーニングデータから回復状態を算出
  // ─────────────────────────────────────────
  const computeRecovery = useCallback(
    async (userId: string): Promise<RecoveryStatus | null> => {
      setLoading('loading')
      try {
        // 直近 14 日の睡眠と 7 日のトレーニングを並列取得
        const [sleepData, sessionData] = await Promise.all([
          getRecentSleep(userId, 14),
          getRecentSessions(userId, 7),
        ])

        const recentSleep = (sleepData ?? []) as SleepRecord[]
        const recentSessions = (sessionData ?? []) as import('../types').TrainingSession[]

        // Claude API に渡して回復状態を推定
        const status = await getRecoveryAdvice(recentSleep, recentSessions)

        // レスポンスバリデーション
        if (
          !status ||
          typeof status.overall !== 'number' ||
          typeof status.sleep_score !== 'number' ||
          typeof status.fatigue_score !== 'number' ||
          !['high', 'moderate', 'low'].includes(status.readiness)
        ) {
          throw new Error('AI からの回復状態データが不正な形式です')
        }

        setRecovery(status)

        // 最新の睡眠記録もローカルに反映
        if (recentSleep.length > 0) {
          setRecords(recentSleep)
        }

        setLoading('success')
        return status
      } catch (err) {
        const message = err instanceof Error ? err.message : '回復状態の計算に失敗しました'
        setLoading('error')
        Toast.show({
          type: 'error',
          text1: '回復状態の計算に失敗',
          text2: message,
        })
        return null
      }
    },
    []
  )

  return {
    records,
    recovery,
    loading,
    fetchRecords,
    saveSleepRecord,
    computeRecovery,
  }
}
