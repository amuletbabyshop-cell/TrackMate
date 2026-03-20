import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { BG_GRADIENT, TEXT } from '../lib/theme'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Toast from 'react-native-toast-message'

// ── 定数 ─────────────────────────────────────────────────────────
const WORKOUT_MENUS_KEY = 'trackmate_workout_menus'
const BRAND = '#E53935'

// ── 型定義 ───────────────────────────────────────────────────────
type Exercise = {
  id: string
  name: string
  type: 'warmup' | 'main' | 'cooldown'
  sets?: number
  reps?: number
  distance?: string
  restSec?: number
  note?: string
}

type WorkoutMenu = {
  id: string
  title: string
  date: string
  category: 'sprint' | 'endurance' | 'jump' | 'throw' | 'hurdle' | 'circuit'
  exercises: Exercise[]
  totalDuration?: number
  rpe?: number
  memo?: string
  completed: boolean
}

// ── カテゴリ設定 ─────────────────────────────────────────────────
const CATEGORIES: { key: WorkoutMenu['category']; label: string; icon: string; color: string }[] = [
  { key: 'sprint',    label: 'スプリント', icon: 'flash',          color: '#E53935' },
  { key: 'endurance', label: '持久',       icon: 'heart',          color: '#2196F3' },
  { key: 'jump',      label: '跳躍',       icon: 'arrow-up',       color: '#4CAF50' },
  { key: 'throw',     label: '投擲',       icon: 'radio-button-on',color: '#FF9800' },
  { key: 'hurdle',    label: 'ハードル',   icon: 'git-branch',     color: '#9C27B0' },
  { key: 'circuit',   label: 'サーキット', icon: 'repeat',         color: '#FFC107' },
]

const FILTER_OPTIONS: { key: 'all' | WorkoutMenu['category']; label: string }[] = [
  { key: 'all',       label: '全て' },
  { key: 'sprint',    label: 'スプリント' },
  { key: 'endurance', label: '持久' },
  { key: 'jump',      label: '跳躍' },
  { key: 'throw',     label: '投擲' },
  { key: 'hurdle',    label: 'ハードル' },
  { key: 'circuit',   label: 'サーキット' },
]

const EXERCISE_TYPE_LABELS: Record<Exercise['type'], string> = {
  warmup:   'ウォームアップ',
  main:     'メイン',
  cooldown: 'クールダウン',
}

const EXERCISE_TYPE_COLORS: Record<Exercise['type'], string> = {
  warmup:   '#FF9800',
  main:     '#E53935',
  cooldown: '#2196F3',
}

// ── プリセットテンプレート ────────────────────────────────────────
type Template = { label: string; category: WorkoutMenu['category']; exercises: Omit<Exercise, 'id'>[] }

const TEMPLATES: Template[] = [
  {
    label: '100m練習',
    category: 'sprint',
    exercises: [
      { name: 'ジョグ', type: 'warmup', distance: '1000m', note: '軽めに' },
      { name: 'ドリル', type: 'warmup', sets: 1, note: 'A走・B走・もも上げ' },
      { name: '60m走', type: 'main', distance: '60m', sets: 5, restSec: 180 },
      { name: '100m走', type: 'main', distance: '100m', sets: 3, restSec: 480 },
      { name: 'ジョグ', type: 'cooldown', distance: '800m' },
      { name: 'ストレッチ', type: 'cooldown', note: '10分程度' },
    ],
  },
  {
    label: '400m練習',
    category: 'sprint',
    exercises: [
      { name: 'ジョグ', type: 'warmup', distance: '1500m' },
      { name: 'ドリル', type: 'warmup', sets: 1 },
      { name: '200m走', type: 'main', distance: '200m', sets: 4, restSec: 300 },
      { name: '400m走', type: 'main', distance: '400m', sets: 2, restSec: 600 },
      { name: 'ジョグ', type: 'cooldown', distance: '1000m' },
      { name: 'ストレッチ', type: 'cooldown', note: '15分' },
    ],
  },
  {
    label: '持久走',
    category: 'endurance',
    exercises: [
      { name: 'ジョグ', type: 'warmup', distance: '1000m' },
      { name: 'ロング走', type: 'main', distance: '8000m', note: '一定ペース' },
      { name: 'ジョグ', type: 'cooldown', distance: '500m' },
      { name: 'ストレッチ', type: 'cooldown', note: '10分' },
    ],
  },
  {
    label: 'サーキット',
    category: 'circuit',
    exercises: [
      { name: 'ジョグ', type: 'warmup', distance: '800m' },
      { name: 'スクワット', type: 'main', sets: 3, reps: 20, restSec: 60 },
      { name: 'プッシュアップ', type: 'main', sets: 3, reps: 15, restSec: 60 },
      { name: 'バーピー', type: 'main', sets: 3, reps: 10, restSec: 90 },
      { name: 'プランク', type: 'main', sets: 3, note: '30秒 × 3', restSec: 60 },
      { name: 'ストレッチ', type: 'cooldown', note: '10分' },
    ],
  },
]

