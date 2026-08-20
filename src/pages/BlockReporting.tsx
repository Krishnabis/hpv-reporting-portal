import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Building2, Calendar, CheckCircle2, AlertTriangle,
  Save, Users, Clock, Lock, Activity, X
} from 'lucide-react';
import { Logo } from '../components/Logo';

interface BlockData {
  id: number;
  name: string;
  lgd_code: number;
  district_name: string;
  district_lgd_code: number;
  state_name: string;
  state_lgd_code: number;
  is_urban?: boolean;
}

interface ProfileData {
  base_population: number;
  population_base_date: string;
  initial_hpv_target: number;
  current_population: number;
  current_hpv_target: number;
  is_unlocked?: boolean;
}

interface ReportData {
  id: string;
  reporting_date: string;
  line_list_count: number;
  beneficiaries_vaccinated: number;
  submitted_at: string;
}

export const BlockReporting: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const blockId = searchParams.get('blockId');

  const [loading, setLoading] = useState(true);
  const [block, setBlock] = useState<BlockData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [todaySubmitted, setTodaySubmitted] = useState(false);
  const [lastReport, setLastReport] = useState<ReportData | null>(null);


  // One Time Form State
  const [basePopulationInput, setBasePopulationInput] = useState<string>('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [editingPopulation, setEditingPopulation] = useState(false);

  // Daily Reporting Form State
  const [reportingDate, setReportingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [lineListInput, setLineListInput] = useState<string>('');
  const [vaccinatedInput, setVaccinatedInput] = useState<string>('');
  const [savingReport, setSavingReport] = useState(false);
  const [reportSuccessMsg, setReportSuccessMsg] = useState('');
  const [reportErrorMsg, setReportErrorMsg] = useState('');

  const fetchBlockDetails = () => {
    if (!blockId) return;
    setLoading(true);

    fetch(`/api/blocks/${blockId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert('Block not found');
          navigate('/');
          return;
        }
        setBlock(data.block);
        setProfile(data.profile);
        setTodaySubmitted(data.today_submitted);
        setLastReport(data.last_report);

        if (data.profile) {
          setBasePopulationInput(String(data.profile.base_population));
        }

        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching block:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!blockId) {
      navigate('/');
      return;
    }
    fetchBlockDetails();
  }, [blockId]);

  const parsedBasePop = parseInt(basePopulationInput, 10) || 0;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedBasePop || parsedBasePop <= 0) {
      alert('Please enter a valid positive block population');
      return;
    }

    setSavingProfile(true);
    setProfileSuccessMsg('');

    fetch(`/api/blocks/${blockId}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_population: parsedBasePop,
        population_base_date: new Date().toISOString().split('T')[0]
      })
    })
      .then(res => res.json())
      .then(data => {
        setSavingProfile(false);
        if (data.error) {
          alert(data.error);
        } else {
          setProfileSuccessMsg('Population saved successfully!');
          setEditingPopulation(false);
          fetchBlockDetails();
          setTimeout(() => setProfileSuccessMsg(''), 3000);
        }
      })
      .catch(err => {
        console.error(err);
        setSavingProfile(false);
        alert('Failed to save profile');
      });
  };

  const handleRequestUnlock = () => {
    fetch(`/api/blocks/${blockId}/request-unlock`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          fetchBlockDetails();
        }
      })
      .catch(err => console.error(err));
  };

  const handleSaveReport = (e: React.FormEvent) => {
    e.preventDefault();
    const lineList = parseInt(lineListInput, 10);
    const vaccinated = parseInt(vaccinatedInput, 10);

    if (isNaN(lineList) || lineList < 0) {
      setReportErrorMsg('Please enter a valid line list count');
      return;
    }
    if (isNaN(vaccinated) || vaccinated < 0) {
      setReportErrorMsg('Please enter a valid beneficiaries vaccinated count');
      return;
    }
    if (vaccinated > lineList) {
      setReportErrorMsg('Beneficiaries vaccinated cannot exceed total line list count');
      return;
    }

    setSavingReport(true);
    setReportErrorMsg('');
    setReportSuccessMsg('');

    fetch(`/api/reports/block/${blockId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reporting_date: reportingDate,
        line_list_count: lineList,
        beneficiaries_vaccinated: vaccinated,
        submitted_by: 'Block Operator'
      })
    })
      .then(res => res.json())
      .then(data => {
        setSavingReport(false);
        if (data.error) {
          setReportErrorMsg(data.error);
        } else {
          setReportSuccessMsg(`Report for ${reportingDate} saved!`);
          fetchBlockDetails();
          setTimeout(() => setReportSuccessMsg(''), 3000);
        }
      })
      .catch(err => {
        console.error(err);
        setSavingReport(false);
        setReportErrorMsg('Failed to save daily report');
      });
  };

  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-slate-50 flex items-center justify-center p-6 overflow-hidden">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-hpv-purple border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!block) return null;

  const formatDateStr = (dateStr: string) => {
    if (!dateStr || dateStr === '—') return '—';
    const d = new Date(dateStr);
    const parts = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).split(' ');
    return `${parts[0]} - ${parts[1]} - ${parts[2]}`;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const hasPopulation = profile && profile.base_population > 0;
  const requirePopulationSetup = !hasPopulation;
  
  const target = profile ? Math.round(profile.base_population * 0.01) : 0;
  const lastVaccinated = lastReport?.beneficiaries_vaccinated || 0;
  const lastLineList = lastReport?.line_list_count || 0;
  
  let perfPercentage = 0;
  if (target > 0) {
    perfPercentage = (lastVaccinated / target) * 100;
  }
  let catImg = 'cat1.png';
  let catName = 'Aspirational';
  if (perfPercentage >= 90) { catImg = 'cat4.png'; catName = 'Champions'; }
  else if (perfPercentage >= 70) { catImg = 'cat3.png'; catName = 'High-Performing'; }
  else if (perfPercentage >= 30) { catImg = 'cat2.png'; catName = 'Progressing'; }

  return (
    <div className="h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden">
      {/* Header Bar — compact, no "Change Block" or "Admin Portal" once in block view */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center relative min-h-[60px]">
          <div className="cursor-pointer flex items-center gap-3" onClick={() => navigate('/')}>
            <img src="/headinglogo.png" alt="Logo" className="h-10 object-contain hover:opacity-80 transition-opacity" />
            <span className="text-slate-500 italic text-sm font-semibold hidden sm:inline-block">Track | Protect | Eliminate</span>
          </div>
        </div>
      </header>

      {/* Main Container — compact single-page layout */}
      <main className="max-w-3xl mx-auto w-full px-4 py-2 space-y-2 flex-1 overflow-y-auto min-h-0">

        {/* Block Hero Card */}
        <div className="gradient-header rounded-2xl p-3 text-white shadow-lg shadow-hpv-purple/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Building2 className="w-24 h-24 text-white" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div>
              <p className="text-hpv-teal-light text-[10px] font-bold uppercase tracking-widest mb-0.5">
                HPV Vaccination Program
              </p>
              <h1 className="text-xl font-extrabold tracking-tight flex items-baseline gap-2">
                <span>{block.name}</span>
                <span className="text-sm font-medium text-slate-300">{block.is_urban ? 'City (Urban)' : 'Block (Rural)'}</span>
              </h1>
              <p className="text-slate-300 text-xs mt-0.5">{block.district_name} District · {block.state_name}</p>
            </div>
            {hasPopulation && (
              <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0 self-start sm:self-auto">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-2 flex flex-col items-center justify-center">
                  <span className="text-[8px] uppercase tracking-widest text-slate-300 font-semibold block mb-1">Performance Category</span>
                  <div className="flex items-center gap-2">
                    <img src={`/${catImg}`} alt={catName} className="h-8 object-contain" />
                    <span className="text-sm font-bold text-white tracking-wide">{catName}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Population Setup Section */}
        {!hasPopulation || (hasPopulation && profile?.is_unlocked) ? (
          /* FIRST TIME or EDITING: Full setup form */
          <section className="bg-white rounded-2xl p-3 border-2 border-hpv-pink/40 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-hpv-purple" />
              <div>
                <h2 className="text-base font-bold text-slate-900">One-Time Population Setup</h2>
                <p className="text-[11px] text-slate-500">Enter total block population to calculate HPV target (1%)</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    min="1"
                    value={basePopulationInput}
                    onChange={e => setBasePopulationInput(e.target.value)}
                    placeholder="Enter block population (e.g. 100000)"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingProfile || !basePopulationInput}
                  className="px-5 py-3 rounded-xl font-bold text-sm text-white gradient-header hover:shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                >
                  <Save className="w-4 h-4" />
                  {savingProfile ? 'Saving...' : 'Save'}
                </button>
                {hasPopulation && profile?.is_unlocked && (
                  <button
                    type="button"
                    onClick={() => {
                      setBasePopulationInput(profile.base_population.toString());
                      setEditingPopulation(false);
                      // the UI will not hide form unless we reset is_unlocked locally or reload
                      fetchBlockDetails();
                    }}
                    className="px-4 py-3 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all shrink-0"
                  >
                    Cancel
                  </button>
                )}
              </div>
              {parsedBasePop > 0 && (
                <div className="bg-hpv-teal-soft/40 border border-hpv-teal/20 rounded-xl px-4 py-2 flex items-center justify-between">
                  <span className="text-xs text-hpv-teal-dark font-semibold">Estimated HPV Target (1%)</span>
                  <span className="font-mono font-extrabold text-slate-900 text-base">{Math.round(parsedBasePop * 0.01).toLocaleString()}</span>
                </div>
              )}
              {profileSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {profileSuccessMsg}
                </div>
              )}
            </form>
          </section>
        ) : (
          /* ALREADY SET & LOCKED: Compact population info chip */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-slate-400" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">{block.is_urban ? 'City (Urban)' : 'Block (Rural)'} Population</p>
                <p className="text-lg font-extrabold text-slate-900 font-mono leading-tight">
                  {profile.base_population.toLocaleString()}
                </p>
              </div>
              <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block" />
              <div className="hidden sm:block">
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">HPV Target (1%)</p>
                <p className="text-lg font-extrabold text-slate-900 font-mono leading-tight">
                  {Math.round(profile.base_population * 0.01).toLocaleString()}
                </p>
              </div>
            </div>
            {profile.unlock_requested ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 shadow-sm">
                Unlock Pending...
              </span>
            ) : (
              <button
                onClick={handleRequestUnlock}
                className="text-xs font-bold text-slate-600 hover:text-hpv-purple bg-slate-100 hover:bg-hpv-purple-soft border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
              >
                Request Edit Unlock
              </button>
            )}
          </div>
        )}

        {/* Daily Reporting Section */}
        <section className="bg-white rounded-2xl p-0 border border-slate-200 shadow-sm overflow-hidden mt-6">
          <div className="bg-hpv-purple-soft/30 px-3 py-2 border-b border-slate-200 flex items-center gap-2">
            <div className="w-1 h-4 bg-hpv-purple rounded-full"></div>
            <h2 className="text-sm font-bold text-hpv-purple-dark uppercase tracking-wider">Daily Reporting</h2>
          </div>
          <div className="p-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
              <div className="flex items-center gap-2 mb-2 sm:mb-0">
                <Calendar className="w-5 h-5 text-hpv-pink" />
                <div>
                  <p className="text-[11px] text-slate-500"><span className="bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded font-bold">Eligible Girls</span>: Line Listed & Vaccinated (Cumulative Count)</p>
                </div>
              </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider self-start sm:self-auto ${
              todaySubmitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {todaySubmitted 
                ? `✓ last submitted on: ${formatDateStr(todayStr)}` 
                : (lastReport ? `⚠ last submitted on: ${formatDateStr(lastReport.reporting_date)}` : `⚠ ${formatDateStr(todayStr)} Pending`)}
            </span>
          </div>

          <form onSubmit={handleSaveReport} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Date */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Date *</label>
                <input
                  type="date"
                  value={reportingDate}
                  onChange={e => {
                    setReportingDate(e.target.value);
                    setLineListInput('');
                    setVaccinatedInput('');
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                />
              </div>

              {/* Line List */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Line listed <span className="lowercase italic text-[9px] normal-case">(enter cumulative data)</span></label>
                <input
                  type="number"
                  min="0"
                  value={lineListInput}
                  onChange={e => setLineListInput(e.target.value)}
                  placeholder={lastReport ? lastReport.line_list_count.toString() : "—"}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                />
              </div>

              {/* Vaccinated */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Vaccinated <span className="lowercase italic text-[9px] normal-case">(enter cumulative data)</span></label>
                <input
                  type="number"
                  min="0"
                  value={vaccinatedInput}
                  onChange={e => setVaccinatedInput(e.target.value)}
                  placeholder={lastReport ? lastReport.beneficiaries_vaccinated.toString() : "—"}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                />
              </div>
            </div>

            {/* Alerts */}
            {reportErrorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                {reportErrorMsg}
              </div>
            )}
            {reportSuccessMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {reportSuccessMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={savingReport || !lineListInput || !vaccinatedInput}
              className="w-full py-3 rounded-xl font-bold text-sm text-white gradient-header shadow-md hover:shadow-hpv-purple/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingReport ? 'Submitting...' : 'Submit Daily Report'}
            </button>
          </form>
          </div>
        </section>

        {/* Progress Box */}
        {hasPopulation && (
          <section className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold text-slate-900">Cumulative Reporting Progress</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 flex flex-col justify-center items-center text-center relative overflow-hidden">
                <span className="text-[10px] uppercase font-bold text-sky-600 mb-1 z-10">Eligible Girls Line Listed</span>
                <span className="text-2xl font-extrabold font-mono text-sky-700 leading-tight z-10">{target > 0 ? Math.round((lastLineList / target) * 100) : 0}%</span>
                <span className="text-[10px] font-bold text-sky-700/70 mt-1 z-10">Count ({lastLineList.toLocaleString()})</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex flex-col justify-center items-center text-center relative overflow-hidden">
                <span className="text-[10px] uppercase font-bold text-emerald-600 mb-1 z-10">Eligible Girls Vaccinated</span>
                <span className="text-2xl font-extrabold font-mono text-emerald-700 leading-tight z-10">{target > 0 ? Math.round((lastVaccinated / target) * 100) : 0}%</span>
                <span className="text-[10px] font-bold text-emerald-700/70 mt-1 z-10">Count ({lastVaccinated.toLocaleString()})</span>
              </div>
              <div 
                onClick={() => navigate('/progress-trend?blockId=' + blockId)}
                className="bg-hpv-purple-soft/30 hover:bg-hpv-purple-soft/70 border border-hpv-purple/20 rounded-xl p-3 flex flex-col justify-center items-center text-center cursor-pointer transition-colors"
              >
                <Activity className="w-6 h-6 text-hpv-purple mb-2" />
                <span className="text-xs font-bold text-hpv-purple uppercase tracking-wider">Click to view<br/>progress trends</span>
              </div>
            </div>
          </section>
        )}


      </main>

      <footer className="max-w-3xl mx-auto w-full text-center py-4 text-xs text-slate-400 px-4 space-y-2">
        <div className="font-medium text-[11px] sm:text-xs">HPV Vaccination Program • Version: 1.0 • UK 2026</div>
        <div className="flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-400">Powered by:</span>
          <img src="/impactcode.png" alt="ImpactCode" className="h-8 object-contain" />
        </div>
      </footer>

    </div>
  );
};
