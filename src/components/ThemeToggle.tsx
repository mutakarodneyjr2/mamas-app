import React from 'react';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const options: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { mode: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { mode: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> },
  ];

  return (
    <div className={`flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 ${className}`}>
      {options.map((opt) => {
        const isActive = theme === opt.mode;
        return (
          <button
            key={opt.mode}
            type="button"
            onClick={() => setTheme(opt.mode)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
              isActive
                ? 'bg-white dark:bg-slate-900 text-mamas-primary dark:text-mamas-accent shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
