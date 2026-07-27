import { useState, useEffect } from 'react'
import { resetPassword } from '../lib/auth'

export default function ForgotPasswordModal({ open, onClose, defaultUsername = '' }) {
  const [user, setUser] = useState(defaultUsername)
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (open) {
      setUser(defaultUsername)
      setMsg(null)
    }
  }, [open, defaultUsername])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMsg(null)
    if (pass !== confirm) {
      setMsg({ ok: false, text: 'Las contraseñas no coinciden' })
      return
    }
    setLoading(true)
    const result = await resetPassword(user, pass)
    setLoading(false)
    if (result.ok) {
      setMsg({ ok: true, text: 'Contraseña actualizada. Ya podés ingresar.' })
      setPass('')
      setConfirm('')
    } else {
      setMsg({ ok: false, text: result.error })
    }
  }

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 md:p-10 space-y-5 animate-in zoom-in duration-200"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 text-zinc-600 hover:text-white font-bold"
        >
          ✕
        </button>

        <div>
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] italic mb-1">
            Recuperar acceso
          </p>
          <h3 className="text-3xl font-black italic uppercase text-white tracking-tighter">
            Olvidé mi contraseña
          </h3>
          <p className="text-zinc-600 font-bold text-[10px] uppercase tracking-widest mt-3">
            Ingresá tu usuario y una contraseña nueva (mínimo 4 caracteres). Se actualiza directo en la base de datos, sin email.
          </p>
        </div>

        {msg && (
          <div
            className={`p-4 rounded-2xl border text-center text-[10px] font-black uppercase tracking-widest ${msg.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}
          >
            {msg.text}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 italic">
            Usuario
          </label>
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="Tu usuario"
            required
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 font-black text-white outline-none focus:border-blue-600"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 italic">
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              required
              minLength={4}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 font-black text-white outline-none focus:border-blue-600"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-5 top-5 text-zinc-600 hover:text-white"
            >
              {showPass ? '✕' : '👁️'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 italic">
            Confirmar contraseña
          </label>
          <input
            type={showPass ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            minLength={4}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 font-black text-white outline-none focus:border-blue-600"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl uppercase text-xs tracking-widest disabled:opacity-50 active:scale-95"
        >
          {loading ? 'Guardando...' : 'Restablecer contraseña'}
        </button>
      </form>
    </div>
  )
}
