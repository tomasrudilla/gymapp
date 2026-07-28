import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabaseClient'
import MasterAdminPanel from './components/MasterAdminPanel'
import UserAdminPanel from './components/UserAdminPanel'
import ThemeToggle from './components/ThemeToggle'
import LogoutButton from './components/LogoutButton'
import ForgotPasswordModal from './components/ForgotPasswordModal'
import AlertasBanner from './components/AlertasBanner'
import PushEnableBanner from './components/PushEnableBanner'
import InstallPwaBanner from './components/InstallPwaBanner'
import { parseDias, fetchEjerciciosRutina, DIAS_DEFAULT, usaRutinaPredefinida, isPersonalizado } from './lib/rutina'
import { updateUltimoLogin } from './lib/auth'
import { useTheme } from './lib/theme'

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA_CORTOS = ["L", "M", "M", "J", "V", "S", "D"];

function App() {
  const { loadUserTheme, clearUserTheme } = useTheme();
  // --- ESTADOS DE SESIÓN Y VISTA ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [loginModo, setLoginModo] = useState('usuario');
  const [isMasterUsername, setIsMasterUsername] = useState(false);
  const [vistaActiva, setVistaActiva] = useState("entrenamiento");

  const isMaster = userProfile?.role === 'master';

  // --- ESTADOS DE DATOS ---
  const [ejercicios, setEjercicios] = useState([]);
  const [historial, setHistorial] = useState({});
  const [totalProgreso, setTotalProgreso] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // --- MODALES ---
  const [fotoModal, setFotoModal] = useState({ open: false, url: '', nombre: '' });
  const [infoModal, setInfoModal] = useState({ open: false, data: [], nombre: '', mes: '', semana: '' });
  const [errorModal, setErrorModal] = useState({ open: false, mensaje: '' });
  const [resumenDiaModal, setResumenDiaModal] = useState({ open: false, data: [], fecha: '' });

  // --- CONFIGURACIÓN DE SEMANAS ---
  const [configSemanas, setConfigSemanas] = useState(() => {
    const guardado = localStorage.getItem('gym_semanas_config');
    return guardado ? JSON.parse(guardado) : MESES.reduce((acc, mes) => ({ ...acc, [mes]: 4 }), {});
  });

  useEffect(() => {
    localStorage.setItem('gym_semanas_config', JSON.stringify(configSemanas));
  }, [configSemanas]);

  const hoyReal = new Date(); 
  const [mesActivo, setMesActivo] = useState(MESES[hoyReal.getMonth()]);
  const [semanaActiva, setSemanaActiva] = useState(1);
  const [diaActivo, setDiaActivo] = useState("Lunes");

  // Widget de Bienvenida (Lógica de día real)
  const diasRutina = useMemo(() => parseDias(userProfile, ejercicios), [userProfile, ejercicios]);

  const widgetEntrenamiento = useMemo(() => {
    const diaIndex = hoyReal.getDay();
    const nombresDias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const hoyNombre = nombresDias[diaIndex];
    const dias = userProfile ? diasRutina : DIAS_DEFAULT;
    const config = dias.find(d => d.nombre === hoyNombre);
    return config ? `Hoy: ${config.musculos || config.nombre}` : "Hoy: Descanso";
  }, [userProfile, diasRutina]);

  useEffect(() => {
    if (semanaActiva > configSemanas[mesActivo]) setSemanaActiva(configSemanas[mesActivo]);
  }, [mesActivo, configSemanas]);

  const cargarEjercicios = useCallback(async () => {
    if (!userProfile) { setEjercicios([]); return; }
    const data = await fetchEjerciciosRutina(userProfile.id, isPersonalizado(userProfile));
    setEjercicios(data);
  }, [userProfile]);

  const ejerciciosVisibles = ejercicios;

  useEffect(() => {
    if (!userProfile) return;
    setDiaActivo((actual) => (diasRutina.some((d) => d.nombre === actual) ? actual : diasRutina[0]?.nombre || 'Lunes'));
  }, [userProfile, diasRutina]);

  const getNumSeries = (ejId) => {
    const ej = ejerciciosVisibles.find((e) => e.id === ejId);
    return ej?.num_series || 3;
  };

  useEffect(() => {
    if (userProfile) cargarEjercicios();
  }, [userProfile, cargarEjercicios]);

  const handleProfileUpdate = (perfil) => setUserProfile(perfil);

  useEffect(() => {
    if (userProfile) {
      fetchSeries();
      fetchTodosLosDatos();
    }
  }, [userProfile, mesActivo, semanaActiva, diaActivo, ejerciciosVisibles]);

  const fetchSeries = async () => {
    const { data } = await supabase.from('series').select('*')
      .eq('perfil_id', userProfile.id).eq('mes', mesActivo).eq('semana', semanaActiva);
    const mapeo = {};
    data?.forEach(s => {
      const count = getNumSeries(s.ejercicio_id);
      if (!mapeo[s.ejercicio_id]) mapeo[s.ejercicio_id] = Array(count).fill(null).map(() => ({ peso: "", reps: "", sobrado: false }));
      if (s.nro_serie - 1 < mapeo[s.ejercicio_id].length) {
        mapeo[s.ejercicio_id][s.nro_serie - 1] = { peso: s.peso, reps: s.reps, sobrado: s.sobrado };
      }
    });
    setHistorial(mapeo);
  };

  const fetchTodosLosDatos = async () => {
    const { data } = await supabase.from('series').select('*, ejercicios(nombre)').eq('perfil_id', userProfile.id);
    setTotalProgreso(data || []);
  };

  const abrirInfoSemanAnterior = (ej) => {
    let prevMes = mesActivo;
    let prevSemana = semanaActiva - 1;
    if (semanaActiva === 1) {
      const mesIdx = MESES.indexOf(mesActivo);
      const prevMesIdx = (mesIdx - 1 + 12) % 12;
      prevMes = MESES[prevMesIdx];
      prevSemana = configSemanas[prevMes];
    }
    const dataAnterior = totalProgreso
      .filter(s => s.ejercicio_id === ej.id && s.mes === prevMes && s.semana === prevSemana)
      .sort((a, b) => a.nro_serie - b.nro_serie);
    setInfoModal({ open: true, data: dataAnterior, nombre: ej.nombre, mes: prevMes, semana: prevSemana });
  };

  useEffect(() => {
    if (!isLoggedIn) loadUserTheme(username);
  }, [username, isLoggedIn, loadUserTheme]);

  useEffect(() => {
    const user = username.trim();
    if (!user) {
      setIsMasterUsername(false);
      setLoginModo('usuario');
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('perfiles').select('role').eq('username', user).maybeSingle();
      const esMaster = data?.role === 'master';
      setIsMasterUsername(esMaster);
      if (!esMaster) setLoginModo('usuario');
    }, 350);
    return () => clearTimeout(timer);
  }, [username]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const { data } = await supabase.from('perfiles').select('*').eq('username', username).eq('password', password).single();
    if (data) {
      await updateUltimoLogin(data.id);
      loadUserTheme(data.username);
      setUserProfile(data);
      setIsLoggedIn(true);
      const entrarComoMaster = data.role === 'master' && loginModo === 'master';
      setVistaActiva(entrarComoMaster ? 'master' : 'entrenamiento');
    } else { setErrorModal({ open: true, mensaje: "USUARIO O CLAVE INVÁLIDOS" }); }
  };

  const handleLogout = () => {
    clearUserTheme();
    setIsLoggedIn(false);
    setUserProfile(null);
    setEjercicios([]);
    setVistaActiva('entrenamiento');
    setLoginModo('usuario');
    setIsMasterUsername(false);
  };

  const getFotoUrl = (ej) => {
    if (!ej.foto_url?.trim()) return null;
    return supabase.storage.from('Ejercicios-GymApp').getPublicUrl(ej.foto_url.trim()).data.publicUrl;
  };

  const manejarCambio = async (ejId, setIdx, campo, valor) => {
    const copia = { ...historial };
    const count = getNumSeries(ejId);
    if (!copia[ejId]) copia[ejId] = Array(count).fill(null).map(() => ({ peso: "", reps: "", sobrado: false }));
    copia[ejId][setIdx] = { ...copia[ejId][setIdx], [campo]: valor };
    setHistorial(copia);
    const s = copia[ejId][setIdx];
    await supabase.from('series').upsert({
      perfil_id: userProfile.id, ejercicio_id: ejId, mes: mesActivo, semana: semanaActiva,
      nro_serie: setIdx + 1, peso: parseFloat(s.peso) || 0, reps: parseInt(s.reps) || 0, sobrado: s.sobrado
    }, { onConflict: 'perfil_id, ejercicio_id, mes, semana, nro_serie' });
  };

  const PaginaCalendario = () => {
    const mesIndex = MESES.indexOf(mesActivo);
    const statsMes = useMemo(() => {
      const dataMes = totalProgreso.filter(s => s.mes === mesActivo);
      const vol = dataMes.reduce((acc, s) => acc + (Number(s.peso) * Number(s.reps)), 0);
      const totalSets = dataMes.length;
      const sobradoSets = dataMes.filter(s => s.sobrado).length;
      const porcIntensidad = totalSets > 0 ? Math.round((sobradoSets / totalSets) * 100) : 0;
      const prs = {};
      totalProgreso.forEach(s => {
        if (!prs[s.ejercicio_id] || Number(s.peso) > prs[s.ejercicio_id].peso) {
          prs[s.ejercicio_id] = { peso: Number(s.peso), nombre: s.ejercicios?.nombre };
        }
      });
      return { vol, porcIntensidad, topPRs: Object.values(prs).sort((a, b) => b.peso - a.peso).slice(0, 3) };
    }, [totalProgreso, mesActivo]);

    return (
      <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 space-y-12">
        <header>
          <h2 className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter leading-none mb-4 text-white">PROGRESO</h2>
          <p className="text-blue-500 font-black uppercase text-xs tracking-[0.3em] italic leading-none ml-2">{mesActivo} 2026</p>
        </header>

        {/* CALENDARIO */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-[3.5rem] p-6 md:p-10 shadow-2xl">
          <div className="grid grid-cols-7 gap-2 md:gap-4 mb-8">
            {DIAS_SEMANA_CORTOS.map(d => <div key={d} className="text-center text-[10px] font-black text-zinc-700 uppercase tracking-widest">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2 md:gap-4">
            {Array.from({ length: 35 }).map((_, idx) => {
              const startDay = new Date(2026, mesIndex, 1).getDay();
              const adjustedStart = startDay === 0 ? 6 : startDay - 1;
              const dia = idx - adjustedStart + 1;
              if (dia <= 0 || dia > new Date(2026, mesIndex + 1, 0).getDate()) return <div key={idx}></div>;
              const entrenado = totalProgreso.some(s => {
                const f = new Date(s.created_at);
                return f.getDate() === dia && f.getMonth() === mesIndex;
              });
              const esHoy = dia === hoyReal.getDate() && mesIndex === hoyReal.getMonth();
              return (
                <div key={idx} className="relative aspect-square">
                  <div className={`w-full h-full rounded-2xl md:rounded-3xl flex items-center justify-center text-lg md:text-2xl font-black italic transition-all ${esHoy ? 'bg-white text-black scale-105 shadow-xl' : entrenado ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-700'}`}>
                    {dia}
                  </div>
                  {entrenado && (
                    <button onClick={() => {
                      const dataDia = totalProgreso.filter(s => {
                        const f = new Date(s.created_at);
                        return f.getDate() === dia && f.getMonth() === mesIndex;
                      });
                      setResumenDiaModal({ open: true, data: dataDia, fecha: `${dia} de ${mesActivo}` });
                    }} className="absolute -top-1 -right-1 w-6 h-6 md:w-8 md:h-8 bg-black border border-blue-500 rounded-full flex items-center justify-center text-[10px] md:text-xs shadow-lg active:scale-75 transition-transform">👁️</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* TARJETAS DE MÉTRICAS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
           <div className="bg-zinc-900/50 border border-zinc-900 rounded-[2.5rem] p-8">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 italic">Volumen del Mes</p>
              <div className="flex items-baseline gap-2">
                 <span className="text-6xl font-black italic text-white tracking-tighter">{statsMes.vol.toLocaleString()}</span>
                 <span className="text-xl font-black text-blue-600 italic uppercase tracking-tighter">KG</span>
              </div>
           </div>
           <div className="bg-zinc-900/50 border border-zinc-900 rounded-[2.5rem] p-8">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 italic">Análisis de Intensidad</p>
              <div className="flex justify-between items-end mb-3">
                 <span className="text-4xl font-black italic text-white">{statsMes.porcIntensidad}%</span>
                 <span className="text-[10px] font-black text-emerald-500 uppercase">Sobrado</span>
              </div>
              <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                 <div className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-1000" style={{ width: `${statsMes.porcIntensidad}%` }}></div>
              </div>
           </div>
           <div className="bg-zinc-900/50 border border-zinc-900 rounded-[2.5rem] p-8 md:col-span-2">
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-6 italic">Hall of Fame • Récords Históricos</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {statsMes.topPRs.map((pr, i) => (
                   <div key={i} className="flex flex-col border-l-2 border-blue-600/30 pl-4">
                      <span className="text-xs font-black text-zinc-600 uppercase mb-1">{pr.nombre}</span>
                      <span className="text-4xl font-black italic text-white tracking-tighter">{pr.peso} KG</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-black text-white font-sans flex flex-col md:flex-row overflow-x-hidden selection:bg-blue-600">
      
      {/* MODAL ERROR (DARK TECH) */}
      {errorModal.open && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 backdrop-blur-2xl">
          <div className="absolute inset-0 bg-black/40" onClick={() => setErrorModal({ ...errorModal, open: false })}></div>
          <div className="relative w-full max-w-sm bg-zinc-950 border border-red-900/50 rounded-[3rem] p-10 text-center shadow-[0_0_50px_rgba(220,38,38,0.1)] animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-600/20 text-red-500 font-black text-4xl italic">!</div>
            <h4 className="text-2xl font-black uppercase italic mb-2 tracking-tighter">ERROR</h4>
            <p className="text-zinc-600 font-bold text-[10px] mb-8 tracking-widest uppercase">{errorModal.mensaje}</p>
            <button onClick={() => setErrorModal({ ...errorModal, open: false })} className="w-full bg-red-600 text-white font-black py-5 rounded-2xl uppercase tracking-tighter active:scale-95 transition-all shadow-lg shadow-red-600/20">Reintentar</button>
          </div>
        </div>
      )}

      {/* LOGIN PREMIUM */}
      {!isLoggedIn ? (
        <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute top-[max(1.5rem,env(safe-area-inset-top))] right-6 z-20">
            <ThemeToggle />
          </div>
          {/* Fondo Radial */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
          
          <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-1000">
            <div className="text-center mb-8">
               <h1 className="text-[120px] font-black italic uppercase leading-none tracking-tighter text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">GYM</h1>
               <div className="h-2 w-20 bg-blue-600 mx-auto -mt-2 rounded-full shadow-[0_0_20px_rgba(37,99,235,1)]"></div>
            </div>

            {/* WIDGET DINÁMICO */}
            <div className="mb-10 bg-zinc-900/50 backdrop-blur-md border border-white/5 rounded-3xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-600/30">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path></svg>
              </div>
              <div>
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] italic">Agenda</p>
                <p className="text-sm font-black text-white uppercase italic">{widgetEntrenamiento}</p>
              </div>
            </div>

            <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-[4rem] p-10 md:p-14 shadow-2xl relative overflow-hidden group">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4 italic">User</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Atleta" className="w-full bg-white/5 border border-white/5 rounded-3xl p-6 font-black outline-none focus:border-blue-600 focus:bg-white/10 text-white transition-all placeholder:text-zinc-800 text-lg" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4 italic">Password</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-white/5 border border-white/5 rounded-3xl p-6 font-black outline-none focus:border-blue-600 focus:bg-white/10 text-white transition-all placeholder:text-zinc-800 text-lg" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-6 text-zinc-700 hover:text-white transition-colors">{showPassword ? "✕" : "👁️"}</button>
                  </div>
                </div>

                {isMasterUsername && (
                  <p className="text-center text-[10px] font-black text-red-500 uppercase tracking-widest animate-in fade-in duration-300">
                    Cuenta Master · Elegí cómo ingresar
                  </p>
                )}

                {isMasterUsername ? (
                  <div className="grid grid-cols-1 gap-3 mt-2">
                    <button
                      type="submit"
                      onClick={() => setLoginModo('master')}
                      className="w-full bg-red-600 text-white font-black py-6 rounded-3xl uppercase tracking-widest text-sm active:scale-95 hover:bg-red-500 transition-all shadow-xl shadow-red-600/20"
                    >
                      Entrar como Master
                    </button>
                    <button
                      type="submit"
                      onClick={() => setLoginModo('usuario')}
                      className="w-full bg-white text-black font-black py-6 rounded-3xl uppercase tracking-widest text-sm active:scale-95 hover:bg-blue-600 hover:text-white transition-all shadow-xl"
                    >
                      Entrar como Usuario
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    onClick={() => setLoginModo('usuario')}
                    className="w-full bg-white text-black font-black py-6 rounded-3xl uppercase tracking-widest text-sm active:scale-95 hover:bg-blue-600 hover:text-white transition-all mt-6 shadow-xl"
                  >
                    Ingresar
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(true)}
                  className="w-full text-center text-[10px] font-black text-zinc-600 uppercase tracking-widest hover:text-blue-500 transition-colors pt-2"
                >
                  Olvidé mi contraseña
                </button>
              </form>
            </div>
          </div>

          <ForgotPasswordModal
            open={forgotPasswordOpen}
            onClose={() => setForgotPasswordOpen(false)}
            defaultUsername={username}
          />
        </div>
      ) : (
        <>
          {/* MODALES DASHBOARD */}
          {fotoModal.open && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/98 backdrop-blur-xl" onClick={() => setFotoModal({ ...fotoModal, open: false })}></div>
              <div className="relative w-full max-w-lg bg-zinc-900 rounded-[3.5rem] overflow-hidden border border-zinc-800 animate-in zoom-in duration-300">
                <button onClick={() => setFotoModal({ ...fotoModal, open: false })} className="absolute top-8 right-8 z-10 w-12 h-12 bg-black/50 text-white rounded-full font-bold flex items-center justify-center border border-zinc-700 shadow-xl">✕</button>
                <img src={fotoModal.url} alt={fotoModal.nombre} className="w-full h-96 object-cover" />
                <div className="p-10 text-center uppercase font-black italic text-3xl tracking-tighter">{fotoModal.nombre}</div>
              </div>
            </div>
          )}

          {resumenDiaModal.open && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setResumenDiaModal({ ...resumenDiaModal, open: false })}></div>
              <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-[3.5rem] p-8 md:p-12 shadow-2xl animate-in zoom-in duration-300 max-h-[80vh] overflow-y-auto scrollbar-hide">
                <h4 className="text-4xl font-black uppercase italic mb-8">{resumenDiaModal.fecha}</h4>
                <div className="space-y-6">
                  {resumenDiaModal.data.map((s, i) => (
                    <div key={i} className="bg-zinc-900/50 p-6 rounded-3xl border border-zinc-900 flex justify-between items-center relative overflow-hidden">
                      {s.sobrado && <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-500"></div>}
                      <div><p className="text-white font-black uppercase italic text-sm">{s.ejercicios?.nombre}</p><p className="text-zinc-500 font-bold text-[10px] mt-1">Serie 0{s.nro_serie} {s.sobrado && "💪"}</p></div>
                      <div className="text-right"><p className="text-2xl font-black text-blue-500">{s.peso} KG</p><p className="text-xs font-bold text-zinc-400">{s.reps} REPS</p></div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setResumenDiaModal({ ...resumenDiaModal, open: false })} className="w-full bg-white text-black font-black py-6 rounded-3xl uppercase tracking-widest mt-10 active:scale-95">Cerrar</button>
              </div>
            </div>
          )}

          {infoModal.open && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setInfoModal({ ...infoModal, open: false })}></div>
              <div className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[3.5rem] p-10 shadow-2xl animate-in zoom-in duration-300">
                 <div className="mb-8 border-l-4 border-blue-600 pl-4"><p className="text-blue-500 font-black uppercase text-[10px] tracking-widest mb-1 italic">Semana Anterior</p><h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none">{infoModal.nombre}</h3></div>
                 <div className="space-y-4">
                    {infoModal.data.length > 0 ? infoModal.data.map((s, i) => (
                      <div key={i} className="flex items-center justify-between bg-zinc-900 p-6 rounded-3xl border border-zinc-800 relative overflow-hidden group">
                        {s.sobrado && <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-emerald-500"></div>}
                        <div className="flex flex-col"><span className="text-4xl font-black italic text-zinc-800 leading-none mb-1">0{s.nro_serie}</span>{s.sobrado && <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">💪 Sobrado</span>}</div>
                        <div className="text-right"><p className="text-3xl font-black text-white leading-none">{s.peso} <span className="text-xs text-blue-500 ml-1">KG</span></p><p className="text-sm font-bold text-zinc-600 uppercase mt-2 tracking-widest">{s.reps} Reps</p></div>
                      </div>
                    )) : <div className="py-10 text-center opacity-30 italic font-bold uppercase tracking-widest text-zinc-600">Sin registros</div>}
                 </div>
                 <button onClick={() => setInfoModal({ ...infoModal, open: false })} className="w-full bg-blue-600 text-white font-black py-6 rounded-3xl uppercase tracking-widest text-xs mt-10 active:scale-95 shadow-xl">Entendido</button>
              </div>
            </div>
          )}

          {/* DASHBOARD */}
          <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-80 flex-col bg-zinc-950 border-r border-zinc-900 min-h-[100dvh] max-h-[100dvh]">
            <div className="shrink-0 p-8 pb-4 flex items-start justify-between gap-3">
              <h1 className="text-6xl font-black italic uppercase text-white tracking-tighter leading-none">GYM</h1>
              <ThemeToggle className="shrink-0 mt-1" />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-hide px-8">
              <NavigationContent username={username} mesActivo={mesActivo} setMesActivo={setMesActivo} configSemanas={configSemanas} setConfigSemanas={setConfigSemanas} semanaActiva={semanaActiva} setSemanaActiva={setSemanaActiva} diaActivo={diaActivo} setDiaActivo={setDiaActivo} dias={diasRutina} setMenuOpen={setMenuOpen} vistaActiva={vistaActiva} setVistaActiva={setVistaActiva} isMaster={isMaster} />
            </div>
            <div className="shrink-0 p-8 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] border-t border-zinc-900 bg-zinc-950">
              <LogoutButton onClick={handleLogout} className="LogoutButton-light" />
            </div>
          </aside>

          <div className="flex-1 w-full md:pl-80 min-h-[100dvh] flex flex-col">
          <header className="md:hidden fixed top-0 left-0 right-0 z-[60] bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900 px-6 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] flex items-center justify-between min-h-[4.5rem]">
            <button onClick={() => setMenuOpen(true)} className="p-2 text-white"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button>
            <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter leading-none">GYM</h1>
            <div className="flex items-center gap-2">
              <ThemeToggle className="w-11 h-11" />
              <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center font-black text-2xl text-white border-2 border-blue-500/50 shadow-lg">{username[0]}</div>
            </div>
          </header>

          <div className={`md:hidden fixed inset-0 z-[100] transition-all duration-500 ${menuOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setMenuOpen(false)}></div>
            <aside className={`absolute inset-y-0 left-0 w-[88%] bg-zinc-950 border-r border-zinc-900 flex flex-col min-h-[100dvh] max-h-[100dvh] transition-transform duration-500 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
              <div className="flex justify-between items-center px-8 pb-4 pt-[max(2rem,env(safe-area-inset-top))] shrink-0">
                <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">MENU</h2>
                <div className="flex items-center gap-2">
                  <ThemeToggle className="w-11 h-11" />
                  <button onClick={() => setMenuOpen(false)} className="p-3 bg-zinc-900 rounded-2xl text-zinc-400 font-bold">✕</button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-hide px-8">
                <NavigationContent username={username} mesActivo={mesActivo} setMesActivo={setMesActivo} configSemanas={configSemanas} setConfigSemanas={setConfigSemanas} semanaActiva={semanaActiva} setSemanaActiva={setSemanaActiva} diaActivo={diaActivo} setDiaActivo={setDiaActivo} dias={diasRutina} setMenuOpen={setMenuOpen} vistaActiva={vistaActiva} setVistaActiva={setVistaActiva} isMaster={isMaster} />
              </div>
              <div className="shrink-0 p-8 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] border-t border-zinc-900 bg-zinc-950">
                <LogoutButton onClick={handleLogout} className="LogoutButton-light" />
              </div>
            </aside>
          </div>

          <main className={`flex-1 pt-[calc(6rem+env(safe-area-inset-top))] md:pt-14 pb-[max(5rem,env(safe-area-inset-bottom))] mx-auto w-full ${
            vistaActiva === 'master'
              ? 'max-w-none px-3 sm:px-5 md:px-8 lg:px-10 xl:px-12'
              : 'max-w-5xl px-4 md:px-16'
          }`}>
            {userProfile && vistaActiva !== 'master' && (
              <>
                <InstallPwaBanner />
                <PushEnableBanner perfilId={userProfile.id} />
                <AlertasBanner perfilId={userProfile.id} />
              </>
            )}
            {vistaActiva === 'master' && userProfile && (
              <>
                <PushEnableBanner perfilId={userProfile.id} />
                <AlertasBanner perfilId={userProfile.id} />
              </>
            )}
            {vistaActiva === 'master' ? (
              <MasterAdminPanel masterId={userProfile.id} />
            ) : vistaActiva === 'admin_rutina' ? (
              <UserAdminPanel
                userProfile={userProfile}
                ejercicios={ejerciciosVisibles}
                dias={diasRutina}
                diaActivo={diaActivo}
                setDiaActivo={setDiaActivo}
                onRefresh={cargarEjercicios}
                onProfileUpdate={handleProfileUpdate}
              />
            ) : vistaActiva === 'entrenamiento' ? (
              <>
                <header className="mb-12 md:mb-20 px-2 animate-in fade-in duration-500">
                  <div className="flex items-center gap-3 mb-4"><span className="text-[11px] font-black text-blue-600 uppercase tracking-widest italic">{mesActivo}</span><div className="w-1.5 h-1.5 rounded-full bg-zinc-800"></div><span className="text-[11px] font-black text-zinc-700 uppercase tracking-widest italic">Semana {semanaActiva}</span></div>
                  <h2 className="text-5xl md:text-9xl font-black italic uppercase border-l-[15px] border-blue-600 pl-8 leading-none text-white tracking-tighter break-words">{diaActivo}</h2>
                  <p className="text-zinc-600 font-bold mt-6 uppercase text-xs tracking-[0.4em] italic leading-none ml-2">{diasRutina.find(d => d.nombre === diaActivo)?.musculos}</p>
                </header>
                <div className="space-y-16 md:space-y-24">
                  {ejerciciosVisibles.filter(e => e.dia === diaActivo).length === 0 ? (
                    <div className="text-center py-20 bg-zinc-950/50 border border-zinc-900 rounded-[3rem] px-8">
                      <p className="text-zinc-500 font-black uppercase text-xs tracking-widest mb-2">Sin ejercicios para {diaActivo}</p>
                      {usaRutinaPredefinida(userProfile) ? (
                        <p className="text-zinc-700 font-bold text-[10px] uppercase tracking-widest mb-6">Rutina predefinida del gym</p>
                      ) : null}
                      <button onClick={() => setVistaActiva('admin_rutina')} className="bg-amber-500 text-black font-black px-8 py-5 rounded-2xl uppercase text-xs tracking-widest active:scale-95">
                        Personalizar rutina
                      </button>
                    </div>
                  ) : ejerciciosVisibles.filter(e => e.dia === diaActivo).map((ej) => (
                    <section key={ej.id} className="relative group">
                      <div className="flex items-center justify-between mb-8 px-2">
                        <h3 className="text-2xl md:text-4xl font-black text-white uppercase italic tracking-tighter leading-tight max-w-[65%] group-hover:text-blue-500 transition-colors">{ej.nombre}</h3>
                        <div className="flex gap-2 shrink-0">
                           <button onClick={() => abrirInfoSemanAnterior(ej)} className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-400 border border-zinc-800 shadow-xl italic font-black text-xl active:scale-90 transition-all hover:text-emerald-500">i</button>
                           {getFotoUrl(ej) && (
                           <button onClick={() => setFotoModal({ open: true, url: getFotoUrl(ej), nombre: ej.nombre })} className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-400 border border-zinc-800 shadow-xl active:scale-90 transition-all shrink-0">👁️</button>
                           )}
                        </div>
                      </div>
                      <div className="bg-zinc-950/50 rounded-[4rem] border border-zinc-900 p-6 md:p-12 shadow-2xl backdrop-blur-sm relative overflow-hidden">
                        <div className="grid grid-cols-[0.5fr_1.4fr_1.4fr_0.7fr] gap-4 text-[12px] md:text-[14px] font-black text-zinc-500 uppercase tracking-widest text-center mb-10 italic"><span>Series</span><span>KG</span><span>Reps</span><span className="text-emerald-500 tracking-tighter">Sobrado</span></div>
                        <div className="space-y-4 md:space-y-10">
                          {Array.from({ length: ej.num_series || 3 }).map((_, idx) => {
                            const serie = historial[ej.id]?.[idx] || { peso: "", reps: "", sobrado: false };
                            return (
                              <div key={idx} className="grid grid-cols-[0.5fr_1.4fr_1.4fr_0.7fr] gap-3 md:gap-10 items-center">
                                <div className="text-3xl md:text-7xl font-black italic text-zinc-900 text-center leading-none tracking-tighter select-none">0{idx + 1}</div>
                                <input type="number" value={serie.peso} onChange={(e) => manejarCambio(ej.id, idx, 'peso', e.target.value)} placeholder="0" className="bg-zinc-900 border-2 border-zinc-800 rounded-3xl py-10 md:py-16 text-center text-4xl md:text-7xl font-black text-blue-500 outline-none focus:border-blue-600 transition-all w-full shadow-inner" />
                                <input type="number" value={serie.reps} onChange={(e) => manejarCambio(ej.id, idx, 'reps', e.target.value)} placeholder="0" className="bg-zinc-900 border-2 border-zinc-800 rounded-3xl py-10 md:py-16 text-center text-4xl md:text-7xl font-black text-white outline-none focus:border-blue-600 transition-all w-full shadow-inner" />
                                <div className="flex justify-center"><button onClick={() => manejarCambio(ej.id, idx, 'sobrado', !serie.sobrado)} className={`w-14 h-14 md:w-28 md:h-28 rounded-[1.5rem] md:rounded-[3rem] flex items-center justify-center border-2 transition-all duration-500 active:scale-90 ${serie.sobrado ? 'bg-emerald-500 border-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'border-zinc-800 text-zinc-900'}`}><span className="text-xl md:text-5xl font-bold leading-none">{serie.sobrado ? '💪' : '✓'}</span></button></div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              </>
            ) : ( <PaginaCalendario /> )}
          </main>
          </div>
        </>
      )}
    </div>
  )
}

const NavigationContent = ({ username, mesActivo, setMesActivo, configSemanas, setConfigSemanas, semanaActiva, setSemanaActiva, diaActivo, setDiaActivo, dias, setMenuOpen, vistaActiva, setVistaActiva, isMaster }) => {
  const ajustarSemanas = (accion) => {
    setConfigSemanas(prev => {
      const actual = prev[mesActivo];
      if (accion === 'mas' && actual < 6) return { ...prev, [mesActivo]: actual + 1 };
      if (accion === 'menos' && actual > 1) return { ...prev, [mesActivo]: actual - 1 };
      return prev;
    });
  };
  return (
    <div className="space-y-10 pb-4 animate-in slide-in-from-left duration-500">
      <div className="flex items-center gap-5 p-6 bg-zinc-900 rounded-[2.5rem] border border-zinc-800 shadow-xl overflow-visible">
         <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center font-black text-3xl text-white uppercase shrink-0">{username[0]}</div>
         <div className="flex-1 min-w-0"><p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none mb-1.5">{isMaster ? 'Master' : 'Atleta'}</p><p className="text-xl font-black italic text-white uppercase leading-tight break-words">{username}</p></div>
      </div>

      {(isMaster ? vistaActiva !== 'master' : true) && (
        <button
          type="button"
          onClick={() => { setVistaActiva(vistaActiva === 'admin_rutina' ? 'entrenamiento' : 'admin_rutina'); setMenuOpen(false); }}
          className={`w-full py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest transition-all border-2 ${vistaActiva === 'admin_rutina' ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-transparent border-amber-500/40 text-amber-500 hover:bg-amber-500/10'}`}
        >
          {vistaActiva === 'admin_rutina' ? '← Volver a rutina' : 'Personalizar Rutina'}
        </button>
      )}

      {isMaster ? (
        <div className="grid grid-cols-2 p-1.5 bg-zinc-950 rounded-3xl border border-zinc-900">
          <button onClick={() => { setVistaActiva('master'); setMenuOpen(false); }} className={`py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${vistaActiva === 'master' ? 'bg-red-600 text-white shadow-xl' : 'text-zinc-600'}`}>Master</button>
          <button onClick={() => { setVistaActiva('entrenamiento'); setMenuOpen(false); }} className={`py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${vistaActiva === 'entrenamiento' || vistaActiva === 'progreso' || vistaActiva === 'admin_rutina' ? 'bg-zinc-900 text-white shadow-xl shadow-black/50' : 'text-zinc-600'}`}>Mi Cuenta</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 p-1.5 bg-zinc-950 rounded-3xl border border-zinc-900">
          <button onClick={() => { setVistaActiva('entrenamiento'); setMenuOpen(false); }} className={`py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${vistaActiva === 'entrenamiento' ? 'bg-zinc-900 text-white shadow-xl shadow-black/50' : 'text-zinc-600'}`}>Rutina</button>
          <button onClick={() => { setVistaActiva('progreso'); setMenuOpen(false); }} className={`py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${vistaActiva === 'progreso' ? 'bg-zinc-900 text-white shadow-xl shadow-black/50' : 'text-zinc-600'}`}>Progreso</button>
        </div>
      )}
      {(vistaActiva === 'entrenamiento' || vistaActiva === 'admin_rutina') && (
        <>
          {vistaActiva === 'entrenamiento' && (
          <section className="space-y-4">
            <select value={mesActivo} onChange={(e) => setMesActivo(e.target.value)} className="w-full bg-zinc-900 p-6 rounded-3xl font-black border border-zinc-800 text-white appearance-none text-center text-xs uppercase tracking-widest cursor-pointer">{MESES.map(m => <option key={m} value={m}>{m}</option>)}</select>
            <div className="space-y-2">
              <div className="flex items-center justify-between px-3"><label className="text-[10px] font-black text-zinc-700 uppercase tracking-widest font-black">Semanas</label><div className="flex gap-2"><button onClick={() => ajustarSemanas('menos')} className="w-8 h-8 bg-zinc-900 rounded-lg">-</button><button onClick={() => ajustarSemanas('mas')} className="w-8 h-8 bg-zinc-900 rounded-lg">+</button></div></div>
              <div className="grid grid-cols-4 gap-2">{Array.from({ length: configSemanas[mesActivo] }).map((_, i) => (<button key={i+1} onClick={() => setSemanaActiva(i+1)} className={`py-5 rounded-2xl font-black text-sm transition-all ${semanaActiva === i+1 ? 'bg-blue-600 text-white shadow-lg' : 'bg-zinc-900 text-zinc-500'}`}>{i+1}</button>))}</div>
            </div>
          </section>
          )}
          <section className="space-y-3">{dias.map(d => (<button key={d.nombre} onClick={() => { setDiaActivo(d.nombre); setMenuOpen(false); }} className={`w-full text-left p-6 rounded-[2.5rem] font-black transition-all ${diaActivo === d.nombre ? (vistaActiva === 'admin_rutina' ? 'bg-amber-500 text-black shadow-xl' : 'bg-blue-600 text-white shadow-xl') : 'bg-zinc-900 text-zinc-600 border border-zinc-900/50'}`}><span className="text-xl italic uppercase block leading-none">{d.nombre}</span><span className={`text-[10px] font-bold uppercase mt-2 block tracking-tighter ${diaActivo === d.nombre ? 'opacity-60' : 'text-zinc-700'}`}>{d.musculos}</span></button>))}</section>
        </>
      )}
      {vistaActiva === 'progreso' && (
        <div className="bg-blue-600/5 p-8 rounded-[2.5rem] border border-blue-600/20 text-center"><p className="text-[11px] font-black text-blue-500 uppercase tracking-widest">Analytics Activos</p></div>
      )}
    </div>
  );
};

export default App;