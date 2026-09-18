import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useRegisterModal } from '../lib/nativeBack';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  label: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  minLength?: number;
  isTextArea?: boolean;
}

export function PromptModal({
  isOpen,
  title,
  label,
  placeholder = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
  minLength = 1,
  isTextArea = false
}: PromptModalProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setValue('');
    }
  }, [isOpen]);

  useRegisterModal(isOpen && !isLoading, onCancel, 'prompt-modal');

  if (!isOpen) return null;

  const isValid = value.trim().length >= minLength;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div 
        className="fixed inset-0" 
        onClick={!isLoading ? onCancel : undefined}
      ></div>
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {title}
            </h3>
            <button
              onClick={!isLoading ? onCancel : undefined}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
              disabled={isLoading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {label}
            </label>
            {isTextArea ? (
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none dark:text-white"
                rows={3}
                disabled={isLoading}
                autoFocus
              />
            ) : (
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none dark:text-white"
                disabled={isLoading}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isValid && !isLoading) {
                    onConfirm(value.trim());
                  }
                }}
              />
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 dark:bg-gray-800 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => onConfirm(value.trim())}
              disabled={isLoading || !isValid}
              className="px-4 py-2 text-sm font-bold text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center min-w-[100px] bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
