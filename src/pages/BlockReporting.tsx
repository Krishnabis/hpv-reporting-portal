import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Building2, Calendar, CheckCircle2, AlertTriangle, ArrowLeft, 
  Save, Calculator, Info, Clock, Hash, TrendingUp, Users, Check
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

  // Daily Reporting Form State
  const [reportingDate, setReportingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [lineListInput, setLineListInput] = useState<string>('');
  const [vaccinatedInput, setVaccinatedInput] = useState<string>('');
  const [savingReport, setSavingReport] = useState(false);
  const [reportSuccessMsg, setReportSuccessMsg] = useState('');
  const [reportErrorMsg, setReportErrorMsg] = useState('');

  // Fetch block info & reporting status
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

    // Fetch history
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

  // Live calculation of initial target from base population input
  const parsedBasePop = parseInt(basePopulationInput, 10) || 0;
  const computedTarget = Math.round(parsedBasePop * 0.01);

  // Handle One-Time Profile Save
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
          setProfileSuccessMsg('One-time baseline population saved successfully!');
          fetchBlockDetails();
          setTimeout(() => setProfileSuccessMsg(''), 4000);
        }
      })
      .catch(err => {
        console.error(err);
        setSavingProfile(false);
        alert('Failed to save profile');
      });
  };

  // Handle Daily Report Save
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
          setReportSuccessMsg(`Daily report for ${reportingDate} saved successfully!`);
          fetchBlockDetails();
          setTimeout(() => setReportSuccessMsg(''), 4000);
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
          <p className="text-sm font-semibold text-slate-600">Loading block reporting profile...</p>
        </div>
      </div>
    );
  }

  if (!block) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-hpv-purple px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Change Block
          </button>

          <Logo size="sm" />

          <a
            href="/admin/login"
            className="text-xs font-semibold text-hpv-purple hover:text-hpv-purple-dark px-2.5 py-1.5 rounded-lg bg-hpv-purple-soft"
          >
            Admin Portal
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Block Header Card */}
        <div className="gradient-header rounded-3xl p-6 text-white shadow-xl shadow-hpv-purple/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Building2 className="w-48 h-48 text-white" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 text-hpv-teal-light text-xs font-semibold uppercase tracking-wider mb-1">
                <span>HPV Vaccination Reporting</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {block.name} Block
              </h1>

              <p className="text-slate-300 text-sm mt-1 flex items-center gap-2">
                <span>{block.district_name} District, {block.state_name}</span>
              </p>
            </div>

            {/* Last Reported Badge */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex items-center gap-3 shrink-0">
              <Clock className="w-8 h-8 text-hpv-pink-light" />
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold block">
                  Last Reported Date
                </span>
                <span className="text-base font-bold text-white font-mono">
                  {lastReport ? lastReport.reporting_date : 'Never Reported'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Status Banner */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-colors ${
          todaySubmitted
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center gap-3">
            {todaySubmitted ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            )}
            <div>
              <p className="font-bold text-sm">
                {todaySubmitted
                  ? `✓ Today's report (${todayStr}) is submitted`
                  : `⚠ Today's report (${todayStr}) is pending submission`}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {profile
                  ? 'One-time baseline population setup is completed.'
                  : 'Action needed: Please complete the one-time population setup below.'}
              </p>
            </div>
          </div>

          <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shrink-0 ${
            profile ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {profile ? '✓ Setup Done' : '⚠ Setup Needed'}
          </span>
        </div>

        {/* Section 3.1: One Time Reporting */}
        <section className={`bg-white rounded-3xl p-6 border shadow-sm transition-all ${
          !profile ? 'ring-2 ring-hpv-pink/40 border-hpv-pink' : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-hpv-purple" />
                <h2 className="text-lg font-bold text-slate-900">1. One Time Reporting</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Enter total block population. Estimated HPV target population (1%) is automatically calculated.
              </p>
            </div>

            {profile && (
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Baseline Saved
              </span>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Population Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Block Population <span className="text-hpv-pink">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={basePopulationInput}
                    onChange={e => setBasePopulationInput(e.target.value)}
                    placeholder="e.g. 100000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                  />
                  <span className="absolute right-3 top-3.5 text-xs text-slate-400 font-semibold">
                    Beneficiaries
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Total population of block as per census baseline.
                </span>
              </div>

              {/* Calculated Target Display */}
              <div className="bg-hpv-teal-soft/40 border border-hpv-teal/30 rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-hpv-teal-dark flex items-center gap-1">
                    <Calculator className="w-4 h-4" /> Estimated HPV Target Population
                  </span>
                  <span className="text-xs font-bold text-hpv-teal-dark bg-white/80 px-2 py-0.5 rounded border border-hpv-teal/20">
                    Auto calculated (1%)
                  </span>
                </div>

                <div className="my-2">
                  <span className="text-3xl font-extrabold font-mono text-slate-900">
                    {computedTarget.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-500 ml-2">beneficiaries (1% of population)</span>
                </div>

                {profile && (
                  <div className="text-[11px] text-slate-600 bg-white/60 p-2 rounded-lg border border-slate-200/60 flex items-center justify-between">
                    <span>Adjusted for 0.08% monthly growth:</span>
                    <span className="font-bold font-mono text-hpv-purple">
                      Current Target: {profile.current_hpv_target.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {profileSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {profileSuccessMsg}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Growth formula: Population increases by 0.08% every month automatically.</span>
              </div>

              <button
                type="submit"
                disabled={savingProfile || !basePopulationInput}
                className="px-6 py-2.5 rounded-xl font-bold text-sm text-white gradient-header hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingProfile ? 'Saving Profile...' : profile ? 'Update Baseline' : 'Save One-Time Setup'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Section 4: Daily Reporting */}
        <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-hpv-pink" />
                <h2 className="text-lg font-bold text-slate-900">2. Daily Reporting</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Enter cumulative line list and cumulative vaccination count for the reporting date.
              </p>
            </div>

            <span className="text-xs font-semibold px-2.5 py-1 bg-hpv-pink-soft text-hpv-pink-dark rounded-lg">
              Cumulative Snapshots
            </span>
          </div>

          <form onSubmit={handleSaveReport} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Field 1: Reporting Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Reporting Date <span className="text-hpv-pink">*</span>
                </label>
                <input
                  type="date"
                  value={reportingDate}
                  onChange={e => {
                    setReportingDate(e.target.value);
                    // Check if report exists for selected date
                    const matched = recentReports.find(r => r.reporting_date === e.target.value);
                    if (matched) {
                      setLineListInput(String(matched.line_list_count));
                      setVaccinatedInput(String(matched.beneficiaries_vaccinated));
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                />
              </div>

              {/* Field 2: Cumulative Line List Count */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Line List Count <span className="text-hpv-pink">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={lineListInput}
                  onChange={e => setLineListInput(e.target.value)}
                  placeholder="e.g. 750"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                />
                <span className="text-[11px] text-slate-400">Total cumulative line list entries as of date.</span>
              </div>

              {/* Field 3: Beneficiaries Vaccinated */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  No. Vaccinated <span className="text-hpv-pink">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={vaccinatedInput}
                  onChange={e => setVaccinatedInput(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                />
                <span className="text-[11px] text-slate-400">Total cumulative vaccinated as of date.</span>
              </div>
            </div>

            {/* Error and Success Alerts */}
            {reportErrorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                {reportErrorMsg}
              </div>
            )}

            {reportSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {reportSuccessMsg}
              </div>
            )}

            {/* Submit Action */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 w-full sm:w-auto">
                💡 <span className="font-semibold">Cumulative Data Policy:</span> Submitting today replaces today's snapshot. Previous days are preserved.
              </div>

              <button
                type="submit"
                disabled={savingReport || !lineListInput || !vaccinatedInput}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-white gradient-header shadow-lg hover:shadow-hpv-purple/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-hpv-pink-light" />
                <span>{savingReport ? 'Submitting Report...' : 'Submit Daily Report'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Section: Historical Submissions Table */}
        <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-hpv-purple" /> Recent Submissions History
          </h3>

          {recentReports.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-mono">Date</th>
                    <th className="p-3 text-right">Line List Count</th>
                    <th className="p-3 text-right">Beneficiaries Vaccinated</th>
                    <th className="p-3 text-right">Coverage %</th>
                    <th className="p-3 text-right">Submitted At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {recentReports.map(rep => {
                    const tgt = profile?.current_hpv_target || 1;
                    const coverage = ((rep.beneficiaries_vaccinated / tgt) * 100).toFixed(1);
                    return (
                      <tr key={rep.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{rep.reporting_date}</td>
                        <td className="p-3 text-right font-medium">{rep.line_list_count.toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-hpv-purple">{rep.beneficiaries_vaccinated.toLocaleString()}</td>
                        <td className="p-3 text-right">
                          <span className="px-2 py-0.5 rounded bg-hpv-teal-soft text-hpv-teal-dark font-bold">
                            {coverage}%
                          </span>
                        </td>
                        <td className="p-3 text-right text-slate-400 font-sans text-[11px]">
                          {new Date(rep.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-400">
              No historical reports submitted yet for this block.
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
