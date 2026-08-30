import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Building2, ChevronDown, Settings, ClipboardList, BarChart2,
  Package, MessageSquare, TrendingUp, Lock, Eye, EyeOff, X,
  Info, ChevronRight, ChevronLeft, CheckCircle2, AlertTriangle,
  Calendar, FileText, Bell
} from 'lucide-react';

interface BlockData {
  id: number;
  name: string;
  district_name: string;
  state_name: string;
  is_urban?: boolean;
}

interface MetaData {
  block_incharge_name?: string;
  block_incharge_mobile?: string;
  facilities_manager_name?: string;
  facilities_manager_mobile?: string;
  total_afs?: number;
  total_ashas?: number;
}

interface PastReport {
  id: string;
  reporting_month: string;
  submitted_at: string;
  asha_reporting_pct: number;
  hpv_coverage_pct: number;
}

interface FullReport {
  id: string;
  reporting_month: string;
  block_incharge_name: string;
  block_incharge_mobile: string;
  facilities_manager_name: string;
  facilities_manager_mobile: string;
  total_afs: number;
  total_ashas: number;
  ashas_reporting: number;
  asha_reporting_pct: number;
  new_girls_registered: number;
  girls_turned_14: number;
  total_eligible_girls: number;
  eligible_girls_vaccinated: number;
  eligible_girls_pending: number;
  hesitancy_count: number;
  distance_count: number;
  others_count: number;
  girls_turning_15_next_month: number;
  girls_turning_15_yet_to_vaccinate: number;
  hpv_coverage_pct: number;
  age_out_risk_pct: number;
  hesitancy_pct: number;
  submitted_at: string;
}

