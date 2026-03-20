// lib/homeScroll.ts — ホームタブ二度押しでスクロールトップ
let _scrollFn: (() => void) | null = null

export function registerHomeScroll(fn: () => void) {
  _scrollFn = fn
}

export function unregisterHomeScroll() {
  _scrollFn = null
}

export function triggerHomeScroll() {
  _scrollFn?.()
}
