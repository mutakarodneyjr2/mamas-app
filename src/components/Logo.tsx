import React, { useState } from 'react';

export function Logo({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {hasError ? (
        <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
          <span className="font-extrabold text-blue-600 dark:text-blue-400 text-lg">M</span>
        </div>
      ) : (
        <img 
          src="/logo.png" 
          alt="MAMAS Official Logo" 
          className="w-10 h-10 object-contain rounded-xl shadow-sm bg-white p-0.5 border border-slate-200/80 dark:border-slate-700"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      )}
      <span className={`font-extrabold text-xl tracking-tight ${dark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
        MAMAS
      </span>
    </div>
  );
}

export function LogoLarge({ className = '' }: { className?: string }) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="w-24 h-24 rounded-3xl bg-white dark:bg-slate-800 p-2 shadow-md border border-slate-200/80 dark:border-slate-700 flex items-center justify-center">
        {hasError ? (
          <div className="w-full h-full rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
            <span className="font-extrabold text-blue-600 dark:text-blue-400 text-4xl">M</span>
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
        <h1 className="font-extrabold text-3xl tracking-tight text-slate-900 dark:text-white">MAMAS</h1>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-widest">Matuumu Alumni Mutual Aid Association</p>
      </div>
    </div>
  );
}
