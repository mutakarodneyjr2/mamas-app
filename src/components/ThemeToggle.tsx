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
    <div className={`flex items-center bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 ${className}`}>
      {options.map((opt) => {
        const isActive = theme === opt.mode;
        return (
          <button
            key={opt.mode}
            type="button"
            onClick={() => setTheme(opt.mode)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isActive
                ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-sm shadow-slate-900/10'
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

export function ThemeIconButton({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const toggleNext = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <button
      type="button"
      onClick={toggleNext}
      className={`p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors focus:outline-none cursor-pointer ${className}`}
      title={`Theme: ${theme} (click to cycle)`}
      aria-label="Toggle visual theme"
    >
      {theme === 'light' ? (
        <Sun className="w-5 h-5 text-amber-500" />
      ) : theme === 'dark' ? (
        <Moon className="w-5 h-5 text-blue-400" />
      ) : (
        <Monitor className="w-5 h-5 text-slate-500 dark:text-slate-400" />
      )}
    </button>
  );
}
