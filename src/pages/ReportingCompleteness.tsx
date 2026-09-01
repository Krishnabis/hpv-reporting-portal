import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar, Download, BarChart3, ChevronDown, Search,
  ChevronLeft, ChevronRight, Activity, Target, Users,
  Syringe, Filter, RefreshCw, CheckCircle2, AlertCircle, MapPin, Camera, PieChart, Clock, Info, FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  isUrban?: boolean;
}

interface CompletenessKPIs {
  expected: number;
  received: number;
  reportingPct: number;
  onTimePct: number;
  units: number;
}

const CircularProgress: React.FC<{ pct: number; size?: number; strokeWidth?: number }> = ({ pct, size = 72, strokeWidth = 8 }) => {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const radius = (size - 10) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (clampedPct / 100) * circ;
  const color = clampedPct >= 90 ? '#10b981' : clampedPct >= 70 ? '#14b8a6' : clampedPct >= 30 ? '#3b82f6' : '#f97316';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
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
  const [level, setLevel] = useState<'State' | 'Division'>('State');
  
  const [reportType, setReportType] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [kpis, setKpis] = useState<CompletenessKPIs | null>(null);
  const [rows, setRows] = useState<CompletenessRow[]>([]);
  
  const [order, setOrder] = useState<'best' | 'worst'>('best');
  const [rankedBy, setRankedBy] = useState<'reporting' | 'ontime'>('reporting');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const hasFetched = useRef(false);
  useEffect(() => {
    if (!hasFetched.current) {
      const timer = setTimeout(() => {
        fetchReport();
      }, 0);
      hasFetched.current = true;
      return () => clearTimeout(timer);
    }
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const q = new URLSearchParams({
        level,
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
        `"${r.unitName}${r.isUrban ? ' (Urban)' : ''}"`, `"${r.reportName}"`, `"${r.frequency}"`, `"${formatDate(r.lastReported)}"`,
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

  const downloadPdf = async () => {
    if (!sortedRows.length) return;
    setIsDownloadingPdf(true);
    try {
      const pdf = new jsPDF('l', 'mm', 'a4');
      pdf.setFontSize(18);
      pdf.text('HPV KAVACH \u2014 Reporting Completeness', 14, 20);
      autoTable(pdf, {
        startY: 30,
        head: [['Reporting Unit', 'Report Name', 'Frequency', 'Reports Expected', 'Reports Submitted', 'Reporting (%)', 'On Time (%)', 'Status']],
        body: sortedRows.map(r => [`${r.unitName}${r.isUrban ? ' (Urban)' : ''}`, r.reportName, r.frequency, r.expected, r.submitted, r.reportingPct, r.onTimePct, r.status]),
      });
      pdf.save(`Completeness_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      console.error("PDF generation failed", e);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Complete': return <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200"><CheckCircle2 className="w-3.5 h-3.5" /> Complete</div>;
      case 'Late': return <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200"><Clock className="w-3.5 h-3.5" /> Late</div>;
      default: return <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200"><AlertCircle className="w-3.5 h-3.5" /> Pending</div>;
    }
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 max-w-7xl mx-auto">
          <div>
            <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              HPV KAVACH – Reporting Completeness & Timeliness Report
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Tracks reporting completeness and timeliness of Daily and Monthly reports across Reporting Units.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadPdf} disabled={isDownloadingPdf} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 transition-colors shrink-0">
              {isDownloadingPdf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-slate-500" />} Download PDF
            </button>
            <button onClick={downloadCsv} disabled={!rows.length} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 transition-colors shrink-0">
              <Download className="w-4 h-4" /> Download CSV
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 py-4 flex flex-col gap-4 overflow-hidden flex-1">
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-3 shrink-0">
          <div className="flex items-end gap-3">
            <div className="w-[120px] shrink-0">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">State</label>
              <div className="relative">
                <select disabled className="w-full appearance-none bg-slate-50 border-2 border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 pr-7 focus:outline-none transition-all cursor-not-allowed">
                  <option>Uttarakhand</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
              </div>
            </div>
            
            <div className="w-[160px] shrink-0">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Area</label>
              <div className="relative">
                <select value={level} onChange={e => setLevel(e.target.value as any)} className="w-full appearance-none bg-slate-50 border-2 border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 pr-7 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer">
                  <option value="State">State</option>
                  <option value="Division">Division</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Report Selector</label>
              <div className="relative">
                <select value={reportType} onChange={e => setReportType(e.target.value)} className="w-full appearance-none bg-slate-50 border-2 border-slate-200 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 pr-7 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer">
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
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 text-[11px] font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
            </div>

            <div className="w-[125px] shrink-0">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">To Date</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 text-[11px] font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" />
            </div>

            <button onClick={fetchReport} disabled={loading} className="shrink-0 flex items-center justify-center gap-2 px-5 font-bold text-xs text-white bg-gradient-to-r from-[#3B1C63] to-[#522B85] hover:from-[#522B85] hover:to-[#6d3aad] rounded-lg transition-all shadow-md shadow-purple-900/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 h-[34px] cursor-pointer">
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
              Generate Report
            </button>
          </div>
        </div>

        <div className="bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-200 flex items-center w-full shrink-0">
          <div className="flex-1 text-[11px] font-bold text-slate-700 flex items-center justify-start">
            <span className="text-slate-500 font-medium mr-2">Report Period:</span>
            {new Date(fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} to {new Date(toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          
          <div className="flex-1 flex items-center justify-center gap-4">
            <span className="text-[11px] font-bold text-slate-700">Order:</span>
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-600">
              <input type="radio" checked={order === 'best'} onChange={() => setOrder('best')} className="w-3.5 h-3.5 text-[#522B85] border-slate-300 focus:ring-[#522B85]" />
              Best on Top
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-600">
              <input type="radio" checked={order === 'worst'} onChange={() => setOrder('worst')} className="w-3.5 h-3.5 text-[#522B85] border-slate-300 focus:ring-[#522B85]" />
              Worst on Top
            </label>
          </div>
          
          <div className="flex-1 flex items-center justify-end gap-2">
            <span className="text-[11px] font-bold text-slate-700">Ranked By:</span>
            <select value={rankedBy} onChange={e => setRankedBy(e.target.value as any)} className="bg-slate-50 border-2 border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-[#522B85] focus:ring-2 focus:ring-[#522B85]/20">
              <option value="reporting">Reporting (%) (Default)</option>
              <option value="ontime">On Time (%)</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100 shrink-0">
          <div className="flex-1 p-3 flex items-center gap-3 pl-5 py-4">
            <div className="w-9 h-9 bg-purple-50 text-[#522B85] rounded-xl flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[13px] font-black text-slate-900">{level === 'State' ? 'All Blocks (Statewide)' : 'All Districts (Statewide)'}</h3>
              <p className="text-[10px] text-slate-500 font-medium">Report Selector: {reportType === 'ALL' ? 'All Reports' : reportType.replace(/_/g, ' ')}</p>
            </div>
          </div>
          
          <div className="flex-1 p-3 flex items-center justify-center gap-6 py-4">
            <div className="text-center">
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Reports Expected</div>
              <div className="text-lg font-black text-slate-900 leading-none">{kpis?.expected.toLocaleString() || '—'}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Reports Received</div>
              <div className="text-lg font-black text-slate-900 leading-none">{kpis?.received.toLocaleString() || '—'}</div>
            </div>
          </div>
          
          <div className="flex-1 p-3 flex items-center justify-center gap-4 py-4 pr-5">
            <div className="flex flex-col gap-0.5">
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider text-right">Overall Reporting (%)</div>
              <div className="text-xl font-black text-emerald-600 text-right leading-none">{kpis?.reportingPct || 0}%</div>
            </div>
            <CircularProgress pct={kpis?.reportingPct || 0} size={48} strokeWidth={5} />
            <div className="h-8 border-l border-slate-200"></div>
            <div className="text-center">
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Reporting Units</div>
              <div className="text-lg font-black text-slate-900 leading-none mt-1">{kpis?.units.toLocaleString() || '—'}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-[400px]">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="gradient-header text-white shadow-sm">
                  <th className="px-2 py-2 text-[10px] font-extrabold text-white uppercase tracking-wider whitespace-nowrap border-b border-purple-900/30 border-r border-purple-900/20">Reporting Unit</th>
                  <th className="px-2 py-2 text-[10px] font-extrabold text-white uppercase tracking-wider whitespace-nowrap border-b border-purple-900/30 border-r border-purple-900/20">Report Name</th>
                  <th className="px-2 py-2 text-[10px] font-extrabold text-white uppercase tracking-wider whitespace-nowrap border-b border-purple-900/30 border-r border-purple-900/20">Frequency</th>
                  <th className="px-2 py-2 text-[10px] font-extrabold text-white uppercase tracking-wider whitespace-nowrap border-b border-purple-900/30 border-r border-purple-900/20">Last Reported</th>
                  <th className="px-2 py-2 text-[10px] font-extrabold text-purple-100 uppercase tracking-wider whitespace-nowrap border-b border-purple-900/30 text-center border-r border-purple-900/20" title="Hidden internally but visible here">Reports Expected<br/><span className="text-[9px] font-medium opacity-80">(Hidden)</span></th>
                  <th className="px-2 py-2 text-[10px] font-extrabold text-white uppercase tracking-wider whitespace-nowrap border-b border-purple-900/30 text-center border-r border-purple-900/20">Reports<br/>Submitted</th>
                  <th className="px-2 py-2 text-[10px] font-extrabold text-white uppercase tracking-wider whitespace-nowrap border-b border-purple-900/30 border-r border-purple-900/20">Reporting (%)</th>
                  <th className="px-2 py-2 text-[10px] font-extrabold text-white uppercase tracking-wider whitespace-nowrap border-b border-purple-900/30 border-r border-purple-900/20">On Time (%)</th>
                  <th className="px-2 py-2 text-[10px] font-extrabold text-amber-300 uppercase tracking-wider whitespace-nowrap border-b border-purple-900/30 text-center">Current Status<br/><span className="text-[9px] font-medium opacity-80">(Complete / Late / Pending)</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-2 py-8 text-center text-slate-500">
                      No reports found matching your filters
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-2 py-1.5 border-r border-slate-100/50">
                        <div className="font-bold text-[#3B1C63] text-xs flex items-center gap-1.5">
                          {r.unitName}
                          {r.isUrban && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wider">
                              Urban
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-xs text-slate-600 font-medium border-r border-slate-100/50">{r.reportName}</td>
                      <td className="px-2 py-1.5 text-xs text-slate-600 border-r border-slate-100/50">{r.frequency}</td>
                      <td className="px-2 py-1.5 text-xs font-bold border-r border-slate-200">
                        {r.lastReported ? (
                          <span className="text-emerald-700 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500" /> {formatDate(r.lastReported)}</span>
                        ) : (
                          <span className="text-slate-400 font-medium italic">Never</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-sm font-bold text-slate-700 text-center bg-[#f8fafc] border-r border-slate-200/60">{r.expected}</td>
                      <td className="px-2 py-1.5 text-sm font-black text-[#522B85] text-center bg-purple-50/30 border-r border-slate-200/60">{r.submitted}</td>
                      <td className="px-2 py-1.5 border-r border-slate-100/50 bg-[#faf9fb] align-top">
                        <div className="flex flex-col gap-1 w-12 mt-0.5">
                          <span className={`text-[11px] leading-none font-bold ${r.reportingPct >= 70 ? 'text-emerald-600' : r.reportingPct >= 30 ? 'text-orange-500' : r.reportingPct > 0 ? 'text-amber-600' : 'text-rose-500'}`}>{r.reportingPct}%</span>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden shrink-0">
                            <div className={`h-full ${r.reportingPct >= 70 ? 'bg-emerald-500' : r.reportingPct >= 30 ? 'bg-orange-500' : 'bg-amber-500'}`} style={{ width: `${r.reportingPct}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 border-r border-slate-100/50 bg-[#faf9fb] align-top">
                        <div className="flex flex-col gap-1 w-12 mt-0.5">
                          <span className={`text-[11px] leading-none font-bold ${r.onTimePct >= 70 ? 'text-emerald-600' : r.onTimePct >= 30 ? 'text-orange-500' : r.onTimePct > 0 ? 'text-amber-600' : 'text-rose-500'}`}>{r.onTimePct}%</span>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden shrink-0">
                            <div className={`h-full ${r.onTimePct >= 70 ? 'bg-emerald-500' : r.onTimePct >= 30 ? 'bg-orange-500' : 'bg-amber-500'}`} style={{ width: `${r.onTimePct}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center bg-amber-50/10">
                        {getStatusBadge(r.status)}
                      </td>
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