// ── ユーティリティ ───────────────────────────────────────────────
function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function getCategoryInfo(cat: WorkoutMenu['category']) {
  return CATEGORIES.find(c => c.key === cat) ?? CATEGORIES[0]
}

// ── サブコンポーネント: ExerciseRow ──────────────────────────────
function ExerciseRow({
  exercise,
  onRemove,
}: {
  exercise: Exercise
  onRemove: () => void
}) {
  const cat = EXERCISE_TYPE_COLORS[exercise.type]
  const parts: string[] = []
  if (exercise.distance) parts.push(exercise.distance)
  if (exercise.sets && exercise.reps) parts.push(`${exercise.sets}セット×${exercise.reps}回`)
  else if (exercise.sets) parts.push(`${exercise.sets}セット`)
  else if (exercise.reps) parts.push(`${exercise.reps}回`)
  if (exercise.restSec) parts.push(`休${exercise.restSec}秒`)

  return (
    <View style={exStyles.row}>
      <View style={[exStyles.typeBadge, { backgroundColor: cat + '22', borderColor: cat }]}>
        <Text style={[exStyles.typeText, { color: cat }]}>{EXERCISE_TYPE_LABELS[exercise.type].slice(0, 2)}</Text>
      </View>
      <View style={exStyles.info}>
        <Text style={exStyles.name}>{exercise.name}</Text>
        {parts.length > 0 && <Text style={exStyles.detail}>{parts.join('  ')}</Text>}
        {exercise.note ? <Text style={exStyles.note}>{exercise.note}</Text> : null}
      </View>
      <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close-circle" size={18} color="#555" />
      </TouchableOpacity>
    </View>
  )
}

const exStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 10,
  },
  typeBadge: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeText: { fontSize: 10, fontWeight: '700' },
  info: { flex: 1, gap: 2 },
  name: { color: '#fff', fontSize: 13, fontWeight: '600' },
  detail: { color: '#888', fontSize: 11 },
  note: { color: '#666', fontSize: 11, fontStyle: 'italic' },
})

