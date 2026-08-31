import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Download, BarChart3, ChevronDown, Search,
  ChevronLeft, ChevronRight, Activity, Target, Users,
  Syringe, Filter, RefreshCw, CheckCircle2, AlertCircle, MapPin
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportRow {
  id: string | number;
  name: string;
  lgd_code: number;
  population: number;
  hpv_target: number;
  last_reporting_date: string;
  beneficiaries_vaccinated: number | null;
  sessions_held_cumulative: number | null;
  sessions_held_today: number | null;
  vaccinated_today: number | null;
  vaccinations_per_session: number | null;
  vaccination_coverage_pct: number | null;
  has_report: boolean;
  has_today_report: boolean;
}

type RankBy = 'vaccination_coverage_pct' | 'sessions_held_cumulative' | 'beneficiaries_vaccinated' | 'vaccinations_per_session' | 'sessions_held_today' | 'vaccinated_today';
type SortDir = 'best' | 'worst';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

function fmtDate(d: string | null): string {
  if (!d || d === '—') return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function coverageTier(pct: number | null): { label: string; color: string; bg: string } {
  if (pct === null || pct === undefined) return { label: 'No Data', color: 'text-slate-400', bg: 'bg-slate-100' };
  if (pct >= 90) return { label: 'Champion 🏆', color: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (pct >= 70) return { label: 'High Performance ⭐', color: 'text-teal-700', bg: 'bg-teal-50' };
  if (pct >= 30) return { label: 'Progressing 📈', color: 'text-blue-700', bg: 'bg-blue-50' };
  return { label: 'Aspirational 🌱', color: 'text-orange-700', bg: 'bg-orange-50' };
}

// ─── Circular Progress Ring ───────────────────────────────────────────────────

const CircularProgress: React.FC<{ pct: number; size?: number }> = ({ pct, size = 72 }) => {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const radius = (size - 10) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (clampedPct / 100) * circ;
  const color = clampedPct >= 90 ? '#10b981' : clampedPct >= 70 ? '#14b8a6' : clampedPct >= 30 ? '#3b82f6' : '#f97316';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
    </svg>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  icon: React.ReactNode; label: string; value: string;
  subLabel?: string; subValue?: string; iconBg: string; valueColor?: string; loading?: boolean;
}> = ({ icon, label, value, subLabel, subValue, iconBg, valueColor = 'text-slate-900', loading }) => (
  <div className="bg-white rounded-xl px-3 py-3 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
    {loading ? (
      <div className="animate-pulse flex flex-col gap-2">
        <div className="w-8 h-8 rounded-full bg-slate-200" />
        <div className="h-2.5 bg-slate-200 rounded w-2/3" />
        <div className="h-5 bg-slate-200 rounded w-3/4" />
        <div className="h-2.5 bg-slate-100 rounded w-1/2" />
      </div>
    ) : (
      <>
        {/* Icon — fixed size */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg} mb-2 shrink-0`}>{icon}</div>
        {/* Label — fixed 2-line height so values always align */}
        <div className="text-[10px] font-semibold text-slate-500 leading-tight" style={{ minHeight: '2.4em' }}>{label}</div>
        {/* Value — always at same vertical distance */}
        <div className={`text-base font-extrabold leading-tight mt-1 ${valueColor}`}>{value}</div>
        {/* Sub-value — fixed height so bottom of all cards aligns */}
        <div className="text-[10px] font-semibold leading-tight mt-0.5" style={{ minHeight: '1.3em' }}>
          {subValue && subLabel
            ? <span className="text-emerald-600">{subValue} {subLabel}</span>
            : subLabel
            ? <span className="text-slate-400">{subLabel}</span>
            : <span className="opacity-0">—</span>}
        </div>
      </>
    )}
  </div>
);

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <tr className="animate-pulse border-b border-slate-100">
    {Array.from({ length: 11 }).map((_, i) => (
      <td key={i} className="px-3 py-2"><div className="h-3.5 bg-slate-200 rounded w-full" /></td>
    ))}
  </tr>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface DailyProgressReportProps {
  adminUser: any;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const DailyProgressReport: React.FC<DailyProgressReportProps> = ({ adminUser }) => {
  const [statesList, setStatesList] = useState<any[]>([]);
  const [districtsList, setDistrictsList] = useState<any[]>([]);

  const today = new Date().toISOString().split('T')[0];
  const [filterDate, setFilterDate] = useState(today);
  const [filterLevel, setFilterLevel] = useState<'District' | 'Block' | 'Division'>('District');
  const [filterStateId, setFilterStateId] = useState('');
  const [filterDistrictId, setFilterDistrictId] = useState('ALL');

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportDateLabel, setReportDateLabel] = useState('');
  const [hasAutoGenerated, setHasAutoGenerated] = useState(false);

  const [sortDir, setSortDir] = useState<SortDir>('best');
  const [rankBy, setRankBy] = useState<RankBy>('vaccination_coverage_pct');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  useEffect(() => {
    Promise.all([
      fetch('/api/locations/states').then(r => r.json()),
      fetch('/api/locations/districts').then(r => r.json()),
    ]).then(([states, districts]) => {
      setStatesList(Array.isArray(states) ? states : []);
      setDistrictsList(Array.isArray(districts) ? districts : []);
    }).catch(console.error);

    if (adminUser?.role === 'DISTRICT_ADMIN') {
      setFilterLevel('Block');
      if (adminUser.district_id) setFilterDistrictId(String(adminUser.district_id));
    }
  }, []);

  useEffect(() => {
    if (statesList.length > 0 && adminUser && !filterStateId) {
      if (adminUser.role === 'SUPER_ADMIN') {
        const uk = statesList.find((s: any) => s.name === 'Uttarakhand State' || s.name === 'Uttarakhand');
        if (uk) setFilterStateId(String(uk.id));
      } else if (adminUser.state_id) {
        setFilterStateId(String(adminUser.state_id));
      }
    }
  }, [statesList, adminUser]);

  useEffect(() => {
    if (filterStateId && !hasAutoGenerated) {
      setHasAutoGenerated(true);
      generateReport(filterDate, filterLevel, filterStateId, filterDistrictId);
    }
  }, [filterStateId]);

  const generateReport = async (date: string, level: string, stateId: string, districtId: string) => {
    const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
    setLoading(true);
    setReportGenerated(false);
    setCurrentPage(1);
    const params = new URLSearchParams({ date, level: level.toUpperCase() });
    if (stateId) params.set('state_id', stateId);
    if (districtId && districtId !== 'ALL') params.set('districtId', districtId);
    try {
      const res = await fetch(`/api/admin/reports/generate?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setRows(data.rows || []);
      setReportDateLabel(date);
      setReportGenerated(true);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleGenerate = () => generateReport(filterDate, filterLevel, filterStateId, filterDistrictId);

  const rankedRows = useMemo(() => {
    // Ranks are ALWAYS assigned best→worst (best performer = rank 1)
    const bestFirst = [...rows].sort((a, b) => {
      const av = (a as any)[rankBy] ?? -1;
      const bv = (b as any)[rankBy] ?? -1;
      return bv - av;
    });
    const withRanks = bestFirst.map((r, i) => ({ ...r, rank: i + 1 }));
    // sortDir only controls DISPLAY order, never rank numbers
    if (sortDir === 'worst') {
      return [...withRanks].sort((a, b) => {
        const av = (a as any)[rankBy] ?? -1;
        const bv = (b as any)[rankBy] ?? -1;
        return av - bv;
      });
    }
    return withRanks;
  }, [rows, rankBy, sortDir]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rankedRows;
    const q = search.toLowerCase();
    return rankedRows.filter(r => r.name.toLowerCase().includes(q));
  }, [rankedRows, search]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage]);

  const kpis = useMemo(() => {
    const totalPop = rows.reduce((s, r) => s + (r.population || 0), 0);
    const totalTarget = rows.reduce((s, r) => s + (r.hpv_target || 0), 0);
    const totalVaccCumm = rows.reduce((s, r) => s + (r.beneficiaries_vaccinated || 0), 0);
    const totalVaccToday = rows.reduce((s, r) => s + (r.vaccinated_today || 0), 0);
    const totalSessionsCumm = rows.reduce((s, r) => s + (r.sessions_held_cumulative || 0), 0);
    const totalSessionsToday = rows.reduce((s, r) => s + (r.sessions_held_today || 0), 0);
    const coveragePct = totalTarget > 0 ? (totalVaccCumm / totalTarget) * 100 : 0;
    const vaccPerSession = totalSessionsCumm > 0 ? totalVaccCumm / totalSessionsCumm : 0;
    const reportingToday = rows.filter(r => r.has_today_report).length;
    return { totalPop, totalTarget, totalVaccCumm, totalVaccToday, totalSessionsCumm, totalSessionsToday, coveragePct, vaccPerSession, reportingToday };
  }, [rows]);

  const handleCSV = () => {
    if (!rows.length) return;
    const headers = ['Rank','Reporting Unit','Last Reported','Population (13-15 Yrs)','HPV Goal (0.8%)','Sessions Held Today','Girls Vaccinated Today','Sessions Held Cumulative','Girls Vaccinated Cumulative','Vaccinations per Session','Goal Achieved %'];
    const csvRows = rankedRows.map((r: any, i: number) => [
      i + 1, `"${r.name}"`, fmtDate(r.last_reporting_date),
      r.population ?? '', r.hpv_target ?? '',
      r.sessions_held_today ?? '', r.vaccinated_today ?? '',
      r.sessions_held_cumulative ?? '', r.beneficiaries_vaccinated ?? '',
      r.vaccinations_per_session ?? '',
      r.vaccination_coverage_pct !== null ? `${r.vaccination_coverage_pct}%` : ''
    ]);
    const content = [headers.join(','), ...csvRows.map((r: any[]) => r.join(','))].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `HPV_Daily_Report_${filterLevel}_${filterDate}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const stateDistricts = useMemo(() =>
    filterStateId ? districtsList.filter(d => String(d.state_id) === filterStateId) : districtsList,
    [districtsList, filterStateId]
  );

  const canPickDistrict = filterLevel === 'Block' &&
    (adminUser?.role === 'SUPER_ADMIN' || adminUser?.role === 'ADMIN' || adminUser?.role === 'STATE_ADMIN');

  const locationLabel = useMemo(() => {
    if (filterLevel === 'Block' && filterDistrictId !== 'ALL') {
      return stateDistricts.find(d => String(d.id) === filterDistrictId)?.name || 'Selected District';
    }
    if (filterStateId) return statesList.find(s => String(s.id) === filterStateId)?.name || 'Selected State';
    return 'All Units';
  }, [filterLevel, filterDistrictId, filterStateId, stateDistricts, statesList]);

  const tierInfo = coverageTier(reportGenerated ? kpis.coveragePct : null);

  // ─── Layout: full height flex column so table fills remaining space ───────
  return (
    <div className="flex flex-col h-full min-h-0 gap-3">

      {/* ── Section Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">HPV Vaccination — Daily Progress Report</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Tracks daily &amp; cumulative HPV vaccination progress at State, Division, District, and Block levels</p>
        </div>
        <button onClick={handleCSV} disabled={!rows.length}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 transition-colors shrink-0">
          <Download className="w-3.5 h-3.5" /> Download CSV
        </button>
      </div>

      {/* ── Filter Toolbar ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 shrink-0">
        <div className="flex flex-wrap gap-2.5 items-end">
          {/* Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Report Date</label>
            <input type="date" value={filterDate} max={today}
              onChange={e => setFilterDate(e.target.value)}
              className="pl-2.5 pr-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 cursor-pointer" style={{ minWidth: 148 }} />
          </div>

          {/* State — SUPER_ADMIN only */}
          {adminUser?.role === 'SUPER_ADMIN' && (
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">State</label>
              <div className="relative">
                <select value={filterStateId} onChange={e => { setFilterStateId(e.target.value); setFilterDistrictId('ALL'); }}
                  className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer" style={{ minWidth: 160 }}>
                  <option value="">All States</option>
                  {statesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Level */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Select Level</label>
            <div className="relative">
              <select value={filterLevel}
                onChange={e => { setFilterLevel(e.target.value as any); setFilterDistrictId('ALL'); }}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer" style={{ minWidth: 120 }}>
                {(adminUser?.role === 'SUPER_ADMIN' || adminUser?.role === 'ADMIN') && <option value="Division">Division</option>}
                <option value="District">District</option>
                <option value="Block">Block</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* District */}
          {canPickDistrict && (
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">District</label>
              <div className="relative">
                <select value={filterDistrictId} onChange={e => setFilterDistrictId(e.target.value)}
                  className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer" style={{ minWidth: 160 }}>
                  <option value="ALL">All Districts</option>
                  {stateDistricts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Generate */}
          <button onClick={handleGenerate} disabled={loading}
            style={{ height: 36, borderRadius: 8, minWidth: 160 }}
            className="flex items-center justify-center gap-2 px-5 font-bold text-xs text-white bg-gradient-to-r from-[#3B1C63] to-[#522B85] hover:from-[#522B85] hover:to-[#6d3aad] rounded-lg transition-all shadow-md shadow-purple-900/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <div className="shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-xs font-bold text-slate-700">{locationLabel}</span>
            <span className="text-[10px] text-slate-400">— {filterLevel} Level</span>
          </div>
          {reportGenerated && (
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${tierInfo.bg} ${tierInfo.color}`}>{tierInfo.label}</span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
          <KpiCard loading={loading} icon={<Users className="w-4 h-4 text-purple-600" />} iconBg="bg-purple-50"
            label="Population (13–15 Yrs)" value={fmt(kpis.totalPop)} />
          <KpiCard loading={loading} icon={<Target className="w-4 h-4 text-green-600" />} iconBg="bg-green-50"
            label="Goal (0.8%)" value={fmt(kpis.totalTarget)} valueColor="text-green-700"
            subValue={fmt(kpis.totalVaccToday)} subLabel="Today" />
          <KpiCard loading={loading} icon={<Syringe className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50"
            label="HPV Vaccinations" value={fmt(kpis.totalVaccCumm)}
            subValue={fmt(kpis.totalVaccToday)} subLabel="Today" />
          <KpiCard loading={loading} icon={<Calendar className="w-4 h-4 text-orange-500" />} iconBg="bg-orange-50"
            label="Sessions Held" value={fmt(kpis.totalSessionsCumm)}
            subValue={fmt(kpis.totalSessionsToday)} subLabel="Today" />
          <KpiCard loading={loading} icon={<Activity className="w-4 h-4 text-teal-600" />} iconBg="bg-teal-50"
            label="Vacc / Session" value={fmt(kpis.vaccPerSession, 2)} subLabel="cumulative avg" />

          {/* Circular Progress — same vertical layout as other cards */}
          <div className="bg-white rounded-xl px-3 py-3 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
            {loading ? (
              <div className="animate-pulse flex flex-col gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-200" />
                <div className="h-2.5 bg-slate-200 rounded w-2/3" />
                <div className="h-5 bg-slate-200 rounded w-3/4" />
              </div>
            ) : (
              <>
                {/* Ring icon — same size as other card icons */}
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, flexShrink: 0, marginBottom: 8 }}>
                  <CircularProgress pct={kpis.coveragePct} size={32} />
                  <div style={{ position: 'absolute', fontSize: 7, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>
                    {fmt(kpis.coveragePct, 0)}%
                  </div>
                </div>
                {/* Label — same fixed min-height */}
                <div className="text-[10px] font-semibold text-slate-500 leading-tight" style={{ minHeight: '2.4em' }}>Goal Achieved</div>
                {/* Value */}
                <div className={`text-base font-extrabold leading-tight mt-1 ${coverageTier(kpis.coveragePct).color}`}>{fmt(kpis.coveragePct, 1)}%</div>
                {/* Sub — tier label */}
                <div className={`text-[10px] font-semibold leading-tight mt-0.5 ${coverageTier(kpis.coveragePct).color}`} style={{ minHeight: '1.3em' }}>
                  {tierInfo.label.split(' ')[0]}
                </div>
              </>
            )}
          </div>

          <KpiCard loading={loading} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50"
            label="Reporting Today" value={fmt(kpis.reportingToday)}
            subValue={`of ${rows.length}`} subLabel={`${filterLevel.toLowerCase()}s`} />
        </div>
      </div>

      {/* ── Second Toolbar (below cards) ───────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-2.5 flex flex-wrap items-center gap-3 justify-between shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-purple-500" />
          <span>Report Date:</span>
          <span className="font-extrabold text-slate-900">{fmtDate(reportDateLabel || today)}</span>
        </div>

        {/* Sort direction */}
        <div className="flex items-center gap-3">
          {(['best', 'worst'] as SortDir[]).map(val => (
            <label key={val} className="flex items-center gap-1.5 cursor-pointer select-none">
              <div
                onClick={() => setSortDir(val)}
                className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${sortDir === val ? 'border-purple-600' : 'border-slate-300'}`}
              >
                {sortDir === val && <div className="w-1.5 h-1.5 rounded-full bg-purple-600" />}
              </div>
              <span className={`text-xs font-semibold cursor-pointer ${sortDir === val ? 'text-purple-700' : 'text-slate-500'}`}
                onClick={() => setSortDir(val)}>
                {val === 'best' ? 'Best on Top' : 'Worst on Top'}
              </span>
            </label>
          ))}
        </div>

        {/* Ranked By */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ranked By</span>
          <div className="relative">
            <select value={rankBy} onChange={e => setRankBy(e.target.value as RankBy)}
              className="pl-2.5 pr-7 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer">
              <option value="vaccination_coverage_pct">Coverage (%)</option>
              <option value="sessions_held_cumulative">Sessions Held</option>
              <option value="beneficiaries_vaccinated">Vaccinations</option>
              <option value="vaccinations_per_session">Vaccinations/Session</option>
              <option value="sessions_held_today">Sessions Today</option>
              <option value="vaccinated_today">Vaccinations Today</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Data Table — flex-1 so it fills remaining space ────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-0 overflow-hidden">

        {/* Table toolbar */}
        <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">
              {filtered.length} {filterLevel}{filtered.length !== 1 ? 's' : ''}
            </span>
            {reportGenerated && !loading && (
              <span className="text-[10px] text-slate-400">• {rows.filter(r => r.has_today_report).length} reported today</span>
            )}
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input type="text" placeholder="Search by name..." value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400" style={{ width: 200 }} />
          </div>
        </div>

        {/* Scrollable table body */}
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full" style={{ fontSize: '11px' }}>
            <thead className="sticky top-0 z-10">
              <tr className="gradient-header text-white">
                <th className="px-2 py-1.5 text-left font-bold uppercase tracking-wide whitespace-nowrap sticky left-0 gradient-header z-20" style={{ minWidth: 140 }}>Reporting Unit</th>
                <th className="px-2 py-1.5 text-center font-bold uppercase tracking-wide whitespace-nowrap">Last Reported</th>
                <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wide whitespace-nowrap">Population</th>
                <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wide whitespace-nowrap">HPV Goal</th>
                <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wide whitespace-nowrap">Sess. Today</th>
                <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wide whitespace-nowrap">Vacc. Today</th>
                <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wide whitespace-nowrap">Sess. Cumul.</th>
                <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wide whitespace-nowrap">Vacc. Cumul.</th>
                <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wide whitespace-nowrap">Vacc/Sess</th>
                <th className="px-2 py-1.5 text-center font-bold uppercase tracking-wide whitespace-nowrap">Goal %</th>
                <th className="px-2 py-1.5 text-center font-bold uppercase tracking-wide whitespace-nowrap">Rank</th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />) :
              paginated.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-10 h-10 text-slate-300" />
                      <p className="text-slate-400 font-semibold text-sm">
                        {reportGenerated ? 'No matching records found.' : 'Click Generate Report to load data.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : paginated.map((row: any, idx: number) => {
                const isEven = idx % 2 === 0;
                const coveragePct = row.vaccination_coverage_pct;
                const tier = coverageTier(coveragePct);
                const rankNum = row.rank;
                const rankBadge = rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : `#${rankNum}`;
                const rowBg = isEven ? 'bg-white' : 'bg-slate-50/60';
                return (
                  <tr key={row.id} className={`border-b border-slate-100 hover:bg-purple-50/30 transition-colors group ${rowBg}`}>
                    <td className={`px-2 py-1.5 font-bold text-slate-800 sticky left-0 z-[5] border-r border-slate-100 ${rowBg} group-hover:bg-purple-50/30`}>{row.name}</td>
                    <td className="px-2 py-1.5 text-center">
                      {row.has_report
                        ? <span className="font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{fmtDate(row.last_reporting_date)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-700">{fmt(row.population)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-green-700">{fmt(row.hpv_target)}</td>
                    <td className="px-2 py-1.5 text-right">
                      {row.sessions_held_today !== null
                        ? <span className="font-bold text-orange-700">{fmt(row.sessions_held_today)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {row.vaccinated_today !== null
                        ? <span className="font-bold text-blue-700">{fmt(row.vaccinated_today)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-orange-600">{row.sessions_held_cumulative !== null ? fmt(row.sessions_held_cumulative) : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-blue-700">{row.beneficiaries_vaccinated !== null ? fmt(row.beneficiaries_vaccinated) : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-teal-700">{row.vaccinations_per_session !== null ? fmt(row.vaccinations_per_session, 2) : '—'}</td>
                    <td className="px-2 py-1.5 text-center">
                      {coveragePct !== null ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-14 bg-slate-200 rounded-full h-1">
                            <div className="h-1 rounded-full transition-all"
                              style={{ width: `${Math.min(coveragePct, 100)}%`, background: coveragePct >= 90 ? '#10b981' : coveragePct >= 70 ? '#14b8a6' : coveragePct >= 30 ? '#3b82f6' : '#f97316' }} />
                          </div>
                          <span className={`font-bold ${tier.color}`}>{fmt(coveragePct, 1)}%</span>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-center"><span className="font-black">{rankBadge}</span></td>
                  </tr>
                );
              })}
            </tbody>
            {!loading && paginated.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#3B1C63]/20 font-bold text-slate-800" style={{ background: 'rgba(59,28,99,0.04)', fontSize: '11px' }}>
                  <td className="px-2 py-1.5 font-extrabold sticky left-0 border-r border-slate-200" style={{ background: 'rgba(59,28,99,0.04)' }}>TOTAL ({rows.length})</td>
                  <td className="px-2 py-1.5 text-center text-slate-400">—</td>
                  <td className="px-2 py-1.5 text-right">{fmt(kpis.totalPop)}</td>
                  <td className="px-2 py-1.5 text-right text-green-700">{fmt(kpis.totalTarget)}</td>
                  <td className="px-2 py-1.5 text-right text-orange-700">{fmt(kpis.totalSessionsToday)}</td>
                  <td className="px-2 py-1.5 text-right text-blue-700">{fmt(kpis.totalVaccToday)}</td>
                  <td className="px-2 py-1.5 text-right text-orange-600">{fmt(kpis.totalSessionsCumm)}</td>
                  <td className="px-2 py-1.5 text-right text-blue-700">{fmt(kpis.totalVaccCumm)}</td>
                  <td className="px-2 py-1.5 text-right text-teal-700">{fmt(kpis.vaccPerSession, 2)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`font-extrabold ${coverageTier(kpis.coveragePct).color}`}>{fmt(kpis.coveragePct, 1)}%</span>
                  </td>
                  <td className="px-2 py-1.5 text-center text-slate-400">—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-[10px] text-slate-500 font-medium">
              Showing {((currentPage - 1) * rowsPerPage) + 1}–{Math.min(currentPage * rowsPerPage, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const page = totalPages <= 7 ? i + 1 : currentPage <= 4 ? i + 1 : currentPage >= totalPages - 3 ? totalPages - 6 + i : currentPage - 3 + i;
                return (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-colors ${currentPage === page ? 'bg-purple-700 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                    {page}
                  </button>
                );
              })}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyProgressReport;
