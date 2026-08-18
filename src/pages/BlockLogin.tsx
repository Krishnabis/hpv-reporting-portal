import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Heart, Sparkles, Building2, MapPin } from 'lucide-react';
import { Logo } from '../components/Logo';
import { SearchableSelect, OptionItem } from '../components/SearchableSelect';

export const BlockLogin: React.FC = () => {
  const navigate = useNavigate();
  const [districts, setDistricts] = useState<OptionItem[]>([]);
  const [blocks, setBlocks] = useState<OptionItem[]>([]);
  
  const [selectedDistrict, setSelectedDistrict] = useState<OptionItem | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<OptionItem | null>(null);
  
  const [loadingDistricts, setLoadingDistricts] = useState(true);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  // Fetch districts on mount
  useEffect(() => {
    fetch('/api/locations/districts')
      .then(res => res.json())
      .then(data => {
        const mapped = data.map((d: any) => ({
          id: d.id,
          name: d.name,
          lgd_code: d.lgd_code,
          subtitle: `LGD Code: ${d.lgd_code}`
        }));
        setDistricts(mapped);
        setLoadingDistricts(false);
      })
      .catch(err => {
        console.error('Failed to load districts:', err);
        setLoadingDistricts(false);
      });
  }, []);

  // Fetch blocks when selected district changes
  useEffect(() => {
    if (!selectedDistrict) {
      setBlocks([]);
      setSelectedBlock(null);
      return;
    }

    setLoadingBlocks(true);
    fetch(`/api/locations/blocks?districtId=${selectedDistrict.id}`)
      .then(res => res.json())
      .then(data => {
        const mapped = data.map((b: any) => ({
          id: b.id,
          name: b.name,
          lgd_code: b.lgd_code,
          subtitle: `District: ${b.district_name}`
        }));
        setBlocks(mapped);
        setSelectedBlock(null);
        setLoadingBlocks(false);
      })
      .catch(err => {
        console.error('Failed to load blocks:', err);
        setLoadingBlocks(false);
      });
  }, [selectedDistrict]);

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBlock) {
      navigate(`/report?blockId=${selectedBlock.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <header className="max-w-md mx-auto w-full flex items-center justify-between py-2">
        <Logo size="md" />
        <a
          href="/admin/login"
          className="text-xs font-semibold text-hpv-purple hover:text-hpv-purple-dark px-3 py-1.5 rounded-lg bg-hpv-purple-soft transition-colors"
        >
          Admin Login
        </a>
      </header>

      {/* Main Card Container */}
      <main className="max-w-md mx-auto w-full my-auto py-8">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 border border-slate-150 relative overflow-hidden">
          {/* Subtle Top Accent */}
          <div className="absolute top-0 left-0 right-0 h-2 gradient-header" />

          {/* Heading Title & Tagline */}
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-hpv-pink-soft text-hpv-pink-dark mb-3">
              <Heart className="w-3.5 h-3.5 fill-current" />
              National Immunization Program
            </span>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              HPV Vaccination – Due List Tracking
            </h1>
            
            <p className="mt-2 text-sm font-medium text-hpv-purple flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-hpv-teal" />
              <span className="italic">"No Girl Should Be Left Behind"</span>
            </p>
          </div>

          {/* Block Selection Form */}
          <form onSubmit={handleContinue} className="space-y-6">
            {/* Searchable Select District */}
            <SearchableSelect
              label="Select District"
              placeholder={loadingDistricts ? "Loading districts..." : "Type or search district..."}
              options={districts}
              value={selectedDistrict}
              onChange={setSelectedDistrict}
              disabled={loadingDistricts}
            />

            {/* Searchable Select Block */}
            <SearchableSelect
              label="Select Block"
              placeholder={
                !selectedDistrict
                  ? "Select a district first"
                  : loadingBlocks
                  ? "Loading blocks..."
                  : "Type or search block..."
              }
              options={blocks}
              value={selectedBlock}
              onChange={setSelectedBlock}
              disabled={!selectedDistrict || loadingBlocks}
              emptyText="No blocks found for this district"
            />

            {/* Submit Action */}
            <button
              type="submit"
              disabled={!selectedBlock}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group ${
                selectedBlock
                  ? 'gradient-header hover:shadow-hpv-purple/30 hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                  : 'bg-slate-300 shadow-none cursor-not-allowed'
              }`}
            >
              <span>Continue to Reporting</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          {/* Footer Info */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-hpv-teal" /> Official Reporting Portal
            </span>
            <span className="font-mono text-[11px]">v1.0 • UK 2026</span>
          </div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="max-w-md mx-auto w-full text-center py-2 text-xs text-slate-400">
        Department of Health & Family Welfare • Government of Uttarakhand
      </footer>
    </div>
  );
};
