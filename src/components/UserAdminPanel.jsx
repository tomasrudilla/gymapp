import { useState } from 'react'
import { supabase } from '../supabaseClient'
import {
  ensurePersonalizado,
  agregarDia,
  eliminarDia,
  usaRutinaPredefinida,
  isPersonalizado,
  parseDias,
  TODOS_LOS_DIAS,
} from '../lib/rutina'

const BUCKET = 'Ejercicios-GymApp'

export default function UserAdminPanel({
  userProfile,
  ejercicios,
  dias,
  diaActivo,
  setDiaActivo,
  onRefresh,
  onProfileUpdate,
}) {
  const [form, setForm] = useState({ nombre: '', num_series: 3 })
  const [editId, setEditId] = useState(null)
  const [imagenFile, setImagenFile] = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [modalEjercicio, setModalEjercicio] = useState(false)
  const [modalDia, setModalDia] = useState(null)
  const [musculosNuevoDia, setMusculosNuevoDia] = useState('')

  const misEjercicios = ejercicios.filter((e) => e.dia === diaActivo)
  const diaInfo = dias.find((d) => d.nombre === diaActivo)
  const diasFaltantes = TODOS_LOS_DIAS.filter((n) => !dias.some((d) => d.nombre === n))

  const showMsg = (text, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  const antesDeEditar = async () => {
    const r = await ensurePersonalizado(userProfile.id)
    if (!r.already) {
      onProfileUpdate(r.perfil)
      await onRefresh()
    }
    return r.perfil
  }

  const limpiarImagen = () => {
    setImagenFile(null)
    setImagenPreview(null)
  }

  const seleccionarImagen = (file) => {
    if (!file) return
    setImagenFile(file)
    setImagenPreview(URL.createObjectURL(file))
  }

  const subirImagen = async (file) => {
    if (!file) return null
    const path = `${userProfile.id}/${Date.now()}_${file.name.replace(/\s/g, '_')}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
    if (error) {
      showMsg('Error al subir imagen', false)
      return null
    }
    return path
  }

  const resetForm = () => {
    setForm({ nombre: '', num_series: 3 })
    setEditId(null)
    limpiarImagen()
  }

  const abrirNuevoEjercicio = () => {
    resetForm()
    setModalEjercicio(true)
  }

  const cerrarModalEjercicio = () => {
    setModalEjercicio(false)
    resetForm()
  }

  const resolverEjercicioId = async (ej) => {
    if (ej.perfil_id === userProfile.id) return ej.id
    const { data } = await supabase
      .from('ejercicios')
      .select('id')
      .eq('perfil_id', userProfile.id)
      .eq('nombre', ej.nombre)
      .eq('dia', ej.dia)
      .maybeSingle()
    return data?.id
  }

  const guardarEjercicio = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) return showMsg('Ingresá un nombre', false)

    await antesDeEditar()
    setUploading(true)
    let fotoPath = null
    if (imagenFile) {
      fotoPath = await subirImagen(imagenFile)
      if (!fotoPath) { setUploading(false); return }
    }

    const numSeries = Math.min(10, Math.max(1, parseInt(form.num_series) || 3))

    if (editId) {
      const payload = { nombre: form.nombre.trim(), dia: diaActivo, num_series: numSeries }
      if (fotoPath) payload.foto_url = fotoPath
      const { error } = await supabase.from('ejercicios').update(payload).eq('id', editId).eq('perfil_id', userProfile.id)
      setUploading(false)
      if (error) return showMsg(error.message, false)
      showMsg('Ejercicio actualizado')
    } else {
      const { error } = await supabase.from('ejercicios').insert({
        nombre: form.nombre.trim(),
        dia: diaActivo,
        num_series: numSeries,
        perfil_id: userProfile.id,
        foto_url: fotoPath || '',
      })
      setUploading(false)
      if (error) return showMsg(error.message, false)
      showMsg('Ejercicio creado')
    }
    cerrarModalEjercicio()
    onRefresh()
  }

  const editar = async (ej) => {
    await antesDeEditar()
    await onRefresh()
    const id = await resolverEjercicioId(ej)
    if (!id) return showMsg('No se encontró el ejercicio', false)
    setEditId(id)
    setForm({ nombre: ej.nombre, num_series: ej.num_series || 3 })
    limpiarImagen()
    if (ej.foto_url) setImagenPreview(fotoUrl(ej))
    setModalEjercicio(true)
  }

  const eliminar = async (ej) => {
    if (!confirm('¿Eliminar este ejercicio de tu rutina?')) return
    await antesDeEditar()
    await onRefresh()
    const id = await resolverEjercicioId(ej)
    if (!id) return
    await supabase.from('series').delete().eq('ejercicio_id', id).eq('perfil_id', userProfile.id)
    const { error } = await supabase.from('ejercicios').delete().eq('id', id).eq('perfil_id', userProfile.id)
    if (error) return showMsg(error.message, false)
    showMsg('Ejercicio eliminado')
    onRefresh()
  }

  const cambiarSeries = async (ej, delta) => {
    await antesDeEditar()
    await onRefresh()
    const id = await resolverEjercicioId(ej)
    if (!id) return
    const actual = ej.num_series || 3
    const nuevo = Math.min(10, Math.max(1, actual + delta))
    await supabase.from('ejercicios').update({ num_series: nuevo }).eq('id', id).eq('perfil_id', userProfile.id)
    onRefresh()
  }

  const cambiarFotoExistente = async (ej, file) => {
    if (!file) return
    await antesDeEditar()
    await onRefresh()
    const id = await resolverEjercicioId(ej)
    if (!id) return
    setUploading(true)
    const path = await subirImagen(file)
    if (path) {
      await supabase.from('ejercicios').update({ foto_url: path }).eq('id', id).eq('perfil_id', userProfile.id)
      showMsg('Foto actualizada')
      onRefresh()
    }
    setUploading(false)
  }

  const confirmarAgregarDia = async (e) => {
    e.preventDefault()
    if (!musculosNuevoDia.trim()) return showMsg('El grupo muscular es obligatorio', false)
    try {
      const perfil = await agregarDia(userProfile.id, userProfile, modalDia, musculosNuevoDia)
      onProfileUpdate(perfil)
      setDiaActivo(modalDia)
      setModalDia(null)
      setMusculosNuevoDia('')
      await onRefresh()
      showMsg(`${modalDia} agregado`)
    } catch (err) {
      showMsg(err.message, false)
    }
  }

  const handleEliminarDia = async () => {
    if (dias.length <= 1) return showMsg('Necesitás al menos un día', false)
    if (!confirm(`¿Eliminar ${diaActivo} y todos sus ejercicios?`)) return
    try {
      const perfil = await eliminarDia(userProfile.id, userProfile, diaActivo)
      onProfileUpdate(perfil)
      const restantes = parseDias(perfil, [])
      setDiaActivo(restantes[0]?.nombre || 'Lunes')
      await onRefresh()
      showMsg('Día eliminado')
    } catch (err) {
      showMsg(err.message, false)
    }
  }

  const fotoUrl = (ej) => {
    if (!ej.foto_url?.trim()) return null
    return supabase.storage.from(BUCKET).getPublicUrl(ej.foto_url.trim()).data.publicUrl
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] italic mb-2">Personalizar</p>
          <h2 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white leading-none">
            {diaActivo}
          </h2>
          {diaInfo?.musculos && (
            <p className="text-zinc-600 font-bold mt-3 uppercase text-[10px] tracking-[0.3em] italic">{diaInfo.musculos}</p>
          )}
          {usaRutinaPredefinida(userProfile) && (
            <p className="text-zinc-700 font-bold mt-2 uppercase text-[9px] tracking-widest">Rutina predefinida del gym</p>
          )}
        </div>
        <button
          type="button"
          onClick={abrirNuevoEjercicio}
          className="bg-amber-500 text-black font-black px-6 py-4 rounded-2xl uppercase text-[10px] tracking-widest active:scale-95 shadow-lg"
        >
          + Ejercicio
        </button>
      </header>

      {msg && (
        <div className={`p-4 rounded-2xl border text-center text-[10px] font-black uppercase tracking-widest ${msg.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
          {msg.text}
        </div>
      )}

      <div className="space-y-3">
        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">Tus días</p>
        <div className="flex flex-wrap gap-2">
          {dias.map((d) => (
            <button
              key={d.nombre}
              type="button"
              onClick={() => setDiaActivo(d.nombre)}
              className={`px-4 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${diaActivo === d.nombre ? 'bg-amber-500 text-black' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'}`}
            >
              {d.nombre}
            </button>
          ))}
        </div>
        {diasFaltantes.length > 0 && (
          <div className="pt-2">
            <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest mb-2 px-1">Agregar día</p>
            <div className="flex flex-wrap gap-2">
              {diasFaltantes.map((nombre) => (
                <button
                  key={nombre}
                  type="button"
                  onClick={() => { setModalDia(nombre); setMusculosNuevoDia('') }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase bg-zinc-950 text-zinc-500 border border-dashed border-zinc-700 hover:border-amber-500/50 hover:text-amber-500 transition-all"
                >
                  {nombre} <span className="text-amber-500 text-sm leading-none">+</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {isPersonalizado(userProfile) && dias.length > 1 && (
          <button type="button" onClick={handleEliminarDia} className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 px-1">
            Eliminar «{diaActivo}»
          </button>
        )}
      </div>

      <div className="space-y-5">
        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest italic px-2">
          {misEjercicios.length} ejercicio{misEjercicios.length !== 1 ? 's' : ''}
        </p>
        {misEjercicios.length === 0 ? (
          <div className="text-center py-16 bg-zinc-950/50 border border-zinc-900 rounded-[2.5rem]">
            <p className="font-black uppercase text-xs tracking-widest text-zinc-600 mb-4">Sin ejercicios en {diaActivo}</p>
            <button type="button" onClick={abrirNuevoEjercicio} className="text-amber-500 font-black uppercase text-[10px] tracking-widest">
              + Agregar ejercicio
            </button>
          </div>
        ) : (
          misEjercicios.map((ej) => {
            const url = fotoUrl(ej)
            return (
              <div key={ej.id} className="bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-6 md:p-8">
                <div className="flex gap-4 md:gap-6">
                  <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl overflow-hidden bg-zinc-900 shrink-0 border border-zinc-800 flex items-center justify-center">
                    {url ? (
                      <img src={url} alt={ej.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl text-zinc-700">📷</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl md:text-2xl font-black uppercase italic text-white truncate">{ej.nombre}</h3>
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-1">
                      {ej.num_series || 3} series
                    </p>
                    <label className="inline-block mt-3 cursor-pointer">
                      <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest border border-amber-500/30 px-4 py-2 rounded-xl hover:bg-amber-500/10">
                        {uploading ? 'Subiendo...' : url ? 'Cambiar foto' : 'Subir foto'}
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => cambiarFotoExistente(ej, e.target.files[0])} />
                    </label>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-6">
                  <button type="button" onClick={() => cambiarSeries(ej, -1)} className="w-10 h-10 bg-zinc-900 rounded-xl font-black text-zinc-400">−</button>
                  <span className="px-4 py-2 bg-zinc-900 rounded-xl text-[10px] font-black text-white uppercase">Series: {ej.num_series || 3}</span>
                  <button type="button" onClick={() => cambiarSeries(ej, 1)} className="w-10 h-10 bg-zinc-900 rounded-xl font-black text-zinc-400">+</button>
                  <button type="button" onClick={() => editar(ej)} className="ml-auto px-5 py-2 bg-zinc-900 rounded-xl text-[10px] font-black text-blue-500 uppercase">Editar</button>
                  <button type="button" onClick={() => eliminar(ej)} className="px-5 py-2 bg-red-950 border border-red-900/50 rounded-xl text-[10px] font-black text-red-500 uppercase">Eliminar</button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {modalEjercicio && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={cerrarModalEjercicio} />
          <form onSubmit={guardarEjercicio} className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 space-y-5 animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={cerrarModalEjercicio} className="absolute top-6 right-6 text-zinc-600 hover:text-white font-bold">✕</button>
            <div>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">
                {editId ? 'Editar ejercicio' : 'Nuevo ejercicio'}
              </p>
              <span className="text-[10px] font-black text-zinc-500 uppercase">{diaActivo}</span>
            </div>

            <label className="block cursor-pointer">
              <div className={`w-full h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden ${imagenPreview ? 'border-amber-500/50' : 'border-zinc-800'}`}>
                {imagenPreview ? (
                  <img src={imagenPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <span className="text-2xl mb-1">📷</span>
                    <span className="text-[10px] font-black text-zinc-500 uppercase">Cargar imagen</span>
                  </>
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => seleccionarImagen(e.target.files[0])} />
            </label>

            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Nombre del ejercicio"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 font-black text-white outline-none focus:border-amber-500"
              autoFocus
            />
            <div>
              <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-2">Series</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.num_series}
                onChange={(e) => setForm({ ...form, num_series: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 font-black text-white outline-none focus:border-amber-500 mt-2"
              />
            </div>
            <button type="submit" disabled={uploading} className="w-full bg-amber-500 text-black font-black py-5 rounded-2xl uppercase text-xs tracking-widest disabled:opacity-50">
              {uploading ? 'Guardando...' : editId ? 'Guardar cambios' : 'Agregar ejercicio'}
            </button>
          </form>
        </div>
      )}

      {modalDia && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setModalDia(null)} />
          <form onSubmit={confirmarAgregarDia} className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[2.5rem] p-8 space-y-5 animate-in zoom-in duration-200">
            <button type="button" onClick={() => setModalDia(null)} className="absolute top-6 right-6 text-zinc-600 hover:text-white font-bold">✕</button>
            <div>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Agregar día</p>
              <h3 className="text-3xl font-black italic uppercase text-white">{modalDia}</h3>
            </div>
            <div>
              <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-2">Grupo muscular *</label>
              <input
                type="text"
                value={musculosNuevoDia}
                onChange={(e) => setMusculosNuevoDia(e.target.value)}
                placeholder="Ej: Pecho y Tríceps"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 font-black text-white outline-none focus:border-amber-500 mt-2"
                required
                autoFocus
              />
            </div>
            <button type="submit" className="w-full bg-amber-500 text-black font-black py-5 rounded-2xl uppercase text-xs tracking-widest">
              Agregar {modalDia}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
