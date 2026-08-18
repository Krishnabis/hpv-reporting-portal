import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, MapPin, Check, X } from 'lucide-react';

export interface OptionItem {
  id: number | string;
  name: string;
  district_id?: number | string;
  district_name?: string;
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
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal input query when value prop changes externally
  useEffect(() => {
    if (value) {
      setQuery(value.name);
    } else {
      setQuery('');
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset query text to current selected value name if closed without selecting
        if (value) {
          setQuery(value.name);
        } else {
          setQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  // Filter options dynamically as user types directly in the primary search input
  const filteredOptions = options.filter(opt => {
    const q = query.trim().toLowerCase();
    if (!q || (value && query === value.name)) return true;
    return opt.name.toLowerCase().includes(q) || (opt.district_name ? opt.district_name.toLowerCase().includes(q) : false);
  });

  const handleSelect = (item: OptionItem) => {
    onChange(item);
    setQuery(item.name);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setQuery('');
  };

  return (
    <div className="flex flex-col gap-1.5 w-full text-left relative" ref={containerRef}>
      <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
        {label}
      </label>

      <div className="relative w-full">
        <div className="relative flex items-center">
          <MapPin className={`w-4 h-4 absolute left-3.5 pointer-events-none transition-colors ${value ? 'text-hpv-teal' : 'text-slate-400'}`} />

          {/* Primary Live Search Input (No duplicate search bar below) */}
          <input
            type="text"
            disabled={disabled}
            value={query}
            onFocus={() => {
              if (!disabled) setIsOpen(true);
            }}
            onChange={e => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
              if (value && e.target.value !== value.name) {
                onChange(null);
              }
            }}
            placeholder={placeholder}
            className={`w-full pl-10 pr-10 py-3 bg-white border rounded-xl text-sm font-semibold text-slate-900 transition-all duration-150 ${
              disabled
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : isOpen
                ? 'border-hpv-purple ring-2 ring-hpv-purple/20'
                : 'border-slate-300 hover:border-slate-400'
            }`}
          />

          <div className="absolute right-3 flex items-center gap-1">
            {value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform cursor-pointer ${
                isOpen ? 'rotate-180 text-hpv-purple' : ''
              }`}
              onClick={() => {
                if (!disabled) setIsOpen(!isOpen);
              }}
            />
          </div>
        </div>

        {/* Dropdown Options Popup List */}
        {isOpen && !disabled && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in duration-100 max-h-60 overflow-y-auto p-1 divide-y divide-slate-50">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => {
                const isSelected = value?.id === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-hpv-purple-soft text-hpv-purple-dark font-bold'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{opt.name}</span>
                      {opt.subtitle && <span className="text-xs text-slate-400 font-normal">{opt.subtitle}</span>}
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-hpv-purple shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 font-medium">
                {emptyText}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
