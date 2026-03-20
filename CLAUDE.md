# TrackMate — 陸上AIコーチングアプリ

## プロジェクト概要
短距離（100m〜400m）・中長距離（800m〜）の競技者向けAIコーチングアプリ。
React Native (Expo) + Supabase + Claude API で構築。

## 技術スタック
- React Native 0.76 + Expo SDK 52
- TypeScript（strict: true）
- Supabase（DB + Storage + Auth）
- Claude API（claude-sonnet-4-20250514）— lib/claude.ts に集約
- Expo Router v3（ファイルベースルーティング）
- Victory Native 41（グラフ）
- expo-camera / expo-image-picker（カメラ・動画）
- expo-video（動画再生）
- react-native-reanimated 3（アニメーション）
- react-native-toast-message（通知）

## 専門種目（AIプロンプト最適化済み）
- **短距離系**: 100m / 200m / 400m / 110mH / 400mH
- **中長距離系**: 800m / 1500m / 3000m / 5000m / 10000m / 3000mSC

短距離と中長距離でトレーニング理論が異なるため、
Claude へのプロンプトは必ず `prompts/` ディレクトリのものを使うこと。

## ディレクトリ構成
```
app/
  (tabs)/
    index.tsx          # ダッシュボード（今日のコンディション + AIの一言）
    notebook.tsx       # 陸上ノート（記録一覧 + グラフ）
    nutrition.tsx      # 食事管理
    competition.tsx    # 試合モード
    sleep.tsx          # 睡眠・回復
  video-analysis.tsx   # 動画分析（タブ外）
  session-detail.tsx   # 練習詳細（タブ外）
components/
  VideoAnalyzer.tsx
  MealCamera.tsx
  CompetitionCountdown.tsx
  SleepTracker.tsx
  TrainingChart.tsx
  AIFeedbackCard.tsx
  ConditionBadge.tsx
lib/
  claude.ts            # Claude API 全呼び出しをここに集約
  supabase.ts          # Supabase クライアント
  storage.ts           # 画像・動画アップロード
hooks/
  useVideoAnalysis.ts
  useMealAnalysis.ts
  useCompetitionPlan.ts
  useSleepData.ts
  useTrainingSessions.ts
types/
  index.ts             # 全型定義
prompts/
  video.ts             # 動画分析プロンプト（距離系/短距離系で分岐）
  meal.ts              # 食事分析プロンプト
  competition.ts       # 試合計画プロンプト
  sleep.ts             # 睡眠アドバイスプロンプト
supabase/
  schema.sql           # テーブル定義
  seed.sql             # 初期データ
```

## 型定義（types/index.ts に記載）
全ての型はここを参照すること。追加したら必ずここに追記。

## コーディングルール
1. コンポーネントは関数型 + hooks で状態管理
2. Claude API 呼び出しは必ず lib/claude.ts 経由
3. API エラーは必ず catch してトースト通知を表示
4. loading 中は必ずスケルトン UI を表示（ActivityIndicator は使わない）
5. Supabase のレスポンスは必ず error チェックをする
6. 画像・動画は Supabase Storage にアップロードしてから URL を DB に保存
7. Claude API のレスポンスは JSON.parse する前に必ずバリデーション

## 環境変数（.env.local）
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
ANTHROPIC_API_KEY=your_anthropic_key  ← サーバーサイドのみ使用
```

## よく使う開発コマンド
```bash
npx expo start          # 開発サーバー起動
npx expo start --ios    # iOS シミュレーター
npx expo start --android
```