// ── サブコンポーネント: AddExerciseForm ──────────────────────────
function AddExerciseForm({
  type,
  onAdd,
  onCancel,
}: {
  type: Exercise['type']
  onAdd: (ex: Exercise) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [distance, setDistance] = useState('')
  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')
  const [restSec, setRestSec] = useState('')
  const [note, setNote] = useState('')

  const color = EXERCISE_TYPE_COLORS[type]
  const label = EXERCISE_TYPE_LABELS[type]

  function handleAdd() {
    if (!name.trim()) {
      Alert.alert('種目名を入力してください')
      return
    }
    const ex: Exercise = {
      id: uid(),
      name: name.trim(),
      type,
      distance: distance.trim() || undefined,
      sets: sets ? parseInt(sets, 10) : undefined,
      reps: reps ? parseInt(reps, 10) : undefined,
      restSec: restSec ? parseInt(restSec, 10) : undefined,
      note: note.trim() || undefined,
    }
    onAdd(ex)
  }

  return (
    <View style={afStyles.container}>
      <View style={afStyles.header}>
        <View style={[afStyles.badge, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[afStyles.badgeText, { color }]}>{label}</Text>
        </View>
        <TouchableOpacity onPress={onCancel}>
          <Ionicons name="close" size={20} color="#888" />
        </TouchableOpacity>
      </View>

      <TextInput
        style={afStyles.input}
        value={name}
        onChangeText={setName}
        placeholder="種目名（例: 60m走）"
        placeholderTextColor="#445577"
        returnKeyType="next"
      />
      <View style={afStyles.row2}>
        <TextInput
          style={[afStyles.input, { flex: 1 }]}
          value={distance}
          onChangeText={setDistance}
          placeholder="距離 (例: 100m)"
          placeholderTextColor="#445577"
        />
        <TextInput
          style={[afStyles.input, { flex: 1 }]}
          value={sets}
          onChangeText={setSets}
          placeholder="セット数"
          placeholderTextColor="#445577"
          keyboardType="number-pad"
        />
        <TextInput
          style={[afStyles.input, { flex: 1 }]}
          value={reps}
          onChangeText={setReps}
          placeholder="回数"
          placeholderTextColor="#445577"
          keyboardType="number-pad"
        />
      </View>
      <View style={afStyles.row2}>
        <TextInput
          style={[afStyles.input, { flex: 1 }]}
          value={restSec}
          onChangeText={setRestSec}
          placeholder="休憩(秒)"
          placeholderTextColor="#445577"
          keyboardType="number-pad"
        />
        <TextInput
          style={[afStyles.input, { flex: 2 }]}
          value={note}
          onChangeText={setNote}
          placeholder="メモ"
          placeholderTextColor="#445577"
        />
      </View>
      <TouchableOpacity style={[afStyles.addBtn, { backgroundColor: color }]} onPress={handleAdd}>
        <Ionicons name="add" size={16} color="#fff" />
        <Text style={afStyles.addBtnText}>{label}に追加</Text>
      </TouchableOpacity>
    </View>
  )
}

const afStyles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: '#fff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(74,159,255,0.25)',
  },
  row2: { flexDirection: 'row', gap: 6 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 8,
    paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
})

