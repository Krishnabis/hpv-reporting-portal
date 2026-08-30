/**
 * BlockShell — Shared layout for all block-facing pages.
 *
 * Renders: Header (logo + nav dropdown + settings) → Purple Hero Card → {children} → Footer
 *
 * Block data is fetched ONCE here and shared via BlockContext.
 * When navigating between pages (Daily Report / Due List / Stock / Trends / Feedback),
 * only the content area (children) re-renders; the shell stays mounted.
 */

import React, {
  createContext, useContext, useState, useEffect, useRef, useCallback
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Settings, ChevronDown, ClipboardList, BarChart2,
  Package, MessageSquare, TrendingUp, Building2, Users, Info, Lock, Eye, EyeOff, X, Bell
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlockData {
  id: number;
  name: string;
  lgd_code: number;
  district_name: string;
  district_lgd_code: number;
  state_name: string;
  state_lgd_code: number;
  is_urban?: boolean;
}

export interface ProfileData {
  base_population: number;
  population_base_date: string;
  initial_hpv_target: number;
  current_population: number;
  current_hpv_target: number;
  is_unlocked?: boolean;
  unlock_requested?: boolean;
}

export interface ReportData {
  id: string;
  reporting_date: string;
  sessions_held: number;
  beneficiaries_vaccinated: number;
  submitted_at: string;
}

export interface BlockContextValue {
  blockId: string;
  block: BlockData | null;
  profile: ProfileData | null;
  todaySubmitted: boolean;
  lastReport: ReportData | null;
  loading: boolean;
  refetch: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const BlockContext = createContext<BlockContextValue>({
  blockId: '',
  block: null,
  profile: null,
  todaySubmitted: false,
  lastReport: null,
  loading: true,
  refetch: () => {}
});

export const useBlock = () => useContext(BlockContext);

// ─── Nav pages config ─────────────────────────────────────────────────────────

export type BlockPage = 'daily' | 'due-list' | 'stock' | 'trends' | 'feedback';

const NAV_ITEMS: { id: BlockPage; label: string; shortLabel: string; icon: React.ElementType; path: (blockId: string) => string }[] = [
  { id: 'daily',    label: 'Daily Report',                      shortLabel: 'Daily Report',   icon: ClipboardList, path: id => `/report?blockId=${id}` },
  { id: 'due-list', label: 'Monthly Due List Report',           shortLabel: 'Due List',       icon: BarChart2,     path: id => `/due-list-report?blockId=${id}` },
  { id: 'stock',    label: 'HPV Vaccine Stock Balance Report',  shortLabel: 'Stock Balance',  icon: Package,       path: id => `/monthly-report?blockId=${id}` },
  { id: 'trends',   label: 'Trends',                            shortLabel: 'Trends',         icon: TrendingUp,    path: id => `/progress-trend?blockId=${id}` },
  { id: 'feedback', label: 'Feedback',                          shortLabel: 'Feedback',       icon: MessageSquare, path: id => `/feedback?blockId=${id}` },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface BlockShellProps {
  currentPage: BlockPage;
  children: React.ReactNode;
}

export const BlockShell: React.FC<BlockShellProps> = ({ currentPage, children }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const blockId = searchParams.get('blockId') || '';

  // Block data state
  const [block, setBlock] = useState<BlockData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [todaySubmitted, setTodaySubmitted] = useState(false);
  const [lastReport, setLastReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [showNavDropdown, setShowNavDropdown] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showChangePasscodeModal, setShowChangePasscodeModal] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmNewPasscode, setConfirmNewPasscode] = useState('');
  const [showCurrentPasscode, setShowCurrentPasscode] = useState(false);
  const [showNewPasscode, setShowNewPasscode] = useState(false);
  const [showConfirmPasscode, setShowConfirmPasscode] = useState(false);
  const [changePasscodeError, setChangePasscodeError] = useState('');
  const [isChangingPasscode, setIsChangingPasscode] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const navRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Auth guard
  useEffect(() => {
    if (!blockId) { navigate('/'); return; }
    const token = localStorage.getItem(`hpv_block_token_${blockId}`) || sessionStorage.getItem(`hpv_block_token_${blockId}`);
    if (!token) { navigate('/'); return; }
  }, [blockId]);

  const fetchBlock = useCallback(() => {
    if (!blockId) return;
    setLoading(true);
    fetch(`/api/blocks/${blockId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { navigate('/'); return; }
        setBlock(data.block);
        setProfile(data.profile);
        setTodaySubmitted(data.today_submitted);
        setLastReport(data.last_report);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [blockId]);

  useEffect(() => { fetchBlock(); }, [fetchBlock]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setShowNavDropdown(false);
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setShowSettingsDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasscode !== confirmNewPasscode) { setChangePasscodeError('New passcodes do not match'); return; }
    setIsChangingPasscode(true);
    setChangePasscodeError('');
    try {
      const res = await fetch('/api/blocks/change-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, currentPasscode, newPasscode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      alert('Passcode changed successfully!');
      setShowChangePasscodeModal(false);
      setCurrentPasscode(''); setNewPasscode(''); setConfirmNewPasscode('');
    } catch (err: any) {
      setChangePasscodeError(err.message);
    } finally {
      setIsChangingPasscode(false);
    }
  };

  // Performance category
  const target = profile ? Math.round(profile.base_population * 0.01) : 0;
  const lastVaccinated = lastReport?.beneficiaries_vaccinated || 0;
  const perfPct = target > 0 ? (lastVaccinated / target) * 100 : 0;
  let catImg = 'cat1.png', catName = 'Aspirational';
  if (perfPct >= 90) { catImg = 'cat4.png'; catName = 'Champions'; }
  else if (perfPct >= 70) { catImg = 'cat3.png'; catName = 'High-Performing'; }
  else if (perfPct >= 30) { catImg = 'cat2.png'; catName = 'Progressing'; }

  const currentNav = NAV_ITEMS.find(n => n.id === currentPage)!;

  const ctx: BlockContextValue = {
    blockId,
    block,
    profile,
    todaySubmitted,
    lastReport,
    loading,
    refetch: fetchBlock
  };

  return (
    <BlockContext.Provider value={ctx}>
      <div className="h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden">

        {/* ── TOP HEADER ─────────────────────────────────────────── */}
        <header className="bg-white border-b border-slate-200 z-30 shadow-sm shrink-0">
          <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between min-h-[56px]">
            <div className="cursor-pointer" onClick={() => navigate('/')}>
              <img src="/headinglogo.png" alt="Logo" className="h-12 object-contain hover:opacity-80 transition-opacity" />
            </div>

            <div className="flex items-center gap-2">
              {/* Nav dropdown */}
              <div className="relative" ref={navRef}>
                <button
                  onClick={() => setShowNavDropdown(!showNavDropdown)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-hpv-purple-soft/40 hover:bg-hpv-purple-soft text-hpv-purple-dark text-xs font-bold transition-colors border border-hpv-purple/20"
                >
                  <currentNav.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{currentNav.shortLabel}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showNavDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showNavDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {NAV_ITEMS.map(item => (
                      <button
                        key={item.id}
                        onClick={() => { setShowNavDropdown(false); navigate(item.path(blockId)); }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-3 transition-colors border-b border-slate-100 last:border-0
                          ${item.id === currentPage ? 'bg-hpv-purple-soft/50 text-hpv-purple' : 'text-slate-700 hover:bg-slate-50'}`}
                      >
                        <item.icon className={`w-3.5 h-3.5 shrink-0 ${item.id === currentPage ? 'text-hpv-purple' : 'text-slate-400'}`} />
                        {item.label}
                        {item.id === currentPage && (
                          <span className="ml-auto text-[8px] bg-hpv-purple text-white px-1.5 py-0.5 rounded-full uppercase font-bold">Now</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Settings */}
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                >
                  <Settings className="w-4.5 h-4.5" />
                </button>
                {showSettingsDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50">
                    <button
                      onClick={() => { setShowSettingsDropdown(false); setShowChangePasscodeModal(true); }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Change Passcode
                    </button>
                    <button
                      onClick={() => {
                        localStorage.removeItem(`hpv_block_token_${blockId}`);
                        sessionStorage.removeItem(`hpv_block_token_${blockId}`);
                        navigate('/');
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors border-t border-slate-100"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── SCROLLABLE BODY ────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-3 space-y-3">

            {/* Purple Hero Card */}
            {loading ? (
              <div className="gradient-header rounded-2xl p-4 h-20 animate-pulse opacity-60" />
            ) : block ? (
              <div className="gradient-header rounded-2xl p-4 text-white shadow-lg shadow-hpv-purple/20 relative overflow-hidden">
                <div className="absolute top-0 right-16 p-4 opacity-[0.07] pointer-events-none">
                  <Building2 className="w-28 h-28 text-white" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                  <div>
                    <p className="text-hpv-teal-light text-[10px] font-bold uppercase tracking-widest mb-0.5">HPV Vaccination Program</p>
                    <h1 className="text-xl font-extrabold tracking-tight flex items-baseline gap-2">
                      <span>{block.name}</span>
                      <span className="text-sm font-medium text-slate-300">{block.is_urban ? 'City (Urban)' : 'Block (Rural)'}</span>
                    </h1>
                    <p className="text-slate-300 text-xs mt-0.5">{block.district_name} District · {block.state_name}</p>
                  </div>
                  {profile && profile.base_population > 0 && (
                    <div className="bg-white/25 backdrop-blur-md border border-white/20 rounded-xl px-4 py-2 flex flex-col items-center justify-center shrink-0 self-start sm:self-auto">
                      <span className="text-[8px] uppercase tracking-widest text-slate-300 font-semibold block mb-1">Performance Category</span>
                      <div className="flex items-center gap-2">
                        <img src={`/${catImg}`} alt={catName} className="h-8 object-contain" />
                        <span className="text-sm font-bold text-white tracking-wide">{catName}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Page content slot */}
            {children}

          </div>
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────── */}
        <footer className="bg-white border-t border-slate-200 shrink-0">
          <div className="max-w-5xl mx-auto text-center py-2.5 px-4">
            <div className="font-medium text-[10px] text-slate-400">HPV Vaccination Monitoring Portal • Version: 1.0 • UK 2026</div>
            <div className="flex items-center justify-center gap-1.5 mt-0.5 opacity-70 hover:opacity-100 transition-opacity">
              <span className="text-[10px] font-semibold text-slate-400">Powered by:</span>
              <img src="/impactcode.png" alt="ImpactCode" className="h-3.5 object-contain" />
            </div>
          </div>
        </footer>

        {/* ── CHANGE PASSCODE MODAL ──────────────────────────────── */}
        {showChangePasscodeModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-hpv-purple py-4 px-5 flex items-center justify-between">
                <h2 className="text-white font-bold text-base flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Change Passcode
                </h2>
                <button onClick={() => setShowChangePasscodeModal(false)} className="text-white/70 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleChangePasscode} className="p-5 space-y-3.5">
                {changePasscodeError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold">
                    {changePasscodeError}
                  </div>
                )}
                {[
                  { label: 'Current Passcode', val: currentPasscode, set: setCurrentPasscode, show: showCurrentPasscode, toggle: () => setShowCurrentPasscode(v => !v), color: 'hpv-purple' },
                  { label: 'New 4-Digit Passcode', val: newPasscode, set: (v: string) => setNewPasscode(v.replace(/\D/g, '').slice(0, 4)), show: showNewPasscode, toggle: () => setShowNewPasscode(v => !v), color: 'emerald-500' },
                  { label: 'Re-enter New Passcode', val: confirmNewPasscode, set: (v: string) => setConfirmNewPasscode(v.replace(/\D/g, '').slice(0, 4)), show: showConfirmPasscode, toggle: () => setShowConfirmPasscode(v => !v), color: 'emerald-500' },
                ].map(f => (
                  <div key={f.label} className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{f.label}</label>
                    <div className="relative">
                      <input
                        type={f.show ? 'text' : 'password'}
                        value={f.val}
                        onChange={e => f.set(e.target.value)}
                        maxLength={4}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-lg text-center tracking-widest font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20 transition-all placeholder:text-slate-300"
                        placeholder="••••"
                      />
                      <button type="button" onClick={f.toggle} className="absolute right-3 top-3 text-slate-400 hover:text-hpv-purple transition-colors">
                        {f.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="submit"
                  disabled={isChangingPasscode || !currentPasscode || newPasscode.length !== 4 || confirmNewPasscode.length !== 4}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white gradient-header shadow-lg disabled:opacity-50 hover:shadow-hpv-purple/30 transition-all"
                >
                  {isChangingPasscode ? 'Updating...' : 'Update Passcode'}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </BlockContext.Provider>
  );
};
