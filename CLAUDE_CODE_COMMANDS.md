# Claude Code 実行コマンド集
# このファイルのコマンドを上から順に Claude Code に貼り付けていく

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 1: プロジェクトセットアップ（Day 1）
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1-1. プロジェクト初期化
```
このリポジトリの package.json を使って Expo プロジェクトをセットアップして。
tsconfig.json（strict: true）、app.json（expo-router設定済み）、
.env.local（EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY のプレースホルダー）
を作って。
```

### 1-2. タブナビゲーション
```
app/(tabs)/_layout.tsx を作って。
5つのタブ：
- ダッシュボード（index.tsx）アイコン: home
- ノート（notebook.tsx）アイコン: book
- 食事（nutrition.tsx）アイコン: restaurant
- 試合（competition.tsx）アイコン: trophy
- 睡眠（sleep.tsx）アイコン: moon

タブバーのスタイルは黒背景・白テキスト・アクティブ時は赤（陸上トラックの色）にして。
```

### 1-3. ダッシュボード画面
```
app/(tabs)/index.tsx を作って。

表示する内容：
1. 今日の日付と「おはよう、{名前}さん」
2. コンディションカード（RecoveryStatus を表示、数値でゲージ表示）
3. 今週の練習サマリー（セッション数、合計距離、平均疲労度）
4. AIの一言アドバイス（getSleepAdvice の結果から）
5. 「動画を分析する」ボタン → video-analysis.tsx へ遷移
6. 直近3件の練習記録リスト

hooks/useTrainingSessions.ts と hooks/useSleepData.ts を先に作って、
それをダッシュボードで使うようにして。

ローディング中はスケルトンUIを表示（ActivityIndicator は使わない）。
```

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 2: 動画分析（Day 2-3）
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 2-1. 動画分析画面
```
app/video-analysis.tsx と components/VideoAnalyzer.tsx を作って。

VideoAnalyzer.tsx の機能：
1. 「動画を選択」ボタン（expo-image-picker、動画選択）
2. 選択後、expo-video でプレビュー再生
3. 「分析する」ボタン → ローディング表示（「AIが分析中...」テキスト付き）
4. 動画から4フレームを抽出（0%, 25%, 50%, 75% の位置）して base64 変換
5. lib/claude.ts の analyzeVideo を呼び出す
6. 結果表示：
   - technique_score をリング状のゲージで表示（0-100、色は赤〜緑）
   - feedback を大きなテキストで
   - strengths と improvements をアイコン付きリストで
   - drills を展開可能なカードリストで
   - next_events をタグで

hooks/useVideoAnalysis.ts を作ってそこに状態管理を集約して。

エラー時は Toast で「分析に失敗しました。もう一度お試しください」を表示。
```

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 3: 陸上ノート（Day 4-5）
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 3-1. ノート画面
```
app/(tabs)/notebook.tsx を作って。

タブで切り替え：
- 「記録一覧」: 練習記録のカードリスト（日付・種目・タイム・疲労度）
- 「グラフ」: タイム推移の折れ線グラフ（Victory Native の LineChart）

「＋」ボタンで記録入力モーダルを開く。
入力項目：
- 日付（DatePicker）
- 種目（Picker: セッションタイプ）
- イベント（Picker: 100m〜10000m）
- タイム（分:秒.ミリ秒の3つの入力欄）
- 距離・本数・セット数
- 疲労度（1-10 のスライダー）
- 体調（1-10 のスライダー）
- 天気（晴れ/曇り/雨/風強い）
- メモ

保存後、Supabase に insert して一覧を更新。

グラフはセッションタイプでフィルタリングできるようにして（ドロップダウン）。
```

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 4: 食事管理（Day 6-7）
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 4-1. 食事管理画面
```
app/(tabs)/nutrition.tsx と components/MealCamera.tsx を作って。

nutrition.tsx：
- 今日の食事一覧（朝・昼・夜・間食のタイムライン形式）
- 今日の合計：カロリー、タンパク質、炭水化物、脂質 のバーグラフ
- 「＋食事を追加」ボタン

MealCamera.tsx（モーダルシート）：
1. 食事タイプ選択（朝食/昼食/夕食/間食）
2. 「写真を撮る」or「ライブラリから選択」
3. 写真プレビュー + 「分析する」ボタン
4. トレーニングタイミング（前/後/なし）を選択
5. ローディング中「栄養を計算中...」
6. 結果：食品リスト（名前・カロリー・P/C/F）+ AIアドバイス
7. 「保存する」ボタン → Supabase に insert

信頼度（confidence）が0.7未満の食品には「?」バッジを表示。
```

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 5: 試合モード（Day 8-9）
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 5-1. 試合モード画面
```
app/(tabs)/competition.tsx と components/CompetitionCountdown.tsx を作って。

competition.tsx：
- 登録された試合のリスト（試合名・種目・日付・残り日数）
- 「＋試合を登録」ボタン

試合登録モーダル：
1. 試合名（テキスト入力）
2. 試合日（DatePicker）
3. 種目（Picker）
4. 目標タイム（任意）
5. 「計画を生成する」ボタン → generateCompetitionPlan を呼び出す
6. ローディング中「AIが練習計画を作成中...（30秒ほどかかります）」

生成された計画の表示：
- 週ごとのカード（スワイプで切り替え可能）
- 各週の練習セッションをアコーディオンで展開
- ピーク週とテーパー週はバッジで強調
- key_advice を冒頭に大きく表示

CompetitionCountdown.tsx：
- 選択中の試合までのカウントダウン（日・時・分・秒）
- アニメーション付き（Reanimated）
```

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 6: 睡眠・回復（Day 10）
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 6-1. 睡眠トラッカー画面
```
app/(tabs)/sleep.tsx と components/SleepTracker.tsx を作って。

sleep.tsx：
- 今週の睡眠グラフ（棒グラフ：睡眠時間、折れ線グラフ：質スコア、Victory Native）
- 今夜の睡眠記録ボタン（「就寝」→「起床」の2タップ方式）
- 直近7日の睡眠カードリスト
- 回復アドバイス（getRecoveryAdvice の結果）

SleepTracker.tsx（今日の睡眠入力）：
- 就寝時刻（TimePickerModal）
- 起床時刻（TimePickerModal）
- 睡眠の質（1-10 のスター評価）
- 安静時心拍数（任意）
- メモ
- 保存 → Supabase upsert

8時間未満の場合は「回復が不十分かもしれません」の警告を表示。
連続3日間6時間未満の場合は「休息が必要です」とAIがアラート。
```

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PHASE 7: 仕上げ（Day 11-14）
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 7-1. オンボーディング
```
app/onboarding.tsx を作って。
初回起動時にのみ表示：
1. 「TrackMate へようこそ」
2. 名前の入力
3. 専門種目の選択（short: 短距離系 / middle: 中長距離系）
4. 主な種目の選択（Picker）
5. 自己ベストの入力（任意）
6. 完了 → users テーブルに insert → ダッシュボードへ
```

### 7-2. グローバルエラーハンドリング
```
全画面に共通のエラーハンドリングを追加して：
- Supabase エラー → Toast「データの保存に失敗しました」
- Claude API エラー → Toast「AI分析に失敗しました。通信状況を確認してください」
- ネットワークエラー → Toast「オフラインです」
react-native-toast-message を app/_layout.tsx に設置して。
```

### 7-3. ダッシュボード強化
```
app/(tabs)/index.tsx を更新して。
週次サマリーカードに「AIコメントを更新」ボタンを追加して、
getWeeklySummary を呼び出して結果を表示するようにして。
キャッシュは AsyncStorage に保存（1時間有効）。
```
