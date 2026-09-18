import React from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { useRegisterModal } from '../lib/nativeBack';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isDanger?: boolean;
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDanger = false,
  isLoading = false
}: ConfirmationModalProps) {
  useRegisterModal(isOpen && !isLoading, onCancel, 'confirmation-modal');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div 
        className="fixed inset-0" 
        onClick={!isLoading ? onCancel : undefined}
      ></div>
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {isDanger && <AlertTriangle className="w-5 h-5 text-rose-500" />}
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
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            {message}
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
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-bold text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center min-w-[100px] ${
                isDanger 
                  ? 'bg-rose-600 hover:bg-rose-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
