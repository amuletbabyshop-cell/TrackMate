import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'trackmate_subscription'

export interface Subscription {
  isPremium: boolean
  plan: 'free' | 'premium'
  expiresAt?: string
}

export async function getSubscription(): Promise<Subscription> {
  const raw = await AsyncStorage.getItem(KEY)
  if (!raw) return { isPremium: false, plan: 'free' }
  return JSON.parse(raw)
}

export async function isPremium(): Promise<boolean> {
  const sub = await getSubscription()
  if (!sub.isPremium) return false
  if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
    await AsyncStorage.setItem(KEY, JSON.stringify({ isPremium: false, plan: 'free' }))
    return false
  }
  return true
}

// DEV ONLY — toggle premium for testing
export async function debugSetPremium(val: boolean) {
  await AsyncStorage.setItem(KEY, JSON.stringify({
    isPremium: val,
    plan: val ? 'premium' : 'free',
    expiresAt: val ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
  }))
}
