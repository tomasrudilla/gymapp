function DoorExitIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
        stroke="#ef4444"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="16 17 21 12 16 7"
        stroke="#ef4444"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="21" y1="12" x2="9" y2="12" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export default function LogoutButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-6 bg-zinc-900 text-zinc-500 font-black rounded-[2rem] border border-zinc-800 uppercase text-[10px] tracking-widest active:scale-95 transition-all hover:text-red-500 hover:border-red-500/40 flex items-center justify-center gap-3 ${className}`}
    >
      <DoorExitIcon />
      Salir
    </button>
  )
}
