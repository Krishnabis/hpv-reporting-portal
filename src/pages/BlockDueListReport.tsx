import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Lock, X, Info, ChevronRight, ChevronLeft, CheckCircle2, AlertTriangle, FileText, Bell
} from 'lucide-react';
import { BlockShell, useBlock } from '../components/BlockShell';

interface PastReport {
  id: string; reporting_month: string; submitted_at: string;
  asha_reporting_pct: number; hpv_coverage_pct: number;
}
interface FullReport {
  id: string; reporting_month: string;
  block_incharge_name: string; block_incharge_mobile: string;
  facilities_manager_name: string; facilities_manager_mobile: string;
  total_afs: number; total_ashas: number; ashas_reporting: number; asha_reporting_pct: number;
  new_girls_registered: number; girls_turned_14: number; total_eligible_girls: number;
  eligible_girls_vaccinated: number; eligible_girls_pending: number;
  hesitancy_count: number; distance_count: number; others_count: number;
  girls_turning_15_next_month: number; girls_turning_15_yet_to_vaccinate: number;
  hpv_coverage_pct: number; age_out_risk_pct: number; hesitancy_pct: number; submitted_at: string;
}

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; tip?: string }> = ({ label, value, onChange, type = 'text', placeholder, tip }) => {
  const [showTip, setShowTip] = useState(false);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-none">{label}</label>
        {tip && (
          <div className="relative">
            <button onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)} className="text-slate-300 hover:text-hpv-purple transition-colors">
              <Info className="w-2.5 h-2.5" />
            </button>
            {showTip && (
              <div className="absolute bottom-full left-0 mb-1 w-48 bg-slate-800 text-white text-[9px] font-medium rounded-lg px-2 py-1.5 shadow-xl z-50 leading-relaxed">
                {tip}<div className="absolute top-full left-3 border-[3px] border-transparent border-t-slate-800" />
              </div>
            )}
          </div>
        )}
      </div>
      <input type={type} min={type === 'number' ? '0' : undefined} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || '—'}
        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-hpv-purple focus:ring-1 focus:ring-hpv-purple/20 transition-all placeholder:text-slate-300 placeholder:font-normal"
      />
    </div>
  );
};

