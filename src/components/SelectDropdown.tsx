import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface Option {
  label: string;
  value: string;
  icon?: string;
  category?: string;
}

interface SelectDropdownProps {
  id?: string;
  name?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function SelectDropdown({
  id,
  name,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  searchable = false,
  disabled = false,
  icon,
}: SelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tempValue, setTempValue] = useState(value);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Sync local tempValue when value prop changes externally
  useEffect(() => {
    setTempValue(value);
  }, [value]);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, searchable]);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasCategories = options.some(opt => opt.category);
  const groupedOptions = filteredOptions.reduce((acc, option) => {
    const cat = option.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(option);
    return acc;
  }, {} as Record<string, Option[]>);

  const handleConfirm = () => {
    onChange(tempValue);
    setIsOpen(false);
    setSearchQuery('');
  };
  
  const handleClose = () => {
    setTempValue(value); // reset to actual value
    setIsOpen(false);
    setSearchQuery('');
  };

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <>
      <div 
        className={`relative w-full px-4 py-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
          isOpen ? 'border-mamas-accent ring-2 ring-mamas-accent/20' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setIsOpen(true)}
      >
        <div className="flex items-center gap-3 truncate">
          {icon && <div className="text-gray-400">{icon}</div>}
          {selectedOption ? (
            <span className="text-gray-900 font-medium truncate">{selectedOption.label}</span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown className="w-5 h-5 text-gray-400" />
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
              onClick={handleClose}
            />
            
            {/* Bottom Sheet */}
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 h-[80vh] bg-white rounded-t-3xl shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-900">{placeholder}</h3>
                <button onClick={handleClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Search */}
              {searchable && (
                <div className="p-4 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 border-none rounded-full text-sm focus:ring-2 focus:ring-mamas-accent outline-none"
                    />
                  </div>
                </div>
              )}
              
              {/* Options List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredOptions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No results found</div>
                ) : hasCategories ? (
                  Object.entries(groupedOptions).map(([category, opts]) => (
                    <div key={category} className="mb-6 last:mb-0">
                      {category !== 'Other' && (
                        <div className="px-2 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-widest sticky top-0 bg-white z-10">
                          {category}
                        </div>
                      )}
                      {opts.map((option) => (
                        <OptionItem 
                          key={option.value} 
                          option={option} 
                          isSelected={tempValue === option.value} 
                          onSelect={() => setTempValue(option.value)} 
                        />
                      ))}
                    </div>
                  ))
                ) : (
                  filteredOptions.map((option) => (
                    <OptionItem 
                      key={option.value} 
                      option={option} 
                      isSelected={tempValue === option.value} 
                      onSelect={() => setTempValue(option.value)} 
                    />
                  ))
                )}
              </div>
              
              {/* Footer / Confirm */}
              <div className="p-4 border-t border-gray-100 pb-safe">
                <button 
                  onClick={handleConfirm}
                  className="w-full py-4 bg-mamas-primary text-white font-bold rounded-full shadow-lg hover:bg-mamas-primary-hover active:scale-[0.98] transition-all"
                >
                  Confirm Selection
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function OptionItem({ option, isSelected, onSelect }: { option: Option, isSelected: boolean, onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all mb-2 ${
        isSelected ? 'bg-amber-50' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-3">
        {option.icon && <span className="text-xl">{option.icon}</span>}
        <span className={`font-medium ${isSelected ? 'text-mamas-accent' : 'text-gray-700'}`}>
          {option.label}
        </span>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-mamas-accent' : 'border-gray-300'}`}>
        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-mamas-accent" />}
      </div>
    </button>
  );
}
