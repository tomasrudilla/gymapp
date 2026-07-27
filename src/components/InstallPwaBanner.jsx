import { useEffect, useState } from 'react'

export default function InstallPwaBanner() {
  const [prompt, setPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (installed || !prompt) return null

  const instalar = async () => {
    await prompt.prompt()
    setPrompt(null)
  }

  return (
    <div className="mb-4 bg-blue-600/10 border border-blue-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1">
        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Instalar app</p>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
          Agregá GYM al inicio del celular (PWA)
        </p>
      </div>
      <button
        type="button"
        onClick={instalar}
        className="shrink-0 px-5 py-3 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest active:scale-95"
      >
        Instalar
      </button>
    </div>
  )
}