const DueListContent: React.FC = () => {
  const { blockId, lastReport } = useBlock();
  const [pastReports, setPastReports] = useState<PastReport[]>([]);
  const [viewingReport, setViewingReport] = useState<FullReport | null>(null);
  const [loadingPast, setLoadingPast] = useState(false);

  // Section A
  const [reportingMonth, setReportingMonth] = useState('');
  const [blockInchargeName, setBlockInchargeName] = useState('');
  const [blockInchargeMobile, setBlockInchargeMobile] = useState('');
  const [facilitiesManagerName, setFacilitiesManagerName] = useState('');
  const [facilitiesManagerMobile, setFacilitiesManagerMobile] = useState('');
  const [totalAfs, setTotalAfs] = useState('');
  const [totalAshas, setTotalAshas] = useState('');
  const [ashasReporting, setAshasReporting] = useState('');
  // Section B
  const [newGirlsRegistered, setNewGirlsRegistered] = useState('');
  const [girlsTurned14, setGirlsTurned14] = useState('');
  const [totalEligibleGirls, setTotalEligibleGirls] = useState('');
  const [eligibleGirlsVaccinated, setEligibleGirlsVaccinated] = useState('');
  const [hesitancyCount, setHesitancyCount] = useState('');
  const [distanceCount, setDistanceCount] = useState('');
  const [girlsTurning15Next, setGirlsTurning15Next] = useState('');
  const [girlsTurning15YetToVaccinate, setGirlsTurning15YetToVaccinate] = useState('');
  // UI
  const [currentStep, setCurrentStep] = useState<'list' | 'A' | 'B' | 'C'>('list');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);

  useEffect(() => { fetchMeta(); fetchPastReports(); }, [blockId]);

  const fetchMeta = async () => {
    const res = await fetch(`/api/due-list/meta/${blockId}`);
    const data = await res.json();
    if (data) {
      setBlockInchargeName(data.block_incharge_name || '');
      setBlockInchargeMobile(data.block_incharge_mobile || '');
      setFacilitiesManagerName(data.facilities_manager_name || '');
      setFacilitiesManagerMobile(data.facilities_manager_mobile || '');
      setTotalAfs(data.total_afs ? String(data.total_afs) : '');
      setTotalAshas(data.total_ashas ? String(data.total_ashas) : '');
    }
  };

  const fetchPastReports = async () => {
    setLoadingPast(true);
    const res = await fetch(`/api/due-list/list/${blockId}`);
    const data = await res.json();
    setPastReports(Array.isArray(data) ? data : []);
    setLoadingPast(false);
  };

  const fetchReportForMonth = async (month: string): Promise<FullReport | null> => {
    const res = await fetch(`/api/due-list/${blockId}?month=${month}`);
    return res.json();
  };

  const isMonthEditable = (month: string) => {
    const [yr, mo] = month.split('-').map(Number);
    return new Date() < new Date(yr, mo, 9);
  };

  const handleStartNew = () => {
    const now = new Date();
    const prev = now.getMonth() === 0 ? `${now.getFullYear() - 1}-12` : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
    setReportingMonth(prev);
    setNewGirlsRegistered(''); setGirlsTurned14(''); setTotalEligibleGirls('');
    setEligibleGirlsVaccinated(''); setHesitancyCount(''); setDistanceCount('');
    setGirlsTurning15Next(''); setGirlsTurning15YetToVaccinate(''); setAshasReporting('');
    setSubmitError(''); setSubmitSuccess('');
    setCurrentStep('A');
  };

  const handleEdit = async (report: PastReport) => {
    const full = await fetchReportForMonth(report.reporting_month);
    if (!full) return;
    setReportingMonth(full.reporting_month);
    setBlockInchargeName(full.block_incharge_name || ''); setBlockInchargeMobile(full.block_incharge_mobile || '');
    setFacilitiesManagerName(full.facilities_manager_name || ''); setFacilitiesManagerMobile(full.facilities_manager_mobile || '');
    setTotalAfs(String(full.total_afs || '')); setTotalAshas(String(full.total_ashas || ''));
    setAshasReporting(String(full.ashas_reporting || '')); setNewGirlsRegistered(String(full.new_girls_registered || ''));
    setGirlsTurned14(String(full.girls_turned_14 || '')); setTotalEligibleGirls(String(full.total_eligible_girls || ''));
    setEligibleGirlsVaccinated(String(full.eligible_girls_vaccinated || ''));
    setHesitancyCount(String(full.hesitancy_count || '')); setDistanceCount(String(full.distance_count || ''));
    setGirlsTurning15Next(String(full.girls_turning_15_next_month || '')); setGirlsTurning15YetToVaccinate(String(full.girls_turning_15_yet_to_vaccinate || ''));
    setCurrentStep('A');
  };

  const handleSubmit = async () => {
    setSubmitting(true); setSubmitError(''); setSubmitSuccess('');
    
    const totalDailyVaccinated = lastReport?.beneficiaries_vaccinated || 0;
    if (Number(totalEligibleGirls) < totalDailyVaccinated) {
      setSubmitError(`Line Listed Eligible Girls (${Number(totalEligibleGirls)}) cannot be less than Total Vaccinated Girls in daily reports (${totalDailyVaccinated}).`);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/due-list/${blockId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporting_month: reportingMonth, block_incharge_name: blockInchargeName, block_incharge_mobile: blockInchargeMobile,
          facilities_manager_name: facilitiesManagerName, facilities_manager_mobile: facilitiesManagerMobile,
          total_afs: Number(totalAfs) || 0, total_ashas: Number(totalAshas) || 0, ashas_reporting: Number(ashasReporting) || 0,
          new_girls_registered: Number(newGirlsRegistered) || 0, girls_turned_14: Number(girlsTurned14) || 0,
          total_eligible_girls: Number(totalEligibleGirls) || 0, eligible_girls_vaccinated: Number(eligibleGirlsVaccinated) || 0,
          hesitancy_count: Number(hesitancyCount) || 0, distance_count: Number(distanceCount) || 0,
          girls_turning_15_next_month: Number(girlsTurning15Next) || 0, girls_turning_15_yet_to_vaccinate: Number(girlsTurning15YetToVaccinate) || 0,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitSuccess('Report submitted successfully!');
      await fetchPastReports();
      setTimeout(() => { setSubmitSuccess(''); setCurrentStep('list'); }, 2000);
    } catch (err: any) { setSubmitError(err.message); }
    setSubmitting(false);
  };

  const fmtMonth = (ym: string) => {
    if (!ym) return '';
    const [yr, mo] = ym.split('-');
    return new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const ashaReportingPct = Number(totalAshas) > 0 ? ((Number(ashasReporting) / Number(totalAshas)) * 100).toFixed(1) : '0.0';
  const eligiblePending = Math.max(0, Number(totalEligibleGirls) - Number(eligibleGirlsVaccinated));
  const hpvCoverage = Number(totalEligibleGirls) > 0 ? ((Number(eligibleGirlsVaccinated) / Number(totalEligibleGirls)) * 100).toFixed(1) : '0.0';
  const ageOutRisk = Number(girlsTurning15Next) > 0 ? ((Number(girlsTurning15YetToVaccinate) / Number(girlsTurning15Next)) * 100).toFixed(1) : '0.0';
  const hesitancyPct = Number(totalEligibleGirls) > 0 ? ((Number(hesitancyCount) / Number(totalEligibleGirls)) * 100).toFixed(1) : '0.0';

  const StepTabs = () => (
    <div className="flex rounded-xl overflow-hidden border border-slate-200 mb-3">
      {(['A', 'B', 'C'] as const).map((s, i) => {
        const order = ['A', 'B', 'C'];
        const isActive = currentStep === s, isDone = order.indexOf(currentStep) > i;
        return (
          <div key={s} className={`flex-1 py-1.5 text-center text-[10px] font-bold ${isActive ? 'bg-hpv-purple text-white' : isDone ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400 bg-white'}`}>
            {s === 'A' ? 'A. Reporting' : s === 'B' ? 'B. Due List' : 'C. Summary'}
          </div>
        );
      })}
    </div>
  );

  const NavBtns = ({ onBack, onNext, nextLabel = 'Next', nextDisabled = false }: any) => (
    <div className="flex gap-2 mt-3">
      {onBack && <button onClick={onBack} className="flex-1 py-2 rounded-xl font-bold text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all flex items-center justify-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Back</button>}
      <button onClick={onNext} disabled={nextDisabled} className="flex-1 py-2 rounded-xl font-bold text-xs text-white gradient-header shadow-sm disabled:opacity-50 flex items-center justify-center gap-1">{nextLabel} <ChevronRight className="w-3.5 h-3.5" /></button>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Page title */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-extrabold text-slate-900">Monthly Due List Report</h2>
            <div className="relative">
              <button onMouseEnter={() => setShowInfoTooltip(true)} onMouseLeave={() => setShowInfoTooltip(false)} className="text-slate-400 hover:text-hpv-purple transition-colors">
                <Info className="w-3.5 h-3.5" />
              </button>
              {showInfoTooltip && (
                <div className="absolute bottom-full left-0 mb-1.5 w-64 bg-slate-800 text-white text-[9px] font-medium rounded-xl px-3 py-2 shadow-xl z-50 leading-relaxed">
                  The Facilities (Reporting) Manager collects Due List reports from all ASHA Facilitators and submits by the 5th of every month.
                  <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-800" />
                </div>
              )}
            </div>
          </div>
          <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-1 mt-0.5"><Bell className="w-3 h-3" /> Submit by the 5th of every month</p>
        </div>
        {currentStep === 'list' && (
          <button onClick={handleStartNew} className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white gradient-header shadow-sm hover:shadow-md transition-all">+ New Report</button>
        )}
      </div>

      {/* View past report */}
      {viewingReport && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-hpv-purple-soft/30 px-3 py-2 flex items-center justify-between border-b border-slate-200">
            <h3 className="text-xs font-bold text-hpv-purple-dark">Viewing: {fmtMonth(viewingReport.reporting_month)}</h3>
            <button onClick={() => setViewingReport(null)} className="p-1 rounded-full hover:bg-slate-100 text-slate-400"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="p-3 space-y-3 text-xs">
            {[
              { title: 'A. Reporting', items: [['In-charge', viewingReport.block_incharge_name], ['Mobile', viewingReport.block_incharge_mobile], ['Manager', viewingReport.facilities_manager_name], ['Mgr Mobile', viewingReport.facilities_manager_mobile], ['AFs', viewingReport.total_afs], ['ASHAs', viewingReport.total_ashas], ['Reporting', viewingReport.ashas_reporting], ['ASHA %', `${viewingReport.asha_reporting_pct}%`]] },
              { title: 'B. Due List', items: [['New Reg.', viewingReport.new_girls_registered], ['Turned 14', viewingReport.girls_turned_14], ['Eligible', viewingReport.total_eligible_girls], ['Vaccinated', viewingReport.eligible_girls_vaccinated], ['Hesitancy', viewingReport.hesitancy_count], ['Distance', viewingReport.distance_count], ['Turning 15', viewingReport.girls_turning_15_next_month], ['Yet to Vax', viewingReport.girls_turning_15_yet_to_vaccinate]] },
              { title: 'C. Summary', items: [['ASHA %', `${viewingReport.asha_reporting_pct}%`], ['Coverage', `${viewingReport.hpv_coverage_pct}%`], ['Pending', viewingReport.eligible_girls_pending], ['Age-Out', viewingReport.girls_turning_15_yet_to_vaccinate], ['Age-Out Risk', `${viewingReport.age_out_risk_pct}%`], ['Hesitancy', `${viewingReport.hesitancy_pct}%`]] },
            ].map(section => (
              <div key={section.title}>
                <p className="text-[9px] font-bold text-hpv-purple uppercase tracking-wider mb-1.5">{section.title}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {section.items.map(([l, v]) => (
                    <div key={String(l)} className="bg-slate-50 rounded-lg p-1.5">
                      <p className="text-[8px] font-bold text-slate-400 uppercase">{l}</p>
                      <p className="font-bold text-slate-800 text-xs truncate">{v || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past list */}
      {currentStep === 'list' && !viewingReport && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-hpv-purple" />
            <h3 className="text-xs font-bold text-slate-700">Past Submitted Reports</h3>
          </div>
          {loadingPast ? (
            <div className="p-6 text-center"><div className="w-5 h-5 border-2 border-hpv-purple border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : pastReports.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">No reports yet. Click "+ New Report" to get started.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pastReports.map(report => {
                const editable = isMonthEditable(report.reporting_month);
                return (
                  <div key={report.id} className="px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{fmtMonth(report.reporting_month)}</p>
                      <p className="text-[9px] text-slate-400">{new Date(report.submitted_at).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-emerald-600 mr-1 hidden sm:inline">{report.hpv_coverage_pct}%</span>
                      <button onClick={() => fetchReportForMonth(report.reporting_month).then(f => f && setViewingReport(f))} className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-hpv-purple bg-hpv-purple-soft/50 hover:bg-hpv-purple-soft transition-colors">View</button>
                      {editable
                        ? <button onClick={() => handleEdit(report)} className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white bg-hpv-purple hover:bg-hpv-purple-dark shadow-sm">Edit</button>
                        : <span className="px-2 py-1 rounded-lg text-[9px] font-bold text-slate-400 bg-slate-100 flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> Frozen</span>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section A */}
      {currentStep === 'A' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-3 pt-3 pb-0"><StepTabs /></div>
          <div className="px-3 pb-3 space-y-3">
            <div>
              <p className="text-[9px] font-bold text-hpv-purple uppercase tracking-wider mb-1.5">A.1 Basic Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="sm:col-span-2"><Field label="Reporting Month *" value={reportingMonth} onChange={setReportingMonth} type="month" /></div>
                <Field label="Block / City In-charge Name" value={blockInchargeName} onChange={setBlockInchargeName} placeholder="Auto-populated" />
                <Field label="Block / City In-charge Mobile" value={blockInchargeMobile} onChange={setBlockInchargeMobile} type="tel" placeholder="Auto-populated" />
                <Field label="Facilities Manager Name" value={facilitiesManagerName} onChange={setFacilitiesManagerName} placeholder="Auto-populated" />
                <Field label="Facilities Manager Mobile" value={facilitiesManagerMobile} onChange={setFacilitiesManagerMobile} type="tel" placeholder="Auto-populated" />
              </div>
            </div>
            <div className="border-t border-slate-100 pt-2">
              <p className="text-[9px] font-bold text-hpv-purple uppercase tracking-wider mb-1.5">A.2 ASHA Reporting</p>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Total AFs" value={totalAfs} onChange={setTotalAfs} type="number" placeholder="Auto-pop." />
                <Field label="Total ASHAs" value={totalAshas} onChange={setTotalAshas} type="number" placeholder="Auto-pop." />
                <Field label="ASHAs Reporting" value={ashasReporting} onChange={setAshasReporting} type="number" />
              </div>
              {Number(totalAshas) > 0 && Number(ashasReporting) > 0 && (
                <div className="mt-1.5 bg-hpv-teal-soft/40 border border-hpv-teal/20 rounded-lg px-2.5 py-1.5 flex items-center justify-between">
                  <span className="text-[9px] text-hpv-teal-dark font-semibold">ASHA Reporting %</span>
                  <span className="font-mono font-extrabold text-slate-900 text-xs">{ashaReportingPct}%</span>
                </div>
              )}
            </div>
            <NavBtns onBack={() => setCurrentStep('list')} onNext={() => setCurrentStep('B')} nextDisabled={!reportingMonth} />
          </div>
        </div>
      )}

      {/* Section B */}
      {currentStep === 'B' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-3 pt-3 pb-0"><StepTabs /></div>
          <div className="px-3 pb-3 space-y-2">
            <div>
              <p className="text-[9px] font-bold text-hpv-purple uppercase tracking-wider mb-1.5">B.1 Eligible Girls & Vaccination</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="New Girls Registered (13–<15 yrs)" value={newGirlsRegistered} onChange={setNewGirlsRegistered} type="number" tip="Girls newly identified during the month, aged 13–<15" />
                <Field label="Girls Turned 14 This Month" value={girlsTurned14} onChange={setGirlsTurned14} type="number" tip="Girls who celebrated their 14th birthday during the month" />
                <Field label="Total Eligible Girls (14–<15 yrs)" value={totalEligibleGirls} onChange={setTotalEligibleGirls} type="number" tip="Girls currently aged 14–<15 years (cumulative line listed)" />
                <Field label="Eligible Girls Vaccinated" value={eligibleGirlsVaccinated} onChange={setEligibleGirlsVaccinated} type="number" tip="Eligible girls who have received the HPV vaccine" />
              </div>
            </div>
            <div className="border-t border-slate-100 pt-2">
              <p className="text-[9px] font-bold text-hpv-purple uppercase tracking-wider mb-1.5">B.2 Reasons for Pending</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Hesitancy / Fear / Rumours" value={hesitancyCount} onChange={setHesitancyCount} type="number" />
                <Field label="Distance / Transport Issues" value={distanceCount} onChange={setDistanceCount} type="number" />
              </div>
            </div>
            <div className="border-t border-slate-100 pt-2">
              <p className="text-[9px] font-bold text-hpv-purple uppercase tracking-wider mb-1.5">B.3 Girls Approaching Age-Out</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Girls Turning 15 Next Month" value={girlsTurning15Next} onChange={setGirlsTurning15Next} type="number" tip="Eligible girls approaching the upper age limit" />
                <Field label="Of these, Yet to be Vaccinated" value={girlsTurning15YetToVaccinate} onChange={setGirlsTurning15YetToVaccinate} type="number" />
              </div>
            </div>
            <NavBtns onBack={() => setCurrentStep('A')} onNext={() => setCurrentStep('C')} />
          </div>
        </div>
      )}

      {/* Section C */}
      {currentStep === 'C' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-3 pt-3 pb-0"><StepTabs /></div>
          <div className="px-3 pb-3 space-y-2">
            <p className="text-[9px] font-bold text-hpv-purple uppercase tracking-wider">C. Monthly Performance Summary</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'ASHA Reporting', val: `${ashaReportingPct}%`, color: 'sky' },
                { label: 'HPV Coverage', val: `${hpvCoverage}%`, color: 'emerald' },
                { label: 'Pending Vax', val: eligiblePending, color: 'amber' },
                { label: 'Age-Out Pending', val: girlsTurning15YetToVaccinate || '0', color: 'rose' },
                { label: 'Age-Out Risk', val: `${ageOutRisk}%`, color: 'orange' },
                { label: 'Hesitancy', val: `${hesitancyPct}%`, color: 'violet' },
              ].map(item => (
                <div key={item.label} className={`bg-${item.color}-50 border border-${item.color}-100 rounded-xl p-2 text-center`}>
                  <p className={`text-[8px] font-bold text-${item.color}-600 uppercase mb-0.5 leading-tight`}>{item.label}</p>
                  <p className={`text-base font-extrabold font-mono text-${item.color}-700`}>{item.val}</p>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-[9px] text-amber-700 font-medium">
              <strong>Note:</strong> Monthly data will be frozen on the 9th. Submit by the 5th.
            </div>
            {submitError && <div className="p-2 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-semibold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {submitError}</div>}
            {submitSuccess && <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {submitSuccess}</div>}
            <div className="flex gap-2">
              <button onClick={() => setCurrentStep('B')} className="flex-1 py-2 rounded-xl font-bold text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all flex items-center justify-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /> Back</button>
              <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2 rounded-xl font-bold text-xs text-white gradient-header shadow-md disabled:opacity-50 flex items-center justify-center gap-1">
                {submitting ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Submit Report</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const BlockDueListReport: React.FC = () => (
  <BlockShell currentPage="due-list">
    <DueListContent />
  </BlockShell>
);
