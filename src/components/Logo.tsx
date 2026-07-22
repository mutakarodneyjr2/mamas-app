import React from 'react';

export function Logo({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img 
        src="/logo.png" 
        alt="MAMAS Official Logo" 
        className="w-10 h-10 object-contain rounded-full shadow-sm bg-white p-0.5 border border-slate-200"
        referrerPolicy="no-referrer"
      />
      <span className={`font-display font-bold text-xl tracking-tight ${dark ? 'text-mamas-primary' : 'text-white'}`}>MAMAS</span>
    </div>
  );
}

export function LogoLarge({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="w-24 h-24 rounded-2xl bg-white p-2 shadow-md border border-slate-200 flex items-center justify-center">
        <img 
          src="/logo.png" 
          alt="MAMAS Official Logo" 
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="text-center">
        <h1 className="font-display font-bold text-3xl tracking-tight text-mamas-primary">MAMAS</h1>
        <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">Matuumu Alumni Mutual Aid Association</p>
      </div>
    </div>
  );
}

