import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check, MapPin, Hash } from 'lucide-react';

export interface OptionItem {
  id: number | string;
  name: string;
  lgd_code?: number | string;
  subtitle?: string;
}

interface SearchableSelectProps {
  label: string;
  placeholder: string;
  options: OptionItem[];
  value: OptionItem | null;
  onChange: (item: OptionItem | null) => void;
  disabled?: boolean;
  emptyText?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled = false,
  emptyText = 'No matching options found'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options
  const filteredOptions = options.filter(opt => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = opt.name.toLowerCase().includes(q);
    const lgdMatch = opt.lgd_code ? String(opt.lgd_code).includes(q) : false;
    const subMatch = opt.subtitle ? opt.subtitle.toLowerCase().includes(q) : false;
    return nameMatch || lgdMatch || subMatch;
  });

  const handleSelect = (item: OptionItem) => {
    onChange(item);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="flex flex-col gap-1.5 w-full text-left" ref={containerRef}>
      <label className="text-sm font-semibold text-slate-700 flex items-center justify-between">
        <span>{label}</span>
        {value?.lgd_code && (
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-hpv-purple-soft text-hpv-purple flex items-center gap-1">
            <Hash className="w-3 h-3" /> LGD: {value.lgd_code}
          </span>
        )}
      </label>

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen);
              setTimeout(() => inputRef.current?.focus(), 100);
            }
          }}
          className={`w-full flex items-center justify-between px-4 py-3 bg-white border rounded-xl shadow-sm text-left transition-all duration-150 ${
            disabled
              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              : isOpen
              ? 'border-hpv-purple ring-2 ring-hpv-purple/20'
              : 'border-slate-300 hover:border-slate-400 text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <MapPin className={`w-4 h-4 shrink-0 ${value ? 'text-hpv-teal' : 'text-slate-400'}`} />
            {value ? (
              <span className="font-medium truncate text-slate-900">{value.name}</span>
            ) : (
              <span className="text-slate-400 font-normal">{placeholder}</span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-hpv-purple' : ''}`} />
        </button>

        {/* Dropdown Popup */}
        {isOpen && !disabled && (
          <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Search Input */}
            <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 ml-1" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full bg-transparent border-none text-sm text-slate-900 focus:outline-none placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-1"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-50">
              {filteredOptions.length > 0 ? (
                filteredOptions.map(opt => {
                  const isSelected = value?.id === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelect(opt)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-hpv-purple-soft text-hpv-purple-dark font-semibold'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{opt.name}</span>
                        {opt.subtitle && <span className="text-xs text-slate-400">{opt.subtitle}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {opt.lgd_code && (
                          <span className="text-[11px] font-mono font-normal px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                            LGD: {opt.lgd_code}
                          </span>
                        )}
                        {isSelected && <Check className="w-4 h-4 text-hpv-purple" />}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-slate-400 font-medium">
                  {emptyText}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
