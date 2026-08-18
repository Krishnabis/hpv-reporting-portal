import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Building2, Calendar, CheckCircle2, AlertTriangle, ArrowLeft,
  Save, Users, Clock, TrendingUp, Edit2
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
}

interface ProfileData {
  base_population: number;
  population_base_date: string;
  initial_hpv_target: number;
  current_population: number;
  current_hpv_target: number;
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
  const [recentReports, setRecentReports] = useState<ReportData[]>([]);

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

        // If today's report already exists, prepopulate inputs
        if (data.today_report) {
          setLineListInput(String(data.today_report.line_list_count));
          setVaccinatedInput(String(data.today_report.beneficiaries_vaccinated));
        }

        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching block:', err);
        setLoading(false);
      });

    fetch(`/api/reports/block/${blockId}`)
      .then(res => res.json())
      .then(data => setRecentReports(Array.isArray(data) ? data : []))
      .catch(err => console.error('Error fetching reports history:', err));
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-hpv-purple border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!block) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const hasPopulation = profile && profile.base_population > 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Bar — compact, no "Change Block" or "Admin Portal" once in block view */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2 text-right">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-bold text-slate-900 leading-tight">{block.name} Block</p>
              <p className="text-[10px] text-hpv-purple font-semibold">{block.district_name} District</p>
            </div>
            <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${todaySubmitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {todaySubmitted ? '✓ Reported' : '⚠ Pending'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container — compact single-page layout */}
      <main className="max-w-3xl mx-auto w-full px-4 py-4 space-y-4 flex-1">

        {/* Block Hero Card */}
        <div className="gradient-header rounded-2xl p-4 text-white shadow-lg shadow-hpv-purple/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Building2 className="w-24 h-24 text-white" />
          </div>
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div>
              <p className="text-hpv-teal-light text-[10px] font-bold uppercase tracking-widest mb-0.5">
                HPV Vaccination Reporting
              </p>
              <h1 className="text-xl font-extrabold tracking-tight">{block.name} Block</h1>
              <p className="text-slate-300 text-xs mt-0.5">{block.district_name} District · {block.state_name}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 flex items-center gap-2 shrink-0">
              <Clock className="w-5 h-5 text-hpv-pink-light" />
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-300 font-semibold block">Last Report</span>
                <span className="text-sm font-bold text-white font-mono">
                  {lastReport ? lastReport.reporting_date : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Population Setup Section */}
        {!hasPopulation || editingPopulation ? (
          /* FIRST TIME or EDITING: Full setup form */
          <section className="bg-white rounded-2xl p-5 border-2 border-hpv-pink/40 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-hpv-purple" />
              <div>
                <h2 className="text-base font-bold text-slate-900">One-Time Population Setup</h2>
                <p className="text-[11px] text-slate-500">Enter total block population to calculate HPV target (1%)</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="flex gap-3">
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
                {editingPopulation && (
                  <button
                    type="button"
                    onClick={() => setEditingPopulation(false)}
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
          /* ALREADY SET: Compact population info chip */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-hpv-teal-soft flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-hpv-teal-dark" />
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Block Population</p>
                <p className="text-lg font-extrabold text-slate-900 font-mono leading-tight">
                  {profile.base_population.toLocaleString()}
                </p>
              </div>
              <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block" />
              <div className="hidden sm:block">
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">HPV Target (1%)</p>
                <p className="text-lg font-extrabold text-hpv-teal-dark font-mono leading-tight">
                  {profile.current_hpv_target.toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => setEditingPopulation(true)}
              className="text-xs font-semibold text-slate-400 hover:text-hpv-purple flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
          </div>
        )}

        {/* Daily Reporting Section */}
        <section className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-hpv-pink" />
              <div>
                <h2 className="text-base font-bold text-slate-900">Daily Reporting</h2>
                <p className="text-[11px] text-slate-500">Cumulative line list & vaccination count</p>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
              todaySubmitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {todaySubmitted ? `✓ ${todayStr} Submitted` : `⚠ ${todayStr} Pending`}
            </span>
          </div>

          <form onSubmit={handleSaveReport} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {/* Date */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Date *</label>
                <input
                  type="date"
                  value={reportingDate}
                  onChange={e => {
                    setReportingDate(e.target.value);
                    const matched = recentReports.find(r => r.reporting_date === e.target.value);
                    if (matched) {
                      setLineListInput(String(matched.line_list_count));
                      setVaccinatedInput(String(matched.beneficiaries_vaccinated));
                    } else {
                      setLineListInput('');
                      setVaccinatedInput('');
                    }
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                />
              </div>

              {/* Line List */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Line List *</label>
                <input
                  type="number"
                  min="0"
                  value={lineListInput}
                  onChange={e => setLineListInput(e.target.value)}
                  placeholder="—"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                />
              </div>

              {/* Vaccinated */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Vaccinated *</label>
                <input
                  type="number"
                  min="0"
                  value={vaccinatedInput}
                  onChange={e => setVaccinatedInput(e.target.value)}
                  placeholder="—"
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
        </section>

        {/* Recent Submissions — compact table */}
        <section className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-hpv-purple" /> Recent Submissions
          </h3>

          {recentReports.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 font-mono">Date</th>
                    <th className="px-3 py-2 text-right">Line List</th>
                    <th className="px-3 py-2 text-right">Vaccinated</th>
                    <th className="px-3 py-2 text-right">Coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {recentReports.slice(0, 7).map(rep => {
                    const tgt = profile?.current_hpv_target || 1;
                    const coverage = ((rep.beneficiaries_vaccinated / tgt) * 100).toFixed(1);
                    return (
                      <tr key={rep.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold text-slate-900">{rep.reporting_date}</td>
                        <td className="px-3 py-2 text-right">{rep.line_list_count.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-bold text-hpv-purple">{rep.beneficiaries_vaccinated.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="px-1.5 py-0.5 rounded bg-hpv-teal-soft text-hpv-teal-dark font-bold text-[10px]">
                            {coverage}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-400">
              No reports submitted yet for this block.
            </div>
          )}
        </section>

      </main>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto w-full text-center py-2 text-[10px] text-slate-400 px-4">
        Department of Health & Family Welfare · Government of Uttarakhand
        <span className="ml-2 opacity-60">v1.0 · UK 2026</span>
      </footer>
    </div>
  );
};
