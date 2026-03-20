import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TEXT, BRAND } from '../lib/theme'

interface Props {
  date: string          // YYYY-MM-DD
  onChange: (d: string) => void
  maxDate?: string      // デフォルト: 今日
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatLabel(dateStr: string): string {
  const today    = new Date().toISOString().slice(0, 10)
  const yesterday = addDays(today, -1)
  if (dateStr === today)     return `今日  (${dateStr})`
  if (dateStr === yesterday) return `昨日  (${dateStr})`
  return dateStr
}

export default function DateSelector({ date, onChange, maxDate }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const max   = maxDate ?? today
  const canNext = date < max
  const canPrev = true   // 過去はどこまでも遡れる

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.arrow, !canPrev && styles.arrowDisabled]}
        onPress={() => canPrev && onChange(addDays(date, -1))}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={18} color={canPrev ? '#FFFFFF' : 'rgba(255,255,255,0.2)'} />
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={styles.label}>{formatLabel(date)}</Text>
      </View>

      <TouchableOpacity
        style={[styles.arrow, !canNext && styles.arrowDisabled]}
        onPress={() => canNext && onChange(addDays(date, 1))}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-forward" size={18} color={canNext ? '#FFFFFF' : 'rgba(255,255,255,0.2)'} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74,159,255,0.25)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  arrow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
})
