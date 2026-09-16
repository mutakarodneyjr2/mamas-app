import React, { useState } from 'react';

export function Logo({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {hasError ? (
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-0.5 shadow-sm border border-slate-200">
          <span className="font-extrabold text-blue-700 text-lg">M</span>
        </div>
      ) : (
        <img 
          src="/logo.png" 
          alt="Matuumu Alumni Logo" 
          className="w-10 h-10 object-contain rounded-xl shadow-xs bg-white p-0.5 border border-white/40"
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
      <div className="w-24 h-24 rounded-3xl bg-white p-2 shadow-md border border-slate-200/80 flex items-center justify-center">
        {hasError ? (
          <div className="w-full h-full rounded-2xl bg-blue-50 flex items-center justify-center">
            <span className="font-extrabold text-blue-700 text-4xl">M</span>
          </div>
        ) : (
          <img 
            src="/logo.png" 
            alt="Matuumu Alumni Logo" 
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
