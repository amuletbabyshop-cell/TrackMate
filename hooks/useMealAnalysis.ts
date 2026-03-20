// hooks/useMealAnalysis.ts — 食事写真撮影・AI 分析フック

import { useState, useCallback } from 'react'
import Toast from 'react-native-toast-message'
import { analyzeMeal } from '../lib/claude'
import { insertMeal } from '../lib/supabase'
import type {
  MealAnalysisResult,
  MealRecord,
  MealType,
  UserProfile,
} from '../types'

interface SaveMealInput {
  userId: string
  mealDate: string
  mealType: MealType
  trainingTiming: 'pre' | 'post' | 'none'
  photoUrl?: string
  analysisResult: MealAnalysisResult
}

interface UseMealAnalysisReturn {
  analyzing: boolean
  result: MealAnalysisResult | null
  error: string | null
  analyzeFromPhoto: (
    imageBase64: string,
    profile: UserProfile,
    mealType: MealType,
    trainingTiming: 'pre' | 'post' | 'none'
  ) => Promise<MealAnalysisResult | null>
  saveMeal: (input: SaveMealInput) => Promise<MealRecord | null>
  clearResult: () => void
}

export function useMealAnalysis(): UseMealAnalysisReturn {
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<MealAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ─────────────────────────────────────────
  // 写真から AI 分析を実行
  // ─────────────────────────────────────────
  const analyzeFromPhoto = useCallback(
    async (
      imageBase64: string,
      profile: UserProfile,
      mealType: MealType,
      trainingTiming: 'pre' | 'post' | 'none'
    ): Promise<MealAnalysisResult | null> => {
      setAnalyzing(true)
      setError(null)
      setResult(null)

      try {
        const analysisResult = await analyzeMeal(
          imageBase64,
          profile,
          mealType,
          trainingTiming
        )

        // レスポンスの最低限バリデーション
        if (
          !analysisResult ||
          !Array.isArray(analysisResult.foods) ||
          typeof analysisResult.total_calories !== 'number'
        ) {
          throw new Error('AI からの応答が不正な形式です')
        }

        setResult(analysisResult)
        return analysisResult
      } catch (err) {
        const message = err instanceof Error ? err.message : '食事分析に失敗しました'
        setError(message)
        Toast.show({
          type: 'error',
          text1: '食事分析に失敗',
          text2: message,
        })
        return null
      } finally {
        setAnalyzing(false)
      }
    },
    []
  )

  // ─────────────────────────────────────────
  // 分析結果を DB に保存
  // ─────────────────────────────────────────
  const saveMeal = useCallback(
    async (input: SaveMealInput): Promise<MealRecord | null> => {
      const { userId, mealDate, mealType, trainingTiming, photoUrl, analysisResult } = input

      const record: Omit<MealRecord, 'id' | 'created_at'> = {
        user_id: userId,
        meal_date: mealDate,
        meal_type: mealType,
        photo_url: photoUrl,
        foods: analysisResult.foods,
        total_calories: analysisResult.total_calories,
        total_protein: analysisResult.total_protein,
        total_carb: analysisResult.total_carb,
        total_fat: analysisResult.total_fat,
        training_timing: trainingTiming,
        advice: analysisResult.advice,
      }

      try {
        const saved = await insertMeal(record)
        return saved as MealRecord
      } catch (err) {
        const message = err instanceof Error ? err.message : '食事記録の保存に失敗しました'
        setError(message)
        Toast.show({
          type: 'error',
          text1: '食事記録の保存に失敗',
          text2: message,
        })
        return null
      }
    },
    []
  )

  // ─────────────────────────────────────────
  // 結果をリセット
  // ─────────────────────────────────────────
  const clearResult = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return {
    analyzing,
    result,
    error,
    analyzeFromPhoto,
    saveMeal,
    clearResult,
  }
}
