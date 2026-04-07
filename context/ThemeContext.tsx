// context/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const THEME_KEY = 'trackmate_theme'

export type ColorScheme = 'dark' | 'light'

export interface ThemeColors {
  bg:       string
  surface:  string
  surface2: string
  border:   string
  text:     string
  textSec:  string
  textHint: string
  card:     string
  inputBg:  string
  switchTrack: string
}

export const DARK: ThemeColors = {
  bg:       '#0a0a0a',
  surface:  '#111111',
  surface2: '#1a1a1a',
  border:   'rgba(255,255,255,0.08)',
  text:     '#ffffff',
  textSec:  '#888888',
  textHint: '#555555',
  card:     '#111111',
  inputBg:  'rgba(255,255,255,0.06)',
  switchTrack: '#333',
}

export const LIGHT: ThemeColors = {
  bg:       '#f2f2f7',
  surface:  '#ffffff',
  surface2: '#f0f0f5',
  border:   'rgba(0,0,0,0.08)',
  text:     '#111111',
  textSec:  '#555555',
  textHint: '#999999',
  card:     '#ffffff',
  inputBg:  'rgba(0,0,0,0.04)',
  switchTrack: '#ddd',
}

interface ThemeCtx {
  scheme: ColorScheme
  colors: ThemeColors
  toggle: () => void
}

const ThemeContext = createContext<ThemeCtx>({
  scheme: 'dark',
  colors: DARK,
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setScheme] = useState<ColorScheme>('dark')

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(v => {
      if (v === 'light' || v === 'dark') setScheme(v)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = scheme === 'dark' ? '#0a0a0a' : '#f2f2f7'
    }
  }, [scheme])

  function toggle() {
    const next = scheme === 'dark' ? 'light' : 'dark'
    setScheme(next)
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {})
  }

  return (
    <ThemeContext.Provider value={{ scheme, colors: scheme === 'dark' ? DARK : LIGHT, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
