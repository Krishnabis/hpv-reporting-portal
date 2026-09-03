import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, CheckCircle2, AlertTriangle, Save, Users,
  Lock, Activity, Bell, Info
} from 'lucide-react';
import { BlockShell, useBlock } from '../components/BlockShell';
import { useSearchParams } from 'react-router-dom';

const BlockReportingContent: React.FC = () => {
  const { blockId, profile, todaySubmitted, lastReport, latestMonthlyReport, refetch } = useBlock();

  const [reportingDate, setReportingDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionsHeldInput, setSessionsHeldInput] = useState('');
  const [vaccinatedInput, setVaccinatedInput] = useState('');
  const [savingReport, setSavingReport] = useState(false);
  const [reportSuccessMsg, setReportSuccessMsg] = useState('');
  const [reportErrorMsg, setReportErrorMsg] = useState('');

  // Population setup states
  const [basePopulationInput, setBasePopulationInput] = useState(
    profile ? String(profile.base_population) : ''
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // Decrement alert
  const [showDecrementAlert, setShowDecrementAlert] = useState(false);
  const [decrementAlertMsg, setDecrementAlertMsg] = useState('');
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  // Info tooltips
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const parsedBasePop = parseInt(basePopulationInput, 10) || 0;
  const hasPopulation = profile && profile.base_population > 0;
  const target = profile ? Math.round(profile.base_population * 0.01) : 0;
  const lastVaccinated = lastReport?.beneficiaries_vaccinated || 0;
  const lastSessions = lastReport?.sessions_held || 0;
  const lineListedCount = (lastReport as any)?.line_list_count ?? 0;
  const vaccinationsPerSession = lastSessions > 0 ? (lastVaccinated / lastSessions).toFixed(1) : '—';

  const formatDateStr = (dateStr: string) => {
    if (!dateStr || dateStr === '—') return '—';
    const d = new Date(dateStr);
    const parts = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).split(' ');
    return `${parts[0]} - ${parts[1]} - ${parts[2]}`;
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedBasePop || parsedBasePop <= 0) { alert('Please enter a valid population'); return; }
    setSavingProfile(true);
    fetch(`/api/blocks/${blockId}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_population: parsedBasePop, population_base_date: todayStr })
    })
      .then(r => r.json())
      .then(data => {
        setSavingProfile(false);
        if (data.error) { alert(data.error); return; }
        setProfileSuccessMsg('Population saved!');
        refetch();
        setTimeout(() => setProfileSuccessMsg(''), 3000);
      })
      .catch(() => { setSavingProfile(false); alert('Failed to save'); });
  };

  const handleRequestUnlock = () => {
    fetch(`/api/blocks/${blockId}/request-unlock`, { method: 'POST' })
      .then(r => r.json())
      .then(data => { if (!data.error) refetch(); });
  };

  const submitReportToApi = (payload: any) => {
    setSavingReport(true); setReportErrorMsg(''); setReportSuccessMsg('');
    fetch(`/api/reports/block/${blockId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(data => {
        setSavingReport(false);
        if (data.error) { setReportErrorMsg(data.error); return; }
        setReportSuccessMsg(`Report for ${payload.reporting_date} saved!`);
        setSessionsHeldInput(''); setVaccinatedInput('');
        refetch();
        setTimeout(() => setReportSuccessMsg(''), 3000);
      })
      .catch(() => { setSavingReport(false); setReportErrorMsg('Failed to save report'); });
  };

  const handleSaveReport = (e: React.FormEvent) => {
    e.preventDefault();
    const sessionsHeld = parseInt(sessionsHeldInput, 10);
    const vaccinated = parseInt(vaccinatedInput, 10);
    if (isNaN(sessionsHeld) || sessionsHeld < 0) { setReportErrorMsg('Enter a valid sessions count'); return; }
    if (isNaN(vaccinated) || vaccinated < 0) { setReportErrorMsg('Enter a valid vaccinated count'); return; }

    const payload = { reporting_date: reportingDate, sessions_held: sessionsHeld, beneficiaries_vaccinated: vaccinated, submitted_by: 'Block Operator' };

    if (lastReport && (sessionsHeld < lastReport.sessions_held || vaccinated < lastReport.beneficiaries_vaccinated)) {
      const dateStr = formatDateStr(lastReport.reporting_date);
      setDecrementAlertMsg(`Current values (Sessions: ${sessionsHeld}, Vaccinated: ${vaccinated}) are less than last submitted (Sessions: ${lastReport.sessions_held}, Vaccinated: ${lastReport.beneficiaries_vaccinated}) on ${dateStr}. Save anyway?`);
      setPendingPayload(payload);
      setShowDecrementAlert(true);
      return;
    }
    submitReportToApi(payload);
  };

  const InfoTooltip: React.FC<{ id: string; text: string }> = ({ id, text }) => (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setActiveTooltip(id)}
        onMouseLeave={() => setActiveTooltip(null)}
        onClick={() => setActiveTooltip(activeTooltip === id ? null : id)}
        className="text-slate-400 hover:text-hpv-purple transition-colors ml-1"
      >
        <Info className="w-3 h-3" />
      </button>
      {activeTooltip === id && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 bg-slate-800 text-white text-[10px] font-medium rounded-xl px-3 py-2 shadow-xl z-50 leading-relaxed">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Population setup / locked chip */}
      {!hasPopulation || (hasPopulation && profile?.is_unlocked) ? (
        <section className="bg-white rounded-2xl p-4 border-2 border-hpv-pink/40 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-hpv-purple" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">One-Time Population Setup</h2>
              <p className="text-[10px] text-slate-500">Enter total block population to calculate HPV target (1%)</p>
            </div>
          </div>
          <form onSubmit={handleSaveProfile} className="flex flex-col sm:flex-row gap-2">
            <input
              type="number" min="1" value={basePopulationInput}
              onChange={e => setBasePopulationInput(e.target.value)}
              placeholder="Enter block population (e.g. 100000)"
              className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
            />
            <button type="submit" disabled={savingProfile || !basePopulationInput}
              className="px-4 py-2.5 rounded-xl font-bold text-xs text-white gradient-header hover:shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0">
              <Save className="w-3.5 h-3.5" />{savingProfile ? 'Saving...' : 'Save'}
            </button>
            {hasPopulation && profile?.is_unlocked && (
              <button type="button" onClick={() => refetch()}
                className="px-3 py-2.5 rounded-xl font-bold text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 shrink-0">Cancel</button>
            )}
          </form>
          {parsedBasePop > 0 && (
            <div className="mt-2 bg-hpv-teal-soft/40 border border-hpv-teal/20 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-hpv-teal-dark font-semibold">Estimated HPV Target (1%)</span>
              <span className="font-mono font-extrabold text-slate-900 text-sm">{Math.round(parsedBasePop * 0.01).toLocaleString('en-IN')}</span>
            </div>
          )}
          {profileSuccessMsg && (
            <div className="mt-2 p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{profileSuccessMsg}
            </div>
          )}
        </section>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">POPULATION</p>
              <p className="text-base font-extrabold text-slate-900 font-mono">{profile.base_population.toLocaleString('en-IN')}</p>
            </div>
            <div className="h-7 w-px bg-slate-200 mx-1 hidden sm:block" />
            <div className="flex items-center gap-1">
              <div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">HPV Target (1%)</p>
                <p className="text-base font-extrabold text-slate-900 font-mono">{Math.round(profile.base_population * 0.01).toLocaleString('en-IN')}</p>
              </div>
              <InfoTooltip id="hpv-target" text="Annual HPV Vaccination Target: 1% of the total population." />
            </div>
          </div>
          {profile.unlock_requested ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 shadow-sm">Unlock Pending...</span>
          ) : (
            <button onClick={handleRequestUnlock}
              className="text-xs font-bold text-slate-600 hover:text-hpv-purple bg-slate-100 hover:bg-hpv-purple-soft border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
              Request Edit Unlock
            </button>
          )}
        </div>
      )}

      {/* Daily Reporting */}
      <section className="bg-white rounded-2xl p-0 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-hpv-purple to-hpv-pink z-10" />
        <div className="bg-hpv-purple-soft/30 px-4 py-2 pt-3 border-b border-slate-200 flex items-center gap-2">
          <div className="w-1 h-4 bg-hpv-purple rounded-full" />
          <h2 className="text-xs font-bold text-hpv-purple-dark uppercase tracking-wider">Daily Reporting</h2>
        </div>
        <div className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-hpv-pink" />
              <p className="text-[11px] text-slate-500">
                <span className="bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded font-bold">Cumulative Count</span>: Total Sessions Held and Eligible Girls Vaccinated
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider self-start sm:self-auto ${todaySubmitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {todaySubmitted
                ? `✓ Submitted: ${formatDateStr(todayStr)}`
                : lastReport ? `⚠ Last: ${formatDateStr(lastReport.reporting_date)}` : `⚠ ${formatDateStr(todayStr)} Pending`}
            </span>
          </div>
          <form onSubmit={handleSaveReport} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-hpv-pink" /> Date *
                </label>
                <input type="date" value={reportingDate}
                  onChange={e => { setReportingDate(e.target.value); setSessionsHeldInput(''); setVaccinatedInput(''); }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Session Held <span className="lowercase italic text-[9px] normal-case">(enter cumulative value)</span>
                </label>
                <input type="number" min="0" value={sessionsHeldInput}
                  onChange={e => setSessionsHeldInput(e.target.value)}
                  placeholder={lastReport ? String(lastReport.sessions_held ?? 0) : '—'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Girls Vaccinated <span className="lowercase italic text-[9px] normal-case">(enter cumulative value)</span>
                </label>
                <input type="number" min="0" value={vaccinatedInput}
                  onChange={e => setVaccinatedInput(e.target.value)}
                  placeholder={lastReport ? String(lastReport.beneficiaries_vaccinated) : '—'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                />
              </div>
            </div>
            {reportErrorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{reportErrorMsg}
              </div>
            )}
            {reportSuccessMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{reportSuccessMsg}
              </div>
            )}
            <button type="submit" disabled={savingReport || !sessionsHeldInput || !vaccinatedInput}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-white gradient-header shadow-md hover:shadow-hpv-purple/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {savingReport ? 'Submitting...' : 'Submit Daily Report'}
            </button>
          </form>
        </div>
      </section>

      {/* Cumulative Progress */}
      {hasPopulation && (
        <section className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-100 pb-2">Cumulative Reporting Progress</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Line Listed */}
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 flex flex-col justify-center items-center text-center">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[9px] uppercase font-bold text-sky-600 leading-tight">Eligible Girls Line Listed</span>
                <InfoTooltip id="line-listed" text="Eligible Girls Line-Listed: Number of eligible girls identified and registered by ASHAs through house-to-house visits, as reported in the Monthly Due List Report, expressed as a percentage of the Annual HPV Vaccination Target." />
              </div>
              <span className="text-2xl font-extrabold font-mono text-sky-700">{target > 0 ? Math.round((lineListedCount / target) * 100) : 0}%</span>
              <span className="text-[9px] font-bold text-sky-700/70 mt-0.5">Count ({lineListedCount.toLocaleString('en-IN')}) From Daily</span>
            </div>
            {/* Vaccinated */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex flex-col justify-center items-center text-center">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[9px] uppercase font-bold text-emerald-600 leading-tight">Eligible Girls Vaccinated</span>
                <InfoTooltip id="vaccinated" text="HPV Vaccination Coverage: Total eligible girls vaccinated, expressed as a percentage of the Annual HPV Vaccination Target." />
              </div>
              <span className="text-2xl font-extrabold font-mono text-emerald-700">{target > 0 ? Math.round((lastVaccinated / target) * 100) : 0}%</span>
              <span className="text-[9px] font-bold text-emerald-700/70 mt-0.5">Count ({lastVaccinated.toLocaleString('en-IN')})</span>
            </div>
            {/* Vaccinations per Session */}
            <div className="bg-hpv-purple-soft border border-hpv-purple/20 rounded-xl p-3 flex flex-col justify-center items-center text-center">
              <span className="text-[9px] uppercase font-bold text-hpv-purple mb-1 leading-tight">Vaccinations per Session</span>
              <span className="text-2xl font-extrabold font-mono text-hpv-purple-dark">{vaccinationsPerSession}</span>
              <span className="text-[9px] font-bold text-hpv-purple-dark/70 mt-0.5">Vaccinated / Session</span>
            </div>
            {/* Session Count */}
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex flex-col justify-center items-center text-center">
              <span className="text-[9px] uppercase font-bold text-amber-600 mb-1 leading-tight">Session Count</span>
              <span className="text-2xl font-extrabold font-mono text-amber-700">{lastSessions.toLocaleString('en-IN')}</span>
              <span className="text-[9px] font-bold text-amber-700/70 mt-0.5">Total Sessions</span>
            </div>
          </div>
        </section>
      )}

      {/* Decrement Alert Modal */}
      {showDecrementAlert && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-hpv-purple/10 py-3 px-4 flex items-center gap-2 border-b border-hpv-purple/20">
              <div className="bg-rose-100 p-1.5 rounded-full"><Bell className="w-4 h-4 text-rose-600" /></div>
              <h2 className="text-sm font-bold text-hpv-purple">Alert</h2>
            </div>
            <div className="p-5 text-sm text-slate-700 font-medium">{decrementAlertMsg}</div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={() => { setShowDecrementAlert(false); setPendingPayload(null); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={() => { setShowDecrementAlert(false); if (pendingPayload) { submitReportToApi(pendingPayload); setPendingPayload(null); } }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-hpv-purple text-white hover:bg-hpv-purple-dark transition-colors shadow-md">Yes, Save It</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const BlockReporting: React.FC = () => {
  const [searchParams] = useSearchParams();
  const blockId = searchParams.get('blockId') || '';
  return (
    <BlockShell currentPage="daily">
      <BlockReportingContent />
    </BlockShell>
  );
};
