import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { CompetitionPlan } from '../types'

interface Props {
  competition: CompetitionPlan
  onPress?: () => void
}

/** Format milliseconds as M:SS.ss or SS.ss */
function formatTime(ms: number): string {
  const totalSeconds = ms / 1000
  if (totalSeconds >= 60) {
    const mins = Math.floor(totalSeconds / 60)
    const secs = (totalSeconds % 60).toFixed(2).padStart(5, '0')
    return `${mins}:${secs}`
  }
  return `${totalSeconds.toFixed(2)}s`
}

/** Compute progress (0–1) based on days_until and total weeks */
function getProgress(competition: CompetitionPlan): number {
  const totalWeeks = competition.phases.length
  if (totalWeeks === 0) return 0
  const totalDays = totalWeeks * 7
  const elapsed = totalDays - competition.days_until
  return Math.min(1, Math.max(0, elapsed / totalDays))
}

const CompetitionCountdown: React.FC<Props> = ({ competition, onPress }) => {
  const progress = getProgress(competition)
  const progressPct = Math.round(progress * 100)

  const daysUntil = competition.days_until
  const urgencyColor =
    daysUntil <= 7 ? '#FF3B30' : daysUntil <= 21 ? '#FF9500' : '#FF6B00'

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.competitionName} numberOfLines={1}>
            {competition.competition_name}
          </Text>
          <Text style={styles.eventLabel}>{competition.event}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.daysNumber, { color: urgencyColor }]}>
            {daysUntil}
          </Text>
          <Text style={styles.daysLabel}>日後</Text>
        </View>
      </View>

      {/* Target time */}
      <View style={styles.targetRow}>
        <Text style={styles.targetLabel}>目標タイム</Text>
        <Text style={styles.targetTime}>{formatTime(competition.target_time_ms)}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>準備進捗</Text>
          <Text style={styles.progressPct}>{progressPct}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPct}%` as `${number}%`, backgroundColor: urgencyColor },
            ]}
          />
        </View>
      </View>

      {/* Key advice snippet */}
      {competition.key_advice ? (
        <View style={styles.adviceRow}>
          <Text style={styles.adviceIcon}>💡</Text>
          <Text style={styles.adviceText} numberOfLines={2}>
            {competition.key_advice}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
    gap: 4,
  },
  competitionName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  eventLabel: {
    color: '#FF6B00',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(255,107,0,0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  daysNumber: {
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 52,
  },
  daysLabel: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '600',
    marginTop: -4,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  targetLabel: {
    color: '#888888',
    fontSize: 13,
  },
  targetTime: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  progressSection: {
    gap: 6,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: '#888888',
    fontSize: 12,
  },
  progressPct: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  adviceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 10,
  },
  adviceIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  adviceText: {
    color: '#AAAAAA',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
})

export default CompetitionCountdown