export const BlockDueListReport: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const blockId = searchParams.get('blockId');

  const [block, setBlock] = useState<BlockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<MetaData>({});
  const [pastReports, setPastReports] = useState<PastReport[]>([]);
  const [viewingReport, setViewingReport] = useState<FullReport | null>(null);
  const [loadingPast, setLoadingPast] = useState(false);

  // Form state — Section A
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

  // Step / UI state
  const [currentStep, setCurrentStep] = useState<'list' | 'A' | 'B' | 'C'>('list');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [showNavDropdown, setShowNavDropdown] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showInfoTooltip, setShowInfoTooltip] = useState('');
  const navDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!blockId) { navigate('/'); return; }
    const token = localStorage.getItem(`hpv_block_token_${blockId}`) || sessionStorage.getItem(`hpv_block_token_${blockId}`);
    if (!token) { navigate('/'); return; }
    fetchInitial();
  }, [blockId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navDropdownRef.current && !navDropdownRef.current.contains(e.target as Node)) {
        setShowNavDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchInitial = async () => {
    setLoading(true);
    try {
      // Fetch block info
      const blockRes = await fetch(`/api/blocks/${blockId}`);
      const blockData = await blockRes.json();
      if (blockData.block) setBlock(blockData.block);

      // Fetch meta
      const metaRes = await fetch(`/api/due-list/meta/${blockId}`);
      const metaData = await metaRes.json();
      setMeta(metaData || {});
      if (metaData) {
        setBlockInchargeName(metaData.block_incharge_name || '');
        setBlockInchargeMobile(metaData.block_incharge_mobile || '');
        setFacilitiesManagerName(metaData.facilities_manager_name || '');
        setFacilitiesManagerMobile(metaData.facilities_manager_mobile || '');
        setTotalAfs(metaData.total_afs ? String(metaData.total_afs) : '');
        setTotalAshas(metaData.total_ashas ? String(metaData.total_ashas) : '');
      }

      // Fetch past reports list
      await fetchPastReports();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const fetchPastReports = async () => {
    setLoadingPast(true);
    try {
      const res = await fetch(`/api/due-list/list/${blockId}`);
      const data = await res.json();
      setPastReports(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    setLoadingPast(false);
  };

  const fetchReportForMonth = async (month: string): Promise<FullReport | null> => {
    try {
      const res = await fetch(`/api/due-list/${blockId}?month=${month}`);
      return await res.json();
    } catch { return null; }
  };

  // Check if month is editable (before 9th of following month)
  const isMonthEditable = (month: string): boolean => {
    if (!month) return true;
    const [yr, mo] = month.split('-').map(Number);
    const freezeDate = new Date(yr, mo, 9);
    return new Date() < freezeDate;
  };

  const handleStartNewReport = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    // Default to previous month for due list
    const prevMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
    setReportingMonth(prevMonth);
    setCurrentStep('A');
  };

  const handleViewPast = async (report: PastReport) => {
    const full = await fetchReportForMonth(report.reporting_month);
    if (full) {
      setViewingReport(full);
    }
  };

  const handleEditPast = async (report: PastReport) => {
    const full = await fetchReportForMonth(report.reporting_month);
    if (full) {
      setReportingMonth(full.reporting_month);
      setBlockInchargeName(full.block_incharge_name || '');
      setBlockInchargeMobile(full.block_incharge_mobile || '');
      setFacilitiesManagerName(full.facilities_manager_name || '');
      setFacilitiesManagerMobile(full.facilities_manager_mobile || '');
      setTotalAfs(String(full.total_afs || ''));
      setTotalAshas(String(full.total_ashas || ''));
      setAshasReporting(String(full.ashas_reporting || ''));
      setNewGirlsRegistered(String(full.new_girls_registered || ''));
      setGirlsTurned14(String(full.girls_turned_14 || ''));
      setTotalEligibleGirls(String(full.total_eligible_girls || ''));
      setEligibleGirlsVaccinated(String(full.eligible_girls_vaccinated || ''));
      setHesitancyCount(String(full.hesitancy_count || ''));
      setDistanceCount(String(full.distance_count || ''));
      setGirlsTurning15Next(String(full.girls_turning_15_next_month || ''));
      setGirlsTurning15YetToVaccinate(String(full.girls_turning_15_yet_to_vaccinate || ''));
      setCurrentStep('A');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');
    try {
      const res = await fetch(`/api/due-list/${blockId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporting_month: reportingMonth,
          block_incharge_name: blockInchargeName,
          block_incharge_mobile: blockInchargeMobile,
          facilities_manager_name: facilitiesManagerName,
          facilities_manager_mobile: facilitiesManagerMobile,
          total_afs: Number(totalAfs) || 0,
          total_ashas: Number(totalAshas) || 0,
          ashas_reporting: Number(ashasReporting) || 0,
          new_girls_registered: Number(newGirlsRegistered) || 0,
          girls_turned_14: Number(girlsTurned14) || 0,
          total_eligible_girls: Number(totalEligibleGirls) || 0,
          eligible_girls_vaccinated: Number(eligibleGirlsVaccinated) || 0,
          hesitancy_count: Number(hesitancyCount) || 0,
          distance_count: Number(distanceCount) || 0,
          girls_turning_15_next_month: Number(girlsTurning15Next) || 0,
          girls_turning_15_yet_to_vaccinate: Number(girlsTurning15YetToVaccinate) || 0,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitSuccess('Report submitted successfully!');
      await fetchPastReports();
      setTimeout(() => {
        setSubmitSuccess('');
        setCurrentStep('list');
      }, 2000);
    } catch (err: any) {
      setSubmitError(err.message);
    }
    setSubmitting(false);
  };

  const formatMonthDisplay = (ym: string) => {
    if (!ym) return '';
    const [yr, mo] = ym.split('-');
    const d = new Date(Number(yr), Number(mo) - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  // Computed values for Section C
  const ashaReportingPct = Number(totalAshas) > 0
    ? ((Number(ashasReporting) / Number(totalAshas)) * 100).toFixed(1)
    : '0.0';
  const eligiblePending = Math.max(0, Number(totalEligibleGirls) - Number(eligibleGirlsVaccinated));
  const hpvCoverage = Number(totalEligibleGirls) > 0
    ? ((Number(eligibleGirlsVaccinated) / Number(totalEligibleGirls)) * 100).toFixed(1)
    : '0.0';
  const ageOutRisk = Number(girlsTurning15Next) > 0
    ? ((Number(girlsTurning15YetToVaccinate) / Number(girlsTurning15Next)) * 100).toFixed(1)
    : '0.0';
  const hesitancyPct = Number(totalEligibleGirls) > 0
    ? ((Number(hesitancyCount) / Number(totalEligibleGirls)) * 100).toFixed(1)
    : '0.0';

  const navItems = [
    { label: 'Daily Report', icon: ClipboardList, path: `/report?blockId=${blockId}`, active: false },
    { label: 'Monthly Due List Report', icon: BarChart2, path: `/due-list-report?blockId=${blockId}`, active: true },
    { label: 'HPV Vaccine Stock Balance Report', icon: Package, path: `/monthly-report?blockId=${blockId}`, active: false },
    { label: 'Trends', icon: TrendingUp, path: `/progress-trend?blockId=${blockId}`, active: false },
    { label: 'Feedback', icon: MessageSquare, path: `/feedback?blockId=${blockId}`, active: false },
  ];

  const InfoTooltip: React.FC<{ id: string; text: string }> = ({ id, text }) => (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShowInfoTooltip(id)}
        onMouseLeave={() => setShowInfoTooltip('')}
        onClick={() => setShowInfoTooltip(showInfoTooltip === id ? '' : id)}
        className="ml-1 text-slate-400 hover:text-hpv-purple transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {showInfoTooltip === id && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white text-[10px] font-medium rounded-xl px-3 py-2 shadow-xl z-50 leading-relaxed">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-hpv-purple border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between min-h-[60px]">
          <div className="cursor-pointer" onClick={() => navigate('/')}>
            <img src="/headinglogo.png" alt="Logo" className="h-14 object-contain hover:opacity-80 transition-opacity" />
          </div>
          <div className="flex items-center gap-2">
            {/* Nav Dropdown */}
            <div className="relative" ref={navDropdownRef}>
              <button
                onClick={() => setShowNavDropdown(!showNavDropdown)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-hpv-purple-soft/40 hover:bg-hpv-purple-soft text-hpv-purple-dark text-xs font-bold transition-colors border border-hpv-purple/20"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Monthly Due List
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showNavDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showNavDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {navItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => { setShowNavDropdown(false); navigate(item.path); }}
                      className={`w-full text-left px-4 py-3 text-sm font-semibold flex items-center gap-3 transition-colors border-b border-slate-100 last:border-0
                        ${item.active ? 'bg-hpv-purple-soft/50 text-hpv-purple' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 ${item.active ? 'text-hpv-purple' : 'text-slate-400'}`} />
                      {item.label}
                      {item.active && <span className="ml-auto text-[9px] bg-hpv-purple text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Current</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Settings */}
            <div className="relative">
              <button onClick={() => setShowSettingsDropdown(!showSettingsDropdown)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              {showSettingsDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50">
                  <button onClick={() => { setShowSettingsDropdown(false); navigate(`/report?blockId=${blockId}`); }} className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100">Change Passcode</button>
                  <button onClick={() => { localStorage.removeItem(`hpv_block_token_${blockId}`); sessionStorage.removeItem(`hpv_block_token_${blockId}`); navigate('/'); }} className="w-full text-left px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors border-t border-slate-100">Logout</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-4 py-3 flex-1 space-y-3">

        {/* Block Hero */}
        <div className="gradient-header rounded-2xl p-3 text-white shadow-lg shadow-hpv-purple/20">
          <p className="text-hpv-teal-light text-[10px] font-bold uppercase tracking-widest mb-0.5">HPV Vaccination Program</p>
          <h1 className="text-xl font-extrabold tracking-tight">{block?.name} <span className="text-sm font-medium text-slate-300">{block?.is_urban ? 'City (Urban)' : 'Block (Rural)'}</span></h1>
          <p className="text-slate-300 text-xs mt-0.5">{block?.district_name} District · {block?.state_name}</p>
        </div>

        {/* Page title with info icon */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">Monthly Due List Report</h2>
                <InfoTooltip
                  id="page-info"
                  text="The designated Facilities (Reporting) Manager is responsible for collecting the monthly Due List reports from all ASHA Facilitators (AFs) in the Block/City, consolidating the information, and submitting this report by the 5th of every month."
                />
              </div>
              <p className="text-xs text-amber-600 font-semibold mt-1 flex items-center gap-1">
                <Bell className="w-3.5 h-3.5" />
                Please submit this report by the 5th of every month.
              </p>
            </div>
            {currentStep === 'list' && (
              <button
                onClick={handleStartNewReport}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold text-white gradient-header shadow-sm hover:shadow-md transition-all"
              >
                + New Report
              </button>
            )}
          </div>
        </div>

        {/* ===== VIEW PAST REPORT ===== */}
        {viewingReport && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-hpv-purple-soft/30 px-4 py-3 flex items-center justify-between border-b border-slate-200">
              <h3 className="text-sm font-bold text-hpv-purple-dark">Viewing: {formatMonthDisplay(viewingReport.reporting_month)}</h3>
              <button onClick={() => setViewingReport(null)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              {/* A */}
              <div>
                <p className="text-xs font-bold text-hpv-purple uppercase tracking-wider mb-2">A. Reporting Information</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Block In-charge', viewingReport.block_incharge_name],
                    ['Mobile', viewingReport.block_incharge_mobile],
                    ['Facilities Manager', viewingReport.facilities_manager_name],
                    ['Manager Mobile', viewingReport.facilities_manager_mobile],
                    ['Total AFs', viewingReport.total_afs],
                    ['Total ASHAs', viewingReport.total_ashas],
                    ['ASHAs Reporting', viewingReport.ashas_reporting],
                    ['ASHA Reporting %', `${viewingReport.asha_reporting_pct}%`],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="bg-slate-50 rounded-lg p-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                      <p className="font-bold text-slate-800">{val || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* B */}
              <div>
                <p className="text-xs font-bold text-hpv-purple uppercase tracking-wider mb-2">B. Due List & Vaccination</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['New Girls Registered', viewingReport.new_girls_registered],
                    ['Girls Turned 14', viewingReport.girls_turned_14],
                    ['Total Eligible Girls', viewingReport.total_eligible_girls],
                    ['Girls Vaccinated', viewingReport.eligible_girls_vaccinated],
                    ['Hesitancy / Fear', viewingReport.hesitancy_count],
                    ['Distance Issues', viewingReport.distance_count],
                    ['Girls Turning 15 Next', viewingReport.girls_turning_15_next_month],
                    ['Yet to Vaccinate', viewingReport.girls_turning_15_yet_to_vaccinate],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="bg-slate-50 rounded-lg p-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p>
                      <p className="font-bold text-slate-800">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* C */}
              <div>
                <p className="text-xs font-bold text-hpv-purple uppercase tracking-wider mb-2">C. Performance Summary</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['ASHA Reporting %', `${viewingReport.asha_reporting_pct}%`],
                    ['HPV Coverage %', `${viewingReport.hpv_coverage_pct}%`],
                    ['Pending Vaccination', viewingReport.eligible_girls_pending],
                    ['Age-Out Pending', viewingReport.girls_turning_15_yet_to_vaccinate],
                    ['Age-Out Risk %', `${viewingReport.age_out_risk_pct}%`],
                    ['Hesitancy %', `${viewingReport.hesitancy_pct}%`],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="bg-emerald-50 rounded-lg p-2">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase">{label}</p>
                      <p className="font-bold text-slate-800">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 text-center">Submitted: {new Date(viewingReport.submitted_at).toLocaleString('en-IN')}</p>
            </div>
          </div>
        )}

        {/* ===== PAST REPORTS LIST ===== */}
        {currentStep === 'list' && !viewingReport && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-hpv-purple-soft/20 px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><FileText className="w-4 h-4 text-hpv-purple" /> Past Submitted Reports</h3>
            </div>
            {loadingPast ? (
              <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-hpv-purple border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : pastReports.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No reports submitted yet. Click "+ New Report" to get started.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pastReports.map(report => {
                  const editable = isMonthEditable(report.reporting_month);
                  return (
                    <div key={report.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{formatMonthDisplay(report.reporting_month)}</p>
                        <p className="text-[10px] text-slate-400">Submitted: {new Date(report.submitted_at).toLocaleDateString('en-IN')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2 hidden sm:block">
                          <p className="text-[10px] text-slate-400 font-semibold">Coverage</p>
                          <p className="text-sm font-bold text-emerald-600">{report.hpv_coverage_pct}%</p>
                        </div>
                        <button
                          onClick={() => handleViewPast(report)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-hpv-purple bg-hpv-purple-soft/50 hover:bg-hpv-purple-soft transition-colors"
                        >
                          View
                        </button>
                        {editable && (
                          <button
                            onClick={() => handleEditPast(report)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-hpv-purple hover:bg-hpv-purple-dark transition-colors shadow-sm"
                          >
                            Edit
                          </button>
                        )}
                        {!editable && (
                          <span className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-400 bg-slate-100 flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Frozen
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== SECTION A ===== */}
        {currentStep === 'A' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Step indicator */}
            <div className="flex border-b border-slate-100">
              {['A', 'B', 'C'].map((s, i) => (
                <div key={s} className={`flex-1 py-2 text-center text-xs font-bold transition-colors ${currentStep === s ? 'bg-hpv-purple text-white' : i < ['A','B','C'].indexOf(currentStep) ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'}`}>
                  {s === 'A' ? 'A. Reporting Info' : s === 'B' ? 'B. Due List' : 'C. Summary'}
                </div>
              ))}
            </div>

            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs font-bold text-hpv-purple uppercase tracking-wider mb-3">A.1 Basic Information</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Reporting Month *</label>
                    <input
                      type="month"
                      value={reportingMonth}
                      onChange={e => setReportingMonth(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Block / City In-charge Name', val: blockInchargeName, set: setBlockInchargeName, key: 'bname' },
                      { label: 'Block / City In-charge Mobile', val: blockInchargeMobile, set: setBlockInchargeMobile, key: 'bmobile', type: 'tel' },
                      { label: 'Facilities (Reporting) Manager Name', val: facilitiesManagerName, set: setFacilitiesManagerName, key: 'fname' },
                      { label: 'Facilities (Reporting) Mobile', val: facilitiesManagerMobile, set: setFacilitiesManagerMobile, key: 'fmobile', type: 'tel' },
                    ].map(field => (
                      <div key={field.key}>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{field.label}</label>
                        <input
                          type={field.type || 'text'}
                          value={field.val}
                          onChange={e => field.set(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-hpv-purple uppercase tracking-wider mb-3">A.2 ASHA Reporting</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Total ASHA Facilitators (AFs)', val: totalAfs, set: setTotalAfs, key: 'tafs' },
                    { label: 'Total ASHAs', val: totalAshas, set: setTotalAshas, key: 'tashas' },
                    { label: 'ASHAs Reporting', val: ashasReporting, set: setAshasReporting, key: 'arep' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{field.label}</label>
                      <input
                        type="number"
                        min="0"
                        value={field.val}
                        onChange={e => field.set(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 font-mono focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                      />
                    </div>
                  ))}
                </div>
                {Number(totalAshas) > 0 && Number(ashasReporting) > 0 && (
                  <div className="mt-2 bg-hpv-teal-soft/40 border border-hpv-teal/20 rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-hpv-teal-dark font-semibold">ASHA Reporting %</span>
                    <span className="font-mono font-extrabold text-slate-900">{ashaReportingPct}%</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setCurrentStep('list')} className="flex-1 py-3 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={() => setCurrentStep('B')}
                  disabled={!reportingMonth}
                  className="flex-1 py-3 rounded-xl font-bold text-sm text-white gradient-header shadow-md hover:shadow-hpv-purple/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== SECTION B ===== */}
        {currentStep === 'B' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-100">
              {['A', 'B', 'C'].map((s, i) => (
                <div key={s} className={`flex-1 py-2 text-center text-xs font-bold transition-colors ${currentStep === s ? 'bg-hpv-purple text-white' : i < ['A','B','C'].indexOf(currentStep) ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'}`}>
                  {s === 'A' ? 'A. Reporting Info' : s === 'B' ? 'B. Due List' : 'C. Summary'}
                </div>
              ))}
            </div>

            <div className="p-4 space-y-4">
              {/* B.1 */}
              <div>
                <p className="text-xs font-bold text-hpv-purple uppercase tracking-wider mb-3">B.1 Eligible Girls & Vaccination</p>
                <div className="space-y-3">
                  {[
                    { label: 'New Girls Registered This Month (13–<15 years)', sub: 'Girls newly identified/registered during the month, aged 13–<15', val: newGirlsRegistered, set: setNewGirlsRegistered, key: 'ngr' },
                    { label: 'Girls Turned 14 This Month', sub: 'Girls who celebrated 14 years birthday during the month', val: girlsTurned14, set: setGirlsTurned14, key: 'gt14' },
                    { label: 'Total Eligible Girls (14–<15 years)', sub: 'Girls currently aged 14–<15 years (cumulative line listed)', val: totalEligibleGirls, set: setTotalEligibleGirls, key: 'teg' },
                    { label: 'Eligible Girls Vaccinated', sub: 'Eligible girls who have received HPV vaccine', val: eligibleGirlsVaccinated, set: setEligibleGirlsVaccinated, key: 'egv' },
                  ].map(field => (
                    <div key={field.key} className="flex gap-3 items-start">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">{field.label}</label>
                        <p className="text-[10px] text-slate-400 mb-1">{field.sub}</p>
                        <input
                          type="number"
                          min="0"
                          value={field.val}
                          onChange={e => field.set(e.target.value)}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 font-mono focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* B.2 */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-hpv-purple uppercase tracking-wider mb-3">B.2 Reasons for Pending Vaccination</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Hesitancy / Fear / Rumours', val: hesitancyCount, set: setHesitancyCount, key: 'hes' },
                    { label: 'Distance / Transport Issues', val: distanceCount, set: setDistanceCount, key: 'dist' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{field.label}</label>
                      <input type="number" min="0" value={field.val} onChange={e => field.set(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-800 focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20" />
                    </div>
                  ))}
                </div>
              </div>

              {/* B.3 */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-hpv-purple uppercase tracking-wider mb-3">B.3 Girls Approaching Age-Out – Priority Follow-up</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Girls Turning 15 Next Month', sub: 'Eligible girls approaching the upper age limit', val: girlsTurning15Next, set: setGirlsTurning15Next, key: 'gt15' },
                    { label: 'Of these, Girls Yet to be Vaccinated', sub: '', val: girlsTurning15YetToVaccinate, set: setGirlsTurning15YetToVaccinate, key: 'ytv' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">{field.label}</label>
                      {field.sub && <p className="text-[10px] text-slate-400 mb-1">{field.sub}</p>}
                      <input type="number" min="0" value={field.val} onChange={e => field.set(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-800 focus:outline-none focus:border-hpv-purple focus:ring-2 focus:ring-hpv-purple/20" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setCurrentStep('A')} className="flex-1 py-3 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={() => setCurrentStep('C')}
                  className="flex-1 py-3 rounded-xl font-bold text-sm text-white gradient-header shadow-md hover:shadow-hpv-purple/20 transition-all flex items-center justify-center gap-2"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== SECTION C ===== */}
        {currentStep === 'C' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex border-b border-slate-100">
              {['A', 'B', 'C'].map((s, i) => (
                <div key={s} className={`flex-1 py-2 text-center text-xs font-bold transition-colors ${currentStep === s ? 'bg-hpv-purple text-white' : i < ['A','B','C'].indexOf(currentStep) ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'}`}>
                  {s === 'A' ? 'A. Reporting Info' : s === 'B' ? 'B. Due List' : 'C. Summary'}
                </div>
              ))}
            </div>

            <div className="p-4 space-y-4">
              <p className="text-xs font-bold text-hpv-purple uppercase tracking-wider">C. Monthly Performance Summary</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'ASHA Reporting (%)', val: `${ashaReportingPct}%`, color: 'sky' },
                  { label: 'HPV Vaccination Coverage (%)', val: `${hpvCoverage}%`, color: 'emerald' },
                  { label: 'Eligible Girls Pending Vaccination', val: eligiblePending, color: 'amber' },
                  { label: 'Age-Out Girls Pending Vaccination', val: girlsTurning15YetToVaccinate || 0, color: 'rose' },
                  { label: 'Age-Out Risk (%)', val: `${ageOutRisk}%`, color: 'orange' },
                  { label: 'Hesitancy (%)', val: `${hesitancyPct}%`, color: 'violet' },
                ].map(item => (
                  <div key={item.label} className={`bg-${item.color}-50 border border-${item.color}-100 rounded-xl p-3 text-center`}>
                    <p className={`text-[10px] font-bold text-${item.color}-600 uppercase mb-1`}>{item.label}</p>
                    <p className={`text-xl font-extrabold font-mono text-${item.color}-700`}>{item.val}</p>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 font-medium">
                <strong>Note:</strong> Monthly data will be frozen on the 9th of every month. Reports should be reviewed and submitted by the 5th. Corrections after the data freeze will require authorization.
              </div>

              {submitError && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {submitError}
                </div>
              )}
              {submitSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {submitSuccess}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setCurrentStep('B')} className="flex-1 py-3 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl font-bold text-sm text-white gradient-header shadow-md hover:shadow-hpv-purple/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</> : <><CheckCircle2 className="w-4 h-4" /> Submit Report</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-3xl mx-auto w-full text-center py-4 text-xs text-slate-400 px-4 space-y-2">
        <div className="font-medium text-[11px]">HPV Vaccination Monitoring Portal • Version: 1.0 • UK 2026</div>
        <div className="flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
          <span className="text-[11px] font-semibold text-slate-400">Powered by:</span>
          <img src="/impactcode.png" alt="ImpactCode" className="h-4 object-contain" />
        </div>
      </footer>
    </div>
  );
};
