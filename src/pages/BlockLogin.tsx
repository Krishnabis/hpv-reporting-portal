import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Target, Circle } from 'lucide-react';
import { Logo } from '../components/Logo';
import { SearchableSelect, OptionItem } from '../components/SearchableSelect';

export const BlockLogin: React.FC = () => {
  const navigate = useNavigate();
  const [districts, setDistricts] = useState<OptionItem[]>([]);
  const [allBlocks, setAllBlocks] = useState<any[]>([]);
  
  const [selectedDistrict, setSelectedDistrict] = useState<OptionItem | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<OptionItem | null>(null);
  
  const [loading, setLoading] = useState(true);

  const [isUrban, setIsUrban] = useState(false);

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

  // Filter available blocks based on Urban/Rural toggle
  const availableBlockOptions: OptionItem[] = allBlocks
    .filter(b => !!b.is_urban === isUrban)
    .map(b => ({
      id: b.id,
      name: b.name,
      subtitle: `(State: Uttarakhand, District: ${b.district_name})`,
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
    <div className="h-[100dvh] w-full overflow-y-auto bg-slate-50 flex flex-col justify-between p-2 sm:p-4 lg:p-6">
      {/* Top Header */}
      <header className="max-w-md mx-auto w-full flex items-center justify-between py-2">
        <div className="bg-white rounded-[2rem] px-5 py-2 flex items-center justify-center shadow-sm shrink-0">
          <img src="/loginlogo.png" alt="HPV Kavach Login Logo" className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105" />
        </div>
        <a
          href="/admin/login"
          className="text-xs font-semibold text-hpv-purple hover:text-hpv-purple-dark px-3 py-1.5 rounded-lg bg-hpv-purple-soft transition-colors"
        >
          Admin Login
        </a>
      </header>

      {/* Main Card Container */}
      <main className="max-w-md mx-auto w-full my-auto py-2">
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/60 border border-slate-150 relative overflow-hidden">
          {/* Top Accent */}
          <div className="absolute top-0 left-0 right-0 h-2 gradient-header" />

          {/* Heading Title & Tagline */}
          <div className="text-center mb-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-hpv-pink-soft text-hpv-pink-dark mb-3">
              <Circle className="w-2 h-2 fill-current" />
              National Health Mission – Uttarakhand
            </span>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              HPV Vaccination Program
            </h1>
            
            <div className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-hpv-purple">
              <Target className="w-5 h-5 text-hpv-teal" />
              Cervical Cancer Elimination
            </div>

            <p className="mt-4 text-[11px] font-medium text-slate-500 flex items-center justify-center gap-1.5 bg-slate-100/50 p-2 rounded-lg border border-slate-200/50">
              <span className="text-base">🇮🇳</span>
              <span>India: <strong className="text-slate-700">78,499</strong> new cases; <strong className="text-slate-700">42,392</strong> deaths <span className="text-[9px] text-slate-400">(NCRP-ICMR, 2024)</span></span>
            </p>
          </div>

          {/* Block Selection Form */}
          <form onSubmit={handleContinue} className="space-y-4">
            
            {/* Urban / Rural Toggle */}
            <div className="flex bg-slate-100 p-1.5 rounded-xl">
              <button
                type="button"
                onClick={() => { setIsUrban(false); setSelectedBlock(null); }}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isUrban ? 'bg-white text-hpv-purple shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Block (Rural)
              </button>
              <button
                type="button"
                onClick={() => { setIsUrban(true); setSelectedBlock(null); }}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isUrban ? 'bg-white text-hpv-purple shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-700'}`}
              >
                City (Urban)
              </button>
            </div>

            <SearchableSelect
              label={isUrban ? "SELECT CITY" : "SELECT BLOCK"}
              placeholder={loading ? "Loading..." : `Type or search ${isUrban ? 'city' : 'block'}...`}
              options={availableBlockOptions}
              value={selectedBlock}
              onChange={handleBlockChange}
              disabled={loading}
              emptyText={`No matching ${isUrban ? 'cities' : 'blocks'} found`}
            />

            {/* Submit Action */}
            <button
              type="submit"
              disabled={!selectedBlock}
              className={`w-full py-3.5 px-6 rounded-2xl font-bold text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group ${
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
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center text-xs text-slate-500">
            <span className="flex items-center gap-1 font-semibold text-slate-600">
              Due Listing & Coverage Tracking
            </span>
          </div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="max-w-md mx-auto w-full text-center py-2 text-xs text-slate-400 space-y-2">
        <div>HPV Program Monitoring Portal • Version: 1.0 • UK 2026</div>
        <div className="flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-400">Powered by:</span>
          <img src="/impactcode.png" alt="ImpactCode" className="h-8 object-contain" />
        </div>
      </footer>
    </div>
  );
};
