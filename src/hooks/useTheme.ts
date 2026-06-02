import { useState, useEffect } from 'react'

export const ACCENTS = ['#5ca800', '#1ba1e2', '#a4c400', '#d80073', '#fa6800', '#6a00ff']

export type ThemeMode = 'dark' | 'light'

const LS_ACCENT = 'zp_accent'
const LS_MODE   = 'zp_mode'

export function useTheme() {
  const [accent, setAccentState] = useState<string>(() => {
    const v = localStorage.getItem(LS_ACCENT)
    return ACCENTS.includes(v ?? '') ? v! : '#5ca800'
  })

  const [mode, setModeState] = useState<ThemeMode>(() =>
    localStorage.getItem(LS_MODE) === 'light' ? 'light' : 'dark'
  )

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
  }, [accent])

  const setAccent = (v: string) => { setAccentState(v); localStorage.setItem(LS_ACCENT, v) }
  const setMode   = (v: ThemeMode) => { setModeState(v); localStorage.setItem(LS_MODE, v) }

  return { accent, mode, setAccent, setMode }
}
