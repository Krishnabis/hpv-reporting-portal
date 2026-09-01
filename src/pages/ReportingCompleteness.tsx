import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar, Download, BarChart3, ChevronDown, Search,
  ChevronLeft, ChevronRight, Activity, Target, Users,
  Syringe, Filter, RefreshCw, CheckCircle2, AlertCircle, MapPin, Camera, PieChart, Clock, Info
} from 'lucide-react';

interface CompletenessRow {
  unitName: string;
  reportName: string;
  frequency: string;
  lastReported: string | null;
  expected: number;
  submitted: number;
  reportingPct: number;
  onTimePct: number;
  status: 'Complete' | 'Late' | 'Pending';
}

interface CompletenessKPIs {
  expected: number;
  received: number;
  reportingPct: number;
  onTimePct: number;
  units: number;
}

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

export const ReportingCompleteness: React.FC<{
  states: any[];
  allDistricts: any[];
  masterBlocks: any[];
  divisions: any[];
  adminUser: any;
}> = ({ states, allDistricts, masterBlocks, divisions, adminUser }) => {
  const [loading, setLoading] = useState(false);
  const [level, setLevel] = useState<'State' | 'Division' | 'District' | 'Block'>('District');
  const [locationId, setLocationId] = useState<string>('ALL');
  const [reportType, setReportType] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  
  const [kpis, setKpis] = useState<CompletenessKPIs | null>(null);
  const [rows, setRows] = useState<CompletenessRow[]>([]);
  
  const [order, setOrder] = useState<'best' | 'worst'>('best');
  const [rankedBy, setRankedBy] = useState<'reporting' | 'ontime'>('reporting');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Deriving location options
  const locationOptions = useMemo(() => {
    let opts = [{ id: 'ALL', name: `All ${level}s` }];
    if (level === 'State') opts = opts.concat(states.map(s => ({ id: s.id.toString(), name: s.name })));
    if (level === 'Division') opts = opts.concat(divisions.map(d => ({ id: d.id.toString(), name: d.name })));
    if (level === 'District') opts = opts.concat(allDistricts.map(d => ({ id: d.id.toString(), name: d.name })));
    if (level === 'Block') opts = opts.concat(masterBlocks.map(b => ({ id: b.id.toString(), name: b.name })));
    return opts;
  }, [level, states, divisions, allDistricts, masterBlocks]);

  // Set default location when level changes
  useEffect(() => {
    if (adminUser?.role === 'DISTRICT_ADMIN' && adminUser.district_id) {
       if (level === 'District') setLocationId(adminUser.district_id.toString());
       else setLocationId('ALL');
    } else {
       setLocationId('ALL');
    }
  }, [level, adminUser]);

  const hasFetched = useRef(false);
  useEffect(() => {
    if (!hasFetched.current && locationId) {
      // Small timeout to allow state to settle if it was just changed
      const timer = setTimeout(() => {
        fetchReport();
      }, 0);
      hasFetched.current = true;
      return () => clearTimeout(timer);
    }
  }, [locationId]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const q = new URLSearchParams({
        level,
        location_id: locationId,
        report_type: reportType,
        from_date: fromDate,
        to_date: toDate
      });
      const res = await fetch(`/api/admin/reports/completeness?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setKpis(data.kpis);
      setRows(data.rows);
      setPage(1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let valA = rankedBy === 'reporting' ? a.reportingPct : a.onTimePct;
      let valB = rankedBy === 'reporting' ? b.reportingPct : b.onTimePct;
      return order === 'best' ? valB - valA : valA - valB;
    });
  }, [rows, order, rankedBy]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  const totalPages = Math.ceil(sortedRows.length / pageSize);

  const formatDate = (ds: string | null) => {
    if (!ds) return '—';
    const d = new Date(ds);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' +
           d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const downloadCsv = () => {
    if (!rows.length) return;
    const headers = ['Reporting Unit', 'Report Name', 'Frequency', 'Last Reported', 'Reports Expected', 'Reports Submitted', 'Reporting (%)', 'On Time (%)', 'Current Status'];
    const csvContent = [
      headers.join(','),
      ...sortedRows.map(r => [
        `"${r.unitName}"`, `"${r.reportName}"`, `"${r.frequency}"`, `"${formatDate(r.lastReported)}"`,
        r.expected, r.submitted, `${r.reportingPct}%`, `${r.onTimePct}%`, r.status
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Completeness_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Complete': return <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200"><CheckCircle2 className="w-3.5 h-3.5" /> Complete</div>;
      case 'Late': return <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200"><Clock className="w-3.5 h-3.5" /> Late</div>;
      default: return <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200"><AlertCircle className="w-3.5 h-3.5" /> Pending</div>;
    }
  };

  const ProgressBar = ({ pct }: { pct: number }) => {
    const color = pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : pct >= 30 ? 'bg-orange-500' : 'bg-rose-500';
    return (
      <div className="flex flex-col gap-1 w-24">
        <span className={`text-xs font-bold ${color.replace('bg-', 'text-')}`}>{pct}%</span>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 max-w-7xl mx-auto">
          <div>
            <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              HPV KAVACH – Reporting Completeness & Timeliness Report
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Tracks reporting completeness and timeliness of Daily and Monthly reports across Reporting Units.</p>
          </div>
          <button onClick={downloadCsv} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold shadow-sm transition-all whitespace-nowrap">
            <Download className="w-3.5 h-3.5" />
            Download CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 py-4 flex flex-col gap-4">
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3">
          <div className="flex items-end gap-3">
            <div className="w-[120px] shrink-0">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Reporting Level</label>
              <div className="relative">
                <select value={level} onChange={e => { setLevel(e.target.value as any); }} className="w-full appearance-none bg-slate-50 border-2 border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 pr-7 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer">
                  <option value="State">State</option>
                  <option value="Division">Division</option>
                  <option value="District">District</option>
                  <option value="Block">Block</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
            
            <div className="w-[160px] shrink-0">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">{level}</label>
              <div className="relative">
                <select value={locationId} onChange={e => setLocationId(e.target.value)} className="w-full appearance-none bg-slate-50 border-2 border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 pr-7 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis">
                  {locationOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Report Selector</label>
              <div className="relative">
                <select value={reportType} onChange={e => setReportType(e.target.value)} className="w-full appearance-none bg-slate-50 border-2 border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 pr-7 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis">
                  <option value="ALL">All Reports</option>
                  <option value="DAILY_PROGRESS">Daily Progress Report</option>
                  <option value="MONTHLY_DUE_LIST">Monthly Due List Report</option>
                  <option value="MONTHLY_STOCK">Monthly Vaccine Stock Balance Report</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="w-[125px] shrink-0">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">From Date</label>
              <div className="relative">
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 text-[11px] font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-text [color-scheme:light]" />
              </div>
            </div>

            <div className="w-[125px] shrink-0">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">To Date</label>
              <div className="relative">
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 text-[11px] font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-text [color-scheme:light]" />
              </div>
            </div>

            <button onClick={fetchReport} disabled={loading} className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#0f3484] hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow-sm hover:shadow transition-all disabled:opacity-70 disabled:cursor-not-allowed h-[34px]">
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
              Generate
            </button>
          </div>
        </div>

        {/* Sub filters */}
        <div className="bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs font-bold text-slate-700 flex items-center">
            <span className="text-slate-500 font-medium mr-2">Report Period:</span>
            {new Date(fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} to {new Date(toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-slate-700">Order:</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600">
                <input type="radio" checked={order === 'best'} onChange={() => setOrder('best')} className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 border-slate-300" />
                Best on Top
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600">
                <input type="radio" checked={order === 'worst'} onChange={() => setOrder('worst')} className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 border-slate-300" />
                Worst on Top
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Ranked By:</span>
              <select value={rankedBy} onChange={e => setRankedBy(e.target.value as any)} className="bg-slate-50 border-2 border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                <option value="reporting">Reporting (%) (Default)</option>
                <option value="ontime">On Time (%)</option>
              </select>
            </div>
          </div>
        </div>

        {/* KPI Panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
          <div className="p-4 md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-[#0f3484] rounded-xl flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">{locationOptions.find(o => o.id === locationId)?.name || 'All Locations'}</h3>
              <p className="text-xs text-slate-500 font-medium">Report Selector: {reportType === 'ALL' ? 'All Reports' : reportType.replace(/_/g, ' ')}</p>
            </div>
          </div>
          
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 p-4 gap-4 items-center">
            <div className="text-center">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reports Expected</div>
              <div className="text-xl font-black text-slate-900">{kpis?.expected.toLocaleString() || '—'}</div>
            </div>
            <div className="text-center border-r border-slate-100">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reports Received</div>
              <div className="text-xl font-black text-slate-900">{kpis?.received.toLocaleString() || '—'}</div>
            </div>
            
            <div className="col-span-2 flex items-center justify-between px-3">
              <div className="flex flex-col gap-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Overall Reporting (%)</div>
                <div className="text-2xl font-black text-emerald-600 text-right">{kpis?.reportingPct || 0}%</div>
                <div className="text-xs font-bold text-slate-500 text-right">On Time <span className={kpis?.onTimePct && kpis.onTimePct >= 70 ? 'text-emerald-600' : 'text-amber-600'}>{kpis?.onTimePct || 0}%</span></div>
              </div>
              <CircularProgress pct={kpis?.reportingPct || 0} size={64} />
              
              <div className="text-center ml-3 pl-4 border-l border-slate-100">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Reporting Units</div>
                <div className="text-xl font-black text-slate-900">{kpis?.units.toLocaleString() || '—'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[500px]">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#f8fafd]">
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-[#0f3484] uppercase tracking-wider whitespace-nowrap border-b border-slate-200 border-r border-slate-100/50">Reporting Unit</th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-[#0f3484] uppercase tracking-wider whitespace-nowrap border-b border-slate-200 border-r border-slate-100/50">Report Name</th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-[#0f3484] uppercase tracking-wider whitespace-nowrap border-b border-slate-200 border-r border-slate-100/50">Frequency</th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-[#0f3484] uppercase tracking-wider whitespace-nowrap border-b border-slate-200 border-r border-slate-200">Last Reported</th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-[#5072a7] uppercase tracking-wider whitespace-nowrap bg-[#eff4f9] border-b border-[#dce3ec] text-center border-r border-[#dce3ec]" title="Hidden internally but visible here">Reports Expected<br/><span className="text-[9px] font-medium">(Hidden)</span></th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-[#0f3484] uppercase tracking-wider whitespace-nowrap bg-[#e2ecf9] border-b border-[#c8d8ea] text-center border-r border-[#c8d8ea]">Reports<br/>Submitted</th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-[#0f3484] uppercase tracking-wider whitespace-nowrap bg-[#f3eff7] border-b border-[#e1d9ea] border-r border-[#e1d9ea]">Reporting (%)</th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-[#0f3484] uppercase tracking-wider whitespace-nowrap bg-[#f3eff7] border-b border-[#e1d9ea] border-r border-[#e1d9ea]">On Time (%)</th>
                  <th className="px-3 py-2.5 text-[10px] font-extrabold text-amber-900 uppercase tracking-wider whitespace-nowrap bg-amber-50 border-b border-amber-200 text-center">Current Status<br/><span className="text-[9px] font-medium">(Complete / Late / Pending)</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500 font-medium bg-slate-50">
                      {loading ? 'Analyzing reports...' : 'No data found for the selected criteria. Try adjusting your filters or generating a new report.'}
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-2.5 text-xs font-bold text-blue-600 whitespace-nowrap border-r border-slate-50">{r.unitName}</td>
                      <td className="px-3 py-2.5 text-xs font-medium text-slate-700 whitespace-nowrap border-r border-slate-50">{r.reportName}</td>
                      <td className="px-3 py-2.5 text-xs font-medium text-slate-600 whitespace-nowrap border-r border-slate-50">{r.frequency}</td>
                      <td className="px-3 py-2.5 text-xs font-bold text-slate-600 whitespace-nowrap flex items-center gap-1.5 border-r border-slate-50">
                        {r.lastReported ? <span className="text-emerald-600">{formatDate(r.lastReported)}</span> : '—'}
                        {r.lastReported && r.status === 'Complete' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : (r.status === 'Pending' ? <AlertCircle className="w-3.5 h-3.5 text-rose-500" /> : <Clock className="w-3.5 h-3.5 text-amber-500" />)}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-bold text-slate-700 text-center bg-slate-50/50 border-r border-slate-100">{r.expected}</td>
                      <td className="px-3 py-2.5 text-xs font-bold text-slate-800 text-center bg-blue-50/30 border-r border-blue-100/50">{r.submitted}</td>
                      <td className="px-3 py-2.5 border-r border-purple-50/50"><ProgressBar pct={r.reportingPct} /></td>
                      <td className="px-3 py-2.5 border-r border-purple-50/50"><ProgressBar pct={r.onTimePct} /></td>
                      <td className="px-3 py-2.5 text-center">{getStatusBadge(r.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm text-slate-600 font-medium">
              Show
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-800 focus:outline-none focus:border-blue-500">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              records per page
              <span className="ml-4">
                Showing {sortedRows.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, sortedRows.length)} of {sortedRows.length} records
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, i, arr) => (
                <React.Fragment key={p}>
                  {i > 0 && arr[i - 1] !== p - 1 && <span className="px-2 text-slate-400">...</span>}
                  <button onClick={() => setPage(p)} className={`min-w-[32px] h-8 rounded text-sm font-bold transition-colors ${page === p ? 'bg-[#0f3484] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{p}</button>
                </React.Fragment>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="p-1.5 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
        
        {/* Footer Note */}
        <div className="bg-[#f0f4f8] rounded-xl px-4 py-3 border border-blue-100 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-slate-700">
            <span className="font-bold">Note:</span> Daily Progress Report is expected every day. Monthly Due List Report and Monthly Vaccine Stock Balance Report are expected by the 5th of each month.
          </p>
        </div>

      </div>
    </div>
  );
};
