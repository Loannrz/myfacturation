'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void; toggle: () => void } | null>(null)

const STORAGE_KEY = 'myfacturation360-theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'dark' || stored === 'light') setThemeState(stored)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme, mounted])

  const setTheme = (t: Theme) => setThemeState(t)
  const toggle = () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  return ctx ?? { theme: 'light' as Theme, setTheme: () => {}, toggle: () => {} }
}