// ── メインコンポーネント ──────────────────────────────────────────
export default function WorkoutMenuScreen() {
  const [menus, setMenus] = useState<WorkoutMenu[]>([])
  const [filter, setFilter] = useState<'all' | WorkoutMenu['category']>('all')
  const [modalVisible, setModalVisible] = useState(false)
  const [templateModalVisible, setTemplateModalVisible] = useState(false)

  // フォーム状態
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<WorkoutMenu['category']>('sprint')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [rpe, setRpe] = useState(5)
  const [memo, setMemo] = useState('')
  const [addingType, setAddingType] = useState<Exercise['type'] | null>(null)

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(WORKOUT_MENUS_KEY)
      if (raw) setMenus(JSON.parse(raw) as WorkoutMenu[])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveMenus(updated: WorkoutMenu[]) {
    setMenus(updated)
    await AsyncStorage.setItem(WORKOUT_MENUS_KEY, JSON.stringify(updated)).catch(() => {})
  }

  function resetForm() {
    setTitle('')
    setCategory('sprint')
    setExercises([])
    setRpe(5)
    setMemo('')
    setAddingType(null)
  }

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('タイトルを入力してください')
      return
    }
    const newMenu: WorkoutMenu = {
      id: uid(),
      title: title.trim(),
      date: new Date().toISOString(),
      category,
      exercises,
      rpe,
      memo: memo.trim() || undefined,
      completed: false,
    }
    await saveMenus([newMenu, ...menus])
    Toast.show({ type: 'success', text1: '練習メニューを保存しました' })
    resetForm()
    setModalVisible(false)
  }

  async function handleToggleComplete(id: string) {
    const updated = menus.map(m => m.id === id ? { ...m, completed: !m.completed } : m)
    await saveMenus(updated)
  }

  async function handleDelete(id: string) {
    Alert.alert('削除', 'このメニューを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          const updated = menus.filter(m => m.id !== id)
          await saveMenus(updated)
          Toast.show({ type: 'success', text1: '削除しました' })
        },
      },
    ])
  }

  function applyTemplate(template: Template) {
    setTitle(template.label)
    setCategory(template.category)
    setExercises(template.exercises.map(ex => ({ ...ex, id: uid() })))
    setTemplateModalVisible(false)
  }

  const filtered = filter === 'all' ? menus : menus.filter(m => m.category === filter)
  const sortedExercises = [
    ...exercises.filter(e => e.type === 'warmup'),
    ...exercises.filter(e => e.type === 'main'),
    ...exercises.filter(e => e.type === 'cooldown'),
  ]

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={BG_GRADIENT} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>練習メニュー</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => { resetForm(); setModalVisible(true) }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* フィルターチップ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_OPTIONS.map(opt => {
            const catInfo = opt.key !== 'all' ? CATEGORIES.find(c => c.key === opt.key) : null
            const isActive = filter === opt.key
            const activeColor = catInfo?.color ?? BRAND
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.chip,
                  isActive && { backgroundColor: activeColor, borderColor: activeColor },
                ]}
                onPress={() => setFilter(opt.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, isActive && { color: '#fff' }]}>{opt.label}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* メニューリスト */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="barbell-outline" size={48} color="#333" />
              <Text style={styles.emptyText}>練習メニューがありません</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => { resetForm(); setModalVisible(true) }}>
                <Text style={styles.emptyBtnText}>メニューを作成する</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const catInfo = getCategoryInfo(item.category)
            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onLongPress={() => handleDelete(item.id)}
                style={[styles.card, item.completed && styles.cardCompleted]}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.catIcon, { backgroundColor: catInfo.color + '22' }]}>
                    <Ionicons name={catInfo.icon as any} size={18} color={catInfo.color} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardTitle, item.completed && styles.cardTitleCompleted]}>{item.title}</Text>
                    <View style={styles.cardMeta}>
                      <Ionicons name="calendar-outline" size={11} color="#555" />
                      <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
                      <Text style={styles.cardSep}>·</Text>
                      <Ionicons name="list-outline" size={11} color="#555" />
                      <Text style={styles.cardDate}>{item.exercises.length}種目</Text>
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    {item.rpe !== undefined && (
                      <View style={[styles.rpeBadge, { backgroundColor: getRpeColor(item.rpe) + '22', borderColor: getRpeColor(item.rpe) }]}>
                        <Text style={[styles.rpeText, { color: getRpeColor(item.rpe) }]}>RPE {item.rpe}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      onPress={() => handleToggleComplete(item.id)}
                      style={[styles.checkBtn, item.completed && { backgroundColor: BRAND }]}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={item.completed ? 'checkmark' : 'checkmark-outline'}
                        size={16}
                        color={item.completed ? '#fff' : '#555'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {item.exercises.length > 0 && (
                  <View style={styles.exPreview}>
                    {sortExercises(item.exercises).slice(0, 3).map((ex, idx) => {
                      const exColor = EXERCISE_TYPE_COLORS[ex.type]
                      return (
                        <View key={ex.id} style={styles.exTag}>
                          <View style={[styles.exDot, { backgroundColor: exColor }]} />
                          <Text style={styles.exTagText}>{ex.name}</Text>
                        </View>
                      )
                    })}
                    {item.exercises.length > 3 && (
                      <Text style={styles.exMore}>+{item.exercises.length - 3}</Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            )
          }}
        />

        {/* 作成モーダル */}
        <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalBg}>
            <SafeAreaView style={{ flex: 1 }}>
              <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                  {/* モーダルヘッダー */}
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                      <Text style={styles.cancelText}>キャンセル</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>メニュー作成</Text>
                    <TouchableOpacity onPress={handleSave}>
                      <Text style={styles.saveText}>保存</Text>
                    </TouchableOpacity>
                  </View>

                  {/* テンプレート */}
                  <TouchableOpacity
                    style={styles.templateBtn}
                    onPress={() => setTemplateModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="copy-outline" size={16} color={BRAND} />
                    <Text style={styles.templateBtnText}>テンプレートから選ぶ</Text>
                  </TouchableOpacity>

                  {/* タイトル */}
                  <Text style={styles.label}>タイトル</Text>
                  <TextInput
                    style={styles.input}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="例: 月曜スプリント練習"
                    placeholderTextColor="#445577"
                  />

                  {/* カテゴリ */}
                  <Text style={styles.label}>カテゴリ</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    <View style={styles.chipRow}>
                      {CATEGORIES.map(cat => (
                        <TouchableOpacity
                          key={cat.key}
                          style={[
                            styles.chip,
                            category === cat.key && { backgroundColor: cat.color, borderColor: cat.color },
                          ]}
                          onPress={() => setCategory(cat.key)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={cat.icon as any}
                            size={13}
                            color={category === cat.key ? '#fff' : '#888'}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.chipText, category === cat.key && { color: '#fff' }]}>
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  {/* エクササイズセクション */}
                  <Text style={styles.label}>エクササイズ</Text>

                  {/* 追加済みリスト */}
                  {sortedExercises.length > 0 && (
                    <View style={{ gap: 6, marginBottom: 10 }}>
                      {sortedExercises.map(ex => (
                        <ExerciseRow
                          key={ex.id}
                          exercise={ex}
                          onRemove={() => setExercises(prev => prev.filter(e => e.id !== ex.id))}
                        />
                      ))}
                    </View>
                  )}

                  {/* 追加フォーム */}
                  {addingType ? (
                    <AddExerciseForm
                      type={addingType}
                      onAdd={(ex) => {
                        setExercises(prev => [...prev, ex])
                        setAddingType(null)
                      }}
                      onCancel={() => setAddingType(null)}
                    />
                  ) : (
                    <View style={styles.addExRow}>
                      {(['warmup', 'main', 'cooldown'] as Exercise['type'][]).map(t => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.addExBtn, { borderColor: EXERCISE_TYPE_COLORS[t] }]}
                          onPress={() => setAddingType(t)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="add" size={14} color={EXERCISE_TYPE_COLORS[t]} />
                          <Text style={[styles.addExBtnText, { color: EXERCISE_TYPE_COLORS[t] }]}>
                            {EXERCISE_TYPE_LABELS[t]}追加
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* RPEスライダー */}
                  <Text style={[styles.label, { marginTop: 20 }]}>
                    RPE（運動強度）: <Text style={{ color: getRpeColor(rpe) }}>{rpe}</Text>/10
                  </Text>
                  <View style={styles.rpeSliderRow}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                      <TouchableOpacity
                        key={n}
                        style={styles.rpeSliderItem}
                        onPress={() => setRpe(n)}
                        activeOpacity={0.8}
                      >
                        <View style={[
                          styles.rpeCircle,
                          n <= rpe && { backgroundColor: getRpeColor(rpe), borderColor: getRpeColor(rpe) },
                        ]}>
                          {n <= rpe && <Text style={styles.rpeNum}>{n}</Text>}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.rpeLabelRow}>
                    <Text style={styles.rpeLabel}>楽</Text>
                    <Text style={styles.rpeLabel}>最大</Text>
                  </View>

                  {/* メモ */}
                  <Text style={[styles.label, { marginTop: 16 }]}>メモ（任意）</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={memo}
                    onChangeText={setMemo}
                    multiline
                    numberOfLines={3}
                    placeholder="今日の練習について..."
                    placeholderTextColor="#445577"
                  />
                </ScrollView>
              </KeyboardAvoidingView>
            </SafeAreaView>
          </View>
        </Modal>

        {/* テンプレート選択モーダル */}
        <Modal visible={templateModalVisible} animationType="fade" transparent>
          <View style={styles.overlayBg}>
            <View style={styles.templateModal}>
              <Text style={styles.templateModalTitle}>テンプレートを選択</Text>
              {TEMPLATES.map(tpl => {
                const catInfo = getCategoryInfo(tpl.category)
                return (
                  <TouchableOpacity
                    key={tpl.label}
                    style={styles.templateItem}
                    onPress={() => applyTemplate(tpl)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.catIcon, { backgroundColor: catInfo.color + '22' }]}>
                      <Ionicons name={catInfo.icon as any} size={16} color={catInfo.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.templateItemTitle}>{tpl.label}</Text>
                      <Text style={styles.templateItemSub}>{tpl.exercises.length}種目</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#555" />
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity style={styles.templateCancelBtn} onPress={() => setTemplateModalVisible(false)}>
                <Text style={styles.cancelText}>キャンセル</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  )
}

// ── ユーティリティ関数 ───────────────────────────────────────────
function getRpeColor(rpe: number): string {
  if (rpe <= 3) return '#4CAF50'
  if (rpe <= 6) return '#FF9800'
  return '#E53935'
}

function sortExercises(exs: Exercise[]): Exercise[] {
  return [
    ...exs.filter(e => e.type === 'warmup'),
    ...exs.filter(e => e.type === 'main'),
    ...exs.filter(e => e.type === 'cooldown'),
  ]
}

// ── スタイル ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterScroll: { maxHeight: 48 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
  listContent: { padding: 16, gap: 12, paddingBottom: 48 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    gap: 10,
  },
  cardCompleted: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: 4 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cardTitleCompleted: { textDecorationLine: 'line-through', color: '#666' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDate: { color: '#555', fontSize: 11 },
  cardSep: { color: '#333', fontSize: 11 },
  cardRight: { gap: 6, alignItems: 'flex-end' },
  rpeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  rpeText: { fontSize: 10, fontWeight: '700' },
  checkBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  exTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  exDot: { width: 5, height: 5, borderRadius: 2.5 },
  exTagText: { color: '#888', fontSize: 11 },
  exMore: { color: '#555', fontSize: 11, paddingVertical: 3 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#444', fontSize: 14 },
  emptyBtn: {
    backgroundColor: BRAND,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipText: { color: '#888', fontSize: 13, fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: 8 },
  // モーダル
  modalBg: { flex: 1, backgroundColor: '#0a0a0a' },
  modalContent: { padding: 20, paddingBottom: 48, gap: 4 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cancelText: { color: '#888', fontSize: 16 },
  saveText: { color: BRAND, fontSize: 16, fontWeight: '700' },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(229,57,53,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  templateBtnText: { color: BRAND, fontWeight: '600', fontSize: 14 },
  label: { color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(74,159,255,0.3)',
    marginBottom: 12,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  addExRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4, marginBottom: 4 },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  addExBtnText: { fontSize: 13, fontWeight: '600' },
  rpeSliderRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  rpeSliderItem: { flex: 1, alignItems: 'center' },
  rpeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpeNum: { color: '#fff', fontSize: 10, fontWeight: '700' },
  rpeLabelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  rpeLabel: { color: '#555', fontSize: 11 },
  // テンプレートモーダル
  overlayBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  templateModal: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 0,
  },
  templateModalTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  templateItemTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  templateItemSub: { color: '#555', fontSize: 12 },
  templateCancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
})
