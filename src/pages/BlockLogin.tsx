import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Heart, Sparkles } from 'lucide-react';
import { Logo } from '../components/Logo';
import { SearchableSelect, OptionItem } from '../components/SearchableSelect';

export const BlockLogin: React.FC = () => {
  const navigate = useNavigate();
  const [districts, setDistricts] = useState<OptionItem[]>([]);
  const [allBlocks, setAllBlocks] = useState<any[]>([]);
  
  const [selectedDistrict, setSelectedDistrict] = useState<OptionItem | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<OptionItem | null>(null);
  
  const [loading, setLoading] = useState(true);

  // Fetch all districts and blocks on mount
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/locations/districts').then(res => res.json()),
      fetch('/api/locations/blocks').then(res => res.json())
    ])
      .then(([districtsData, blocksData]) => {
        const mappedDistricts = districtsData.map((d: any) => ({
          id: d.id,
          name: d.name
        }));
        setDistricts(mappedDistricts);

        if (Array.isArray(blocksData)) {
          setAllBlocks(blocksData);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load locations:', err);
        setLoading(false);
      });
  }, []);

  // Filter available blocks based on currently selected district
  const availableBlockOptions: OptionItem[] = allBlocks.map(b => ({
      id: b.id,
      name: `${b.name} (State: Uttarakhand, District: ${b.district_name})`,
      district_id: b.district_id,
      district_name: b.district_name
    }));

  // Handle Block selection
  const handleBlockChange = (item: OptionItem | null) => {
    setSelectedBlock(item);
  };

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
          {/* Top Accent */}
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
            <SearchableSelect
              label="Select Block"
              placeholder={loading ? "Loading blocks..." : "Type or search block..."}
              options={availableBlockOptions}
              value={selectedBlock}
              onChange={handleBlockChange}
              disabled={loading}
              emptyText="No matching blocks found"
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
      <footer className="max-w-md mx-auto w-full text-center py-3 text-xs text-slate-400 space-y-2">
        <div>Department of Health &amp; Family Welfare • Government of Uttarakhand</div>
        <div className="flex items-center justify-center gap-2 opacity-70">
          <span className="text-[10px] text-slate-400">Powered by</span>
          <img src="/impactcode.png" alt="ImpactCode" className="h-5 object-contain" />
          <span className="text-[10px] font-bold text-slate-500">ImpactCode</span>
        </div>
      </footer>
    </div>
  );
};
