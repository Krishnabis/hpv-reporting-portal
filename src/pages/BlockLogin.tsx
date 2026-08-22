import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Target, Circle, ShieldCheck, Download, Phone, Eye, EyeOff } from 'lucide-react';
import { Logo } from '../components/Logo';
import { SearchableSelect, OptionItem } from '../components/SearchableSelect';

export const BlockLogin: React.FC = () => {
  const navigate = useNavigate();
  const [districts, setDistricts] = useState<OptionItem[]>([]);
  const [allBlocks, setAllBlocks] = useState<any[]>([]);

  const [selectedDistrict, setSelectedDistrict] = useState<OptionItem | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<OptionItem | null>(null);

  // Passcode state
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const hasRestored = useRef(false);

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

  // List all available blocks and cities combined
  const availableBlockOptions: OptionItem[] = allBlocks
    .map(b => ({
      id: b.id,
      name: b.name,
      subtitle: `(State: Uttarakhand, District: ${b.district_name})`,
      typeLabel: b.is_urban ? 'CITY (URBAN)' : 'BLOCK',
      district_id: b.district_id,
      district_name: b.district_name
    }));

  // Handle Block selection
  const handleBlockChange = (item: OptionItem | null) => {
    setSelectedBlock(item);
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlock) return;
    
    setLoginError('');
    setIsLoggingIn(true);
    
    try {
      const res = await fetch('/api/blocks/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId: selectedBlock.id, passcode })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Invalid passcode');
      }
      
      localStorage.setItem('hpv_last_block_id', String(selectedBlock.id));
      if (rememberMe) {
        localStorage.setItem(`hpv_block_token_${selectedBlock.id}`, data.token);
      } else {
        sessionStorage.setItem(`hpv_block_token_${selectedBlock.id}`, data.token);
      }
      navigate(`/report?blockId=${selectedBlock.id}`);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPasscode = async () => {
    if (!selectedBlock) return;
    if (!window.confirm(`Reset passcode to default for ${selectedBlock.label}?`)) return;
    
    try {
      const res = await fetch('/api/blocks/reset-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId: selectedBlock.id })
      });
      if (res.ok) {
        alert('Passcode reset to default');
        setPasscode('');
      } else {
        const data = await res.json();
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Failed to reset passcode.');
    }
  };

  // Restore last selected block and auto-login if remembered
  useEffect(() => {
    if (!loading && availableBlockOptions.length > 0 && !hasRestored.current) {
      hasRestored.current = true;
      const lastId = localStorage.getItem('hpv_last_block_id');
      if (lastId) {
        const found = availableBlockOptions.find(b => String(b.id) === lastId);
        if (found) {
          setSelectedBlock(found);
          // Check if we have a valid token in localStorage for this block
          const token = localStorage.getItem(`hpv_block_token_${lastId}`);
          if (token) {
            // Auto login!
            navigate(`/report?blockId=${lastId}`);
          }
        }
      }
    }
  }, [loading, availableBlockOptions, navigate]);

  return (
    <div className="h-[100dvh] w-full overflow-y-auto bg-slate-50 flex flex-col justify-between p-2 sm:p-4 lg:p-6">
      {/* Top Header */}
      <header className="max-w-md mx-auto w-full flex items-center justify-between py-2">
        <div className="bg-white rounded-[2rem] px-5 py-2 flex items-center justify-center shadow-sm shrink-0">
          <img src="/loginlogo.png" alt="HPV Kavach Login Logo" className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105" />
        </div>
        <a
          href="/admin"
          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 px-3 py-1.5 rounded-lg bg-emerald-100 transition-colors"
        >
          Admin Login
        </a>
      </header>

      {/* Main Card Container */}
      <main className="max-w-md mx-auto w-full my-auto py-2">
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/60 border border-slate-150 relative">
          {/* Top Accent */}
          <div className="absolute top-0 left-0 right-0 h-2 gradient-header rounded-t-3xl" />

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
              <span className="text-xl">🎯</span>
              Cervical Cancer Elimination
            </div>

            <p className="mt-4 text-[11px] font-medium text-slate-500 flex items-center justify-center gap-1.5 bg-slate-100/50 p-2 rounded-lg border border-slate-200/50">
              <img src="https://upload.wikimedia.org/wikipedia/en/4/41/Flag_of_India.svg" alt="India Flag" className="w-4 h-3 rounded-[2px] shadow-sm" />
              <span>India: <strong className="text-slate-700">78,499</strong> new cases; <strong className="text-slate-700">42,392</strong> deaths <span className="text-[9px] text-slate-400">(NCRP-ICMR, 2024)</span></span>
            </p>
          </div>

          {/* Block Selection Form */}
          <form onSubmit={handleContinue} className="space-y-4">

            <SearchableSelect
              label="SELECT YOUR BLOCK OR CITY (URBAN)"
              placeholder={loading ? "Loading..." : "Type or search block or city..."}
              options={availableBlockOptions}
              value={selectedBlock}
              onChange={handleBlockChange}
              disabled={loading || isLoggingIn}
              emptyText="No matching blocks or cities found"
            />
            
            {selectedBlock && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                {loginError && (
                  <div className="mb-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold">
                    {loginError}
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Enter 4-Digit Passcode
                  </label>
                  <div className="relative">
                    <input
                      type={showPasscode ? "text" : "password"}
                      maxLength={4}
                      value={passcode}
                      onChange={e => setPasscode(e.target.value.replace(/\D/g, ''))}
                      placeholder="****"
                      disabled={isLoggingIn}
                      className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold tracking-[0.5em] text-center text-slate-900 focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasscode(!showPasscode)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    >
                      {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={isLoggingIn}
                      className="w-4 h-4 text-hpv-purple bg-slate-50 border-slate-300 rounded focus:ring-hpv-purple focus:ring-2 cursor-pointer"
                    />
                    <label htmlFor="rememberMe" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                      Remember me
                    </label>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={handleForgotPasscode}
                    disabled={isLoggingIn}
                    className="text-[11px] font-bold text-slate-500 hover:text-hpv-purple transition-colors"
                  >
                    Forgot Passcode?
                  </button>
                </div>
              </div>
            )}

            {/* Submit Action */}
            <button
              type="submit"
              disabled={!selectedBlock || isLoggingIn}
              className={`w-full py-3.5 px-6 rounded-2xl font-bold text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group ${selectedBlock && !isLoggingIn
                  ? 'gradient-header hover:shadow-hpv-purple/30 hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                  : 'bg-slate-300 shadow-none cursor-not-allowed'
                }`}
            >
              <span>{isLoggingIn ? 'Verifying...' : 'Continue to Reporting'}</span>
              {!isLoggingIn && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          {/* Footer Info */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs">
            <a href="/tracker.pdf" download className="flex items-center gap-1.5 font-bold text-blue-600 hover:text-blue-700 transition-colors">
              <Download className="w-4 h-4" />
              HPV Due List Format
            </a>
            <div className="hidden sm:block w-px h-4 bg-slate-200" />
            <a href="tel:+917457007286" className="flex items-center gap-1.5 font-bold text-slate-600 hover:text-slate-800 transition-colors">
              <Phone className="w-4 h-4 text-emerald-500" />
              Need help? +91-7457007286
            </a>
          </div>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="max-w-md mx-auto w-full text-center py-2 text-xs text-slate-400 space-y-2">
        <div>HPV Vaccination Monitoring Portal • Version: 1.0 • UK 2026</div>
        <div className="flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-400">Powered by:</span>
          <img src="/impactcode.png" alt="ImpactCode" className="h-4 object-contain" />
        </div>
      </footer>
    </div>
  );
};
