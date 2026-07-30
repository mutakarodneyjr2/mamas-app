import React, { useState } from 'react';

export function Logo({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {hasError ? (
        <div className="w-10 h-10 rounded-full bg-mamas-accent/10 flex items-center justify-center border border-mamas-accent/20">
          <span className="font-display font-bold text-mamas-accent text-xl">M</span>
        </div>
      ) : (
        <img 
          src="/logo.png" 
          alt="MAMAS Official Logo" 
          className="w-10 h-10 object-contain rounded-full shadow-sm bg-white p-0.5 border border-slate-200"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      )}
      <span className={`font-display font-bold text-xl tracking-tight ${dark ? 'text-mamas-primary' : 'text-mamas-primary'}`}>
        MAMAS
      </span>
    </div>
  );
}

export function LogoLarge({ className = '' }: { className?: string }) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="w-24 h-24 rounded-2xl bg-white p-2 shadow-sm border border-gray-100 flex items-center justify-center">
        {hasError ? (
          <div className="w-full h-full rounded-xl bg-amber-50 flex items-center justify-center">
            <span className="font-display font-bold text-mamas-accent text-4xl">M</span>
          </div>
        ) : (
          <img 
            src="/logo.png" 
            alt="MAMAS Official Logo" 
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
          />
        )}
      </div>
      <div className="text-center">
        <h1 className="font-display font-bold text-3xl tracking-tight text-mamas-primary">MAMAS</h1>
        <p className="text-xs font-semibold text-gray-400 mt-1 uppercase tracking-widest">Matuumu Alumni Mutual Aid Association</p>
      </div>
    </div>
  );
}
