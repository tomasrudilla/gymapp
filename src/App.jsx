import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabaseClient'

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const DIAS_CONFIG = [
  { nombre: "Lunes", musculos: "Espalda y Bíceps" },
  { nombre: "Miércoles", musculos: "Pecho, Hombro y Tríceps" },
  { nombre: "Viernes", musculos: "Piernas" }
];

function App() {
  // --- ESTADOS DE SESIÓN ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [vistaActiva, setVistaActiva] = useState("entrenamiento"); 

  // --- ESTADOS DE DATOS ---
  const [ejercicios, setEjercicios] = useState([]);
  const [historial, setHistorial] = useState({});
  const [totalProgreso, setTotalProgreso] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fotoModal, setFotoModal] = useState({ open: false, url: '', nombre: '' });
  const [errorModal, setErrorModal] = useState({ open: false, mensaje: '' });

  // --- CONFIGURACIÓN DE SEMANAS DINÁMICAS ---
  const [configSemanas, setConfigSemanas] = useState(() => {
    const guardado = localStorage.getItem('gym_semanas_config');
    return guardado ? JSON.parse(guardado) : MESES.reduce((acc, mes) => ({ ...acc, [mes]: 4 }), {});
  });

  useEffect(() => {
    localStorage.setItem('gym_semanas_config', JSON.stringify(configSemanas));
  }, [configSemanas]);

  const hoy = new Date();
  const [mesActivo, setMesActivo] = useState(MESES[hoy.getMonth()]);
  const [semanaActiva, setSemanaActiva] = useState(1);
  const [diaActivo, setDiaActivo] = useState("Lunes");

  // Ajustar semana activa si se elimina la semana que estaba seleccionada
  useEffect(() => {
    if (semanaActiva > configSemanas[mesActivo]) {
      setSemanaActiva(configSemanas[mesActivo]);
    }
  }, [mesActivo, configSemanas]);

  // 1. CARGAR EJERCICIOS
  useEffect(() => {
    const fetchEjercicios = async () => {
      const { data } = await supabase.from('ejercicios').select('*');
      setEjercicios(data || []);
    };
    fetchEjercicios();
  }, []);

  // 2. CARGAR SERIES Y PROGRESO
  useEffect(() => {
    if (userProfile) {
      fetchSeries();
      fetchTodosLosDatos();
    }
  }, [userProfile, mesActivo, semanaActiva, diaActivo]);

  const fetchSeries = async () => {
    const { data } = await supabase.from('series').select('*')
      .eq('perfil_id', userProfile.id).eq('mes', mesActivo).eq('semana', semanaActiva);
    const mapeo = {};
    data?.forEach(s => {
      if (!mapeo[s.ejercicio_id]) mapeo[s.ejercicio_id] = Array(3).fill(null).map(() => ({ peso: "", reps: "", sobrado: false }));
      mapeo[s.ejercicio_id][s.nro_serie - 1] = { peso: s.peso, reps: s.reps, sobrado: s.sobrado };
    });
    setHistorial(mapeo);
  };

  const fetchTodosLosDatos = async () => {
    const { data } = await supabase.from('series').select('*').eq('perfil_id', userProfile.id);
    setTotalProgreso(data || []);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const { data } = await supabase.from('perfiles').select('*').eq('username', username).eq('password', password).single();
    if (data) { setUserProfile(data); setIsLoggedIn(true); } 
    else { setErrorModal({ open: true, mensaje: "Acceso denegado. Verificá tus datos." }); }
  };

  const manejarCambio = async (ejId, setIdx, campo, valor) => {
    const copia = { ...historial };
    if (!copia[ejId]) copia[ejId] = Array(3).fill(null).map(() => ({ peso: "", reps: "", sobrado: false }));
    copia[ejId][setIdx] = { ...copia[ejId][setIdx], [campo]: valor };
    setHistorial(copia);

    const s = copia[ejId][setIdx];
    await supabase.from('series').upsert({
      perfil_id: userProfile.id, ejercicio_id: ejId, mes: mesActivo, semana: semanaActiva,
      nro_serie: setIdx + 1, peso: parseFloat(s.peso) || 0, reps: parseInt(s.reps) || 0, sobrado: s.sobrado
    }, { onConflict: 'perfil_id, ejercicio_id, mes, semana, nro_serie' });
  };

  // --- PÁGINA DE PROGRESO ---
  const PaginaProgreso = () => {
    const calcularStats = (mes) => {
      const filtrados = totalProgreso.filter(s => s.mes === mes);
      const completados = new Set(filtrados.map(s => `${s.ejercicio_id}-${s.semana}`)).size;
      const totalObjetivo = ejercicios.length * configSemanas[mes]; 
      if (totalObjetivo === 0) return 0;
      return Math.min(Math.round((completados / totalObjetivo) * 100), 100);
    };

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h2 className="text-4xl md:text-6xl font-black italic uppercase mb-12 border-l-8 border-blue-600 pl-6 tracking-tighter text-white">PROGRESO</h2>
        <div className="space-y-6">
          {MESES.map(mes => {
            const porc = calcularStats(mes);
            if (porc === 0 && mes !== mesActivo) return null;
            return (
              <div key={mes} className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-xl">
                <div className="flex justify-between items-end mb-4">
                  <span className="text-2xl font-black italic uppercase tracking-tighter">{mes}</span>
                  <span className="text-4xl font-black text-blue-500">{porc}%</span>
                </div>
                <div className="w-full h-4 bg-zinc-950 rounded-full border border-zinc-800 overflow-hidden">
                  <div className="h-full bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all duration-1000" style={{ width: `${porc}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col md:flex-row overflow-x-hidden">
      
      {/* MODAL ERROR */}
      {errorModal.open && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 backdrop-blur-md">
          <div className="absolute inset-0 bg-black/60" onClick={() => setErrorModal({ ...errorModal, open: false })}></div>
          <div className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[3rem] p-10 text-center shadow-2xl">
            <h4 className="text-2xl font-black uppercase italic mb-4">ERROR</h4>
            <p className="text-zinc-500 font-bold text-sm mb-8">{errorModal.mensaje}</p>
            <button onClick={() => setErrorModal({ ...errorModal, open: false })} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl uppercase">Entendido</button>
          </div>
        </div>
      )}

      {!isLoggedIn ? (
        <div className="min-h-screen w-full bg-black flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-[3.5rem] p-10 shadow-2xl text-center">
            <h1 className="text-8xl font-black italic uppercase mb-12 tracking-tighter text-white">GYM</h1>
            <form onSubmit={handleLogin} className="space-y-5 text-left">
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario" className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-3xl p-6 font-black outline-none focus:border-blue-600 text-white text-lg" />
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-3xl p-6 font-black outline-none focus:border-blue-600 text-white text-lg" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-7 text-zinc-600">
                  {showPassword ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>}
                </button>
              </div>
              <button type="submit" className="w-full bg-white text-black font-black py-6 rounded-3xl uppercase tracking-widest text-sm active:scale-95 transition-all mt-4">Entrar</button>
            </form>
          </div>
        </div>
      ) : (
        <>
          {/* FOTO MODAL */}
          {fotoModal.open && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/98 backdrop-blur-xl" onClick={() => setFotoModal({ ...fotoModal, open: false })}></div>
              <div className="relative w-full max-w-lg bg-zinc-900 rounded-[3.5rem] overflow-hidden border border-zinc-800 animate-in zoom-in duration-300">
                <button onClick={() => setFotoModal({ ...fotoModal, open: false })} className="absolute top-8 right-8 z-10 w-12 h-12 bg-black/50 text-white rounded-full font-bold flex items-center justify-center border border-zinc-700 shadow-xl">✕</button>
                <img src={fotoModal.url} alt={fotoModal.nombre} className="w-full h-96 object-cover" />
                <div className="p-10 text-center uppercase font-black italic text-3xl">{fotoModal.nombre}</div>
              </div>
            </div>
          )}

          <aside className="hidden md:flex w-80 bg-zinc-950 border-r border-zinc-900 h-screen sticky top-0 flex-col p-8 overflow-y-auto scrollbar-hide">
            <h1 className="text-5xl font-black italic uppercase text-white mb-12 tracking-tighter">GYM</h1>
            <NavigationContent username={username} mesActivo={mesActivo} setMesActivo={setMesActivo} configSemanas={configSemanas} setConfigSemanas={setConfigSemanas} semanaActiva={semanaActiva} setSemanaActiva={setSemanaActiva} diaActivo={diaActivo} setDiaActivo={setDiaActivo} setIsLoggedIn={setIsLoggedIn} setMenuOpen={setMenuOpen} vistaActiva={vistaActiva} setVistaActiva={setVistaActiva} />
          </aside>

          <header className="md:hidden fixed top-0 left-0 right-0 h-24 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 z-[60] px-6 flex items-center justify-between">
            <button onClick={() => setMenuOpen(true)} className="p-2 text-white"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button>
            <div className="text-center">
              <h1 className="text-2xl font-black italic text-white leading-none uppercase tracking-tighter">GYM</h1>
              <p className="text-[10px] font-black text-blue-500 uppercase mt-2">{mesActivo} • SEM {semanaActiva}</p>
            </div>
            <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center font-black text-2xl text-white uppercase">{username[0]}</div>
          </header>

          <div className={`md:hidden fixed inset-0 z-[100] transition-all duration-500 ${menuOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setMenuOpen(false)}></div>
            <aside className={`absolute top-0 left-0 bottom-0 w-[88%] bg-zinc-950 border-r border-zinc-900 p-8 transition-transform duration-500 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
              <div className="flex justify-between items-center mb-10"><h2 className="text-3xl font-black italic uppercase text-white">MENU</h2><button onClick={() => setMenuOpen(false)} className="p-3 bg-zinc-900 rounded-2xl text-zinc-400 font-bold">✕</button></div>
              <NavigationContent username={username} mesActivo={mesActivo} setMesActivo={setMesActivo} configSemanas={configSemanas} setConfigSemanas={setConfigSemanas} semanaActiva={semanaActiva} setSemanaActiva={setSemanaActiva} diaActivo={diaActivo} setDiaActivo={setDiaActivo} setIsLoggedIn={setIsLoggedIn} setMenuOpen={setMenuOpen} vistaActiva={vistaActiva} setVistaActiva={setVistaActiva} />
            </aside>
          </div>

          <main className="flex-1 pt-32 md:pt-14 pb-20 px-4 md:px-16 max-w-5xl mx-auto w-full">
            {vistaActiva === 'entrenamiento' ? (
              <>
                <header className="mb-12 md:mb-20 px-2 animate-in fade-in duration-500">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest italic">{mesActivo}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-800"></div>
                    <span className="text-[11px] font-black text-zinc-700 uppercase tracking-widest italic">Semana {semanaActiva}</span>
                  </div>
                  <h2 className="text-5xl md:text-9xl font-black italic uppercase border-l-[15px] border-blue-600 pl-8 leading-none text-white tracking-tighter break-words">{diaActivo}</h2>
                  <p className="text-zinc-600 font-bold mt-6 uppercase text-xs md:text-sm tracking-[0.4em] italic leading-none ml-2">{DIAS_CONFIG.find(d => d.nombre === diaActivo)?.musculos}</p>
                </header>
                <div className="space-y-16 md:space-y-24">
                  {ejercicios
                    .filter(e => e.dia === diaActivo)
                    // MAGIA DE ORDENAMIENTO ACÁ 👇
                    .sort((a, b) => {
                      const obtenerOrden = (ej) => {
                        // Limpiamos el nombre de tildes y lo pasamos a mayúscula para que no falle si lo escribiste distinto
                        const n = ej.nombre.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        
                        if (ej.dia === "Lunes") {
                          if (n.includes("REMO")) return 1;
                          if (n.includes("MAQUINA T")) return 2;
                          if (n.includes("DORSALERA")) return 3;
                          if (n.includes("CURL")) return 4;
                          if (n.includes("MARTILLO")) return 5;
                        }
                        
                        if (ej.dia === "Miércoles") {
                          if (n.includes("INCLINADO")) return 1;
                          if (n.includes("PRESS MAQUINA")) return 2;
                          if (n.includes("LATERAL")) return 3;
                          if (n.includes("TRICEPS") || n.includes("POLEA")) return 4;
                          if (n.includes("FRONTAL")) return 5;
                        }
                        
                        return 99; // Todo lo demás (y el Viernes) va al final de la lista
                      };
                      return obtenerOrden(a) - obtenerOrden(b);
                    })
                    // --------------------------------
                    .map((ej) => (
                    <section key={ej.id} className="relative group">
                      <div className="flex items-center justify-between mb-8 px-2">
                        <h3 className="text-2xl md:text-4xl font-black text-white uppercase italic tracking-tighter leading-tight max-w-[70%] group-hover:text-blue-500 transition-colors">{ej.nombre}</h3>
                        
                        <button onClick={() => {
                          const archivoLimpio = ej.foto_url.trim(); 
                          const urlPublica = supabase.storage.from('Ejercicios-GymApp').getPublicUrl(archivoLimpio).data.publicUrl;
                          
                          setFotoModal({ open: true, url: urlPublica, nombre: ej.nombre });
                        }} className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-blue-500 border border-zinc-800 shadow-xl transition-all active:scale-90 shrink-0">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                        
                      </div>
                      <div className="bg-zinc-950/50 rounded-[4rem] border border-zinc-900 p-6 md:p-12 shadow-2xl backdrop-blur-sm">
                        <div className="grid grid-cols-[0.5fr_1.4fr_1.4fr_0.7fr] gap-4 text-[12px] md:text-[14px] font-black text-zinc-500 uppercase tracking-widest text-center mb-10 opacity-100 italic">
                          <span>Series</span><span>KG</span><span>Reps</span><span className="text-emerald-500 tracking-tighter">Sobrado</span>
                        </div>
                        <div className="space-y-4 md:space-y-10">
                          {[0, 1, 2].map((idx) => {
                            const serie = historial[ej.id]?.[idx] || { peso: "", reps: "", sobrado: false };
                            return (
                              <div key={idx} className="grid grid-cols-[0.5fr_1.4fr_1.4fr_0.7fr] gap-3 md:gap-10 items-center">
                                <div className="text-3xl md:text-7xl font-black italic text-zinc-900 text-center leading-none tracking-tighter select-none">0{idx + 1}</div>
                                <input type="number" value={serie.peso} onChange={(e) => manejarCambio(ej.id, idx, 'peso', e.target.value)} placeholder="0" className="bg-zinc-900 border-2 border-zinc-800 rounded-3xl py-10 md:py-16 text-center text-4xl md:text-7xl font-black text-blue-500 outline-none focus:border-blue-600 transition-all w-full leading-none shadow-inner" />
                                <input type="number" value={serie.reps} onChange={(e) => manejarCambio(ej.id, idx, 'reps', e.target.value)} placeholder="0" className="bg-zinc-900 border-2 border-zinc-800 rounded-3xl py-10 md:py-16 text-center text-4xl md:text-7xl font-black text-white outline-none focus:border-blue-600 transition-all w-full leading-none shadow-inner" />
                                <div className="flex justify-center">
                                  <button onClick={() => manejarCambio(ej.id, idx, 'sobrado', !serie.sobrado)} className={`w-14 h-14 md:w-28 md:h-28 rounded-[1.5rem] md:rounded-[3rem] flex items-center justify-center border-2 transition-all duration-500 active:scale-90 ${serie.sobrado ? 'bg-emerald-500 border-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'border-zinc-800 text-zinc-900'}`}>
                                    <span className="text-xl md:text-5xl font-bold leading-none">{serie.sobrado ? '💪' : '✓'}</span>
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              </>
            ) : (
              <PaginaProgreso />
            )}
          </main>
        </>
      )}
    </div>
  )
}

const NavigationContent = ({ username, mesActivo, setMesActivo, configSemanas, setConfigSemanas, semanaActiva, setSemanaActiva, diaActivo, setDiaActivo, setIsLoggedIn, setMenuOpen, vistaActiva, setVistaActiva }) => {
  
  const ajustarSemanas = (accion) => {
    setConfigSemanas(prev => {
      const actual = prev[mesActivo];
      if (accion === 'mas' && actual < 6) return { ...prev, [mesActivo]: actual + 1 };
      if (accion === 'menos' && actual > 1) return { ...prev, [mesActivo]: actual - 1 };
      return prev;
    });
  };

  return (
    <div className="space-y-10">
      {/* PERFIL (NOMBRE COMPLETO) */}
      <div className="flex items-center gap-5 p-6 bg-zinc-900 rounded-[2.5rem] border border-zinc-800 shadow-xl overflow-visible">
         <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center font-black text-3xl text-white uppercase shrink-0">{username[0]}</div>
         <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none mb-1.5">Atleta</p>
            <p className="text-xl font-black italic text-white uppercase leading-tight break-words">{username}</p>
         </div>
      </div>

      <div className="grid grid-cols-2 p-1.5 bg-zinc-950 rounded-3xl border border-zinc-900">
        <button onClick={() => { setVistaActiva('entrenamiento'); setMenuOpen(false); }} className={`py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${vistaActiva === 'entrenamiento' ? 'bg-zinc-900 text-white shadow-xl' : 'text-zinc-600'}`}>Rutina</button>
        <button onClick={() => { setVistaActiva('progreso'); setMenuOpen(false); }} className={`py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${vistaActiva === 'progreso' ? 'bg-zinc-900 text-white shadow-xl' : 'text-zinc-600'}`}>Progreso</button>
      </div>

      {vistaActiva === 'entrenamiento' ? (
        <>
          <section className="space-y-4">
            <select value={mesActivo} onChange={(e) => setMesActivo(e.target.value)} className="w-full bg-zinc-900 p-6 rounded-3xl font-black border border-zinc-800 text-white appearance-none text-center text-xs uppercase tracking-widest cursor-pointer">
              {MESES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between px-3">
                <label className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">Semanas</label>
                <div className="flex gap-2">
                  <button onClick={() => ajustarSemanas('menos')} className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-400 font-bold hover:bg-zinc-800 active:scale-90">-</button>
                  <button onClick={() => ajustarSemanas('mas')} className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-400 font-bold hover:bg-zinc-800 active:scale-90">+</button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: configSemanas[mesActivo] }).map((_, i) => (
                  <button key={i+1} onClick={() => setSemanaActiva(i+1)} className={`py-5 rounded-2xl font-black text-sm transition-all ${semanaActiva === i+1 ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-zinc-900 text-zinc-500'}`}>{i+1}</button>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            {DIAS_CONFIG.map(d => (
              <button key={d.nombre} onClick={() => { setDiaActivo(d.nombre); setMenuOpen(false); }} className={`w-full text-left p-6 rounded-[2.5rem] font-black transition-all ${diaActivo === d.nombre ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/30' : 'bg-zinc-900 text-zinc-600 border border-zinc-900/50'}`}>
                <span className="text-xl italic uppercase block leading-none">{d.nombre}</span>
                <span className={`text-[10px] font-bold uppercase mt-2 block tracking-tighter ${diaActivo === d.nombre ? 'text-white/60' : 'text-zinc-700'}`}>{d.musculos}</span>
              </button>
            ))}
          </section>
        </>
      ) : (
        <div className="bg-blue-600/5 p-8 rounded-[2.5rem] border border-blue-600/20 text-center">
          <p className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] leading-relaxed">Analizando tus objetivos mensuales en base a {configSemanas[mesActivo]} semanas.</p>
        </div>
      )}

      <button onClick={() => setIsLoggedIn(false)} className="w-full p-6 bg-zinc-950 text-zinc-700 font-black rounded-[2.5rem] border border-zinc-900 uppercase text-[10px] tracking-widest active:scale-95 transition-all hover:text-red-500">Salir</button>
    </div>
  );
};

export default App;