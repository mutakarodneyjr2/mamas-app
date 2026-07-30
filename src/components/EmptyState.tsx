import React from 'react';

export function EmptyState({ 
  icon: Icon, 
  title, 
  subtitle, 
  action 
}: { 
  icon: React.ElementType, 
  title: string, 
  subtitle: string, 
  action?: React.ReactNode 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-bold text-gray-900 tracking-tight mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">
        {subtitle}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
