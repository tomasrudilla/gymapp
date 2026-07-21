import { useTheme } from '../lib/theme'

function SunIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" />
      <g stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
        <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
        <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
        <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
        <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
      </g>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5Z"
        fill="#6366f1"
        stroke="#4f46e5"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Activar modo oscuro' : 'Activar modo claro'}
      title={isLight ? 'Modo oscuro' : 'Modo claro'}
      className={`flex items-center justify-center w-12 h-12 rounded-2xl border transition-all active:scale-95 ${isLight ? 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100' : 'bg-zinc-900 border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-800'} ${className}`}
    >
      {isLight ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}
