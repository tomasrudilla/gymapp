import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'gym_theme_por_usuario'
const ThemeContext = createContext(null)

function readAllThemes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveThemeForUser(username, theme) {
  if (!username) return
  const all = readAllThemes()
  all[username] = theme
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function getThemeForUser(username) {
  if (!username) return 'dark'
  return readAllThemes()[username] || 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark')
  const [activeUser, setActiveUser] = useState(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const loadUserTheme = useCallback((username) => {
    const user = username?.trim()
    if (!user) {
      setActiveUser(null)
      setTheme('dark')
      return
    }
    setActiveUser(user)
    setTheme(getThemeForUser(user))
  }, [])

  const clearUserTheme = useCallback(() => {
    setActiveUser(null)
    setTheme('dark')
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      if (activeUser) saveThemeForUser(activeUser, next)
      return next
    })
  }, [activeUser])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, loadUserTheme, clearUserTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
