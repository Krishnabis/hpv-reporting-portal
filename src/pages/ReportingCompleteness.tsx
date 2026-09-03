import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar, Download, BarChart3, ChevronDown, Search, Maximize2, Minimize2,
  ChevronLeft, ChevronRight, Activity, Target, Users,
  Syringe, Filter, RefreshCw, CheckCircle2, AlertCircle, MapPin, Camera, PieChart, Clock, Info, FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getDefaultLocationForUser } from '../utils/userLocation';

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
  states?: any[];
  allDistricts?: any[];
  masterBlocks?: any[];
  divisions?: any[];
  adminUser?: any;
}> = ({ states, allDistricts, masterBlocks, divisions, adminUser }) => {
  const [statesList, setStatesList] = useState<any[]>(states || []);
  const [districtsList, setDistrictsList] = useState<any[]>(allDistricts || []);
  const [filterStateId, setFilterStateId] = useState('');
  const [reportLevel, setReportLevel] = useState<'District' | 'Block Units'>('District');
  const [filterDistrictId, setFilterDistrictId] = useState('ALL');

  const [loading, setLoading] = useState(false);
  
  const [reportType, setReportType] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const [kpis, setKpis] = useState<CompletenessKPIs | null>(null);
  const [rows, setRows] = useState<CompletenessRow[]>([]);
  
  const [order, setOrder] = useState<'best' | 'worst'>('best');
  const [rankedBy, setRankedBy] = useState<'reporting' | 'ontime'>('reporting');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (states && states.length) setStatesList(states);
    if (allDistricts && allDistricts.length) setDistrictsList(allDistricts);

    if (!states || !states.length || !allDistricts || !allDistricts.length) {
      Promise.all([
        fetch('/api/locations/states').then(r => r.json()),
        fetch('/api/locations/districts').then(r => r.json()),
      ]).then(([sData, dData]) => {
        if (Array.isArray(sData) && sData.length) setStatesList(sData);
        if (Array.isArray(dData) && dData.length) setDistrictsList(dData);
      }).catch(console.error);
    }
  }, [states, allDistricts]);

  const defaultLocationSet = useRef(false);
  useEffect(() => {
    if (statesList.length > 0 && adminUser && !defaultLocationSet.current) {
      const defLoc = getDefaultLocationForUser(adminUser, statesList, districtsList);
      if (defLoc.stateId) setFilterStateId(defLoc.stateId);
      if (defLoc.districtId) setFilterDistrictId(defLoc.districtId);
      if (defLoc.defaultLevel) setReportLevel(defLoc.defaultLevel === 'Block Units' ? 'Block Units' : 'District');
      defaultLocationSet.current = true;
    }
  }, [statesList, districtsList, adminUser]);

  const stateDistricts = useMemo(() => districtsList.filter(d => !filterStateId || String(d.state_id) === filterStateId), [districtsList, filterStateId]);

  useEffect(() => {
    if (filterStateId || (filterDistrictId && filterDistrictId !== 'ALL')) {
      fetchReport();
    }
  }, [filterStateId, filterDistrictId, reportLevel, reportType, fromDate, toDate]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const apiLevel = reportLevel === 'District' ? 'District' : 'Block';
      const q = new URLSearchParams({
        level: apiLevel,
        report_type: reportType,
        from_date: fromDate,
        to_date: toDate
      });
      if (filterStateId) q.set('state_id', filterStateId);
      if (filterDistrictId && filterDistrictId !== 'ALL') {
        q.set('district_id', filterDistrictId);
      }
      const res = await fetch(`/api/admin/reports/completeness?${q.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setKpis(data.kpis);
      setRows(data.rows || []);
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
    // If it's a plain date string (YYYY-MM-DD), parse it as local date to avoid UTC timezone shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) {
      const [y, m, d] = ds.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const d = new Date(ds);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
      
      // Attempt to load and add logo
      try {
        const logoImg = new Image();
        logoImg.src = '/favicon.jpg';
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
        });
        pdf.addImage(logoImg, 'JPEG', 14, 10, 14, 14);
      } catch (e) {
        console.warn('Could not load favicon.jpg for PDF');
      }

      // Title
      pdf.setFontSize(18);
      pdf.setTextColor(15, 23, 42); // slate-900
      pdf.setFont('helvetica', 'bold');
      pdf.text('HPV Vaccination \u2014 Reporting Completeness & Timeliness', 32, 16);
      
      // Subtitle
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.setFont('helvetica', 'normal');
      pdf.text('Tracks reporting completeness and timeliness of Daily and Monthly reports across Reporting Units.', 32, 22);

      // Top Right:
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.setFont('helvetica', 'normal');
      const generatedDate = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(/ am| pm/i, m => m.toUpperCase());
      pdf.text(`Report Generated On: ${generatedDate}`, 282, 15, { align: 'right' });
      pdf.text('Page 1 of 1', 282, 20, { align: 'right' });

      // Time Duration
      pdf.setFontSize(10);
      pdf.setTextColor(30, 41, 59); // slate-800
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Time Duration: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 34);

      autoTable(pdf, {
        startY: 40,
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
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between shrink-0">
          <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
            HPV Vaccination – Reporting Completeness & Timeliness Report
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Tracks reporting completeness and timeliness of Daily and Monthly reports across Reporting Units.</p>
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

      {/* ── Filter Toolbar ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 shrink-0">
        <div className="flex flex-wrap gap-2.5 items-end">
          {/* State */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">State</label>
            <div className="relative">
              <select
                value={filterStateId}
                onChange={e => {
                  setFilterStateId(e.target.value);
                  setFilterDistrictId('ALL');
                }}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer"
                style={{ minWidth: 160 }}
              >
                {statesList.length > 0 ? (
                  statesList.map(s => (
                    <option key={s.id} value={String(s.id)}>{s.name}</option>
                  ))
                ) : (
                  <option value="">Uttarakhand</option>
                )}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Report Level */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Report Level</label>
            <div className="relative">
              <select
                value={reportLevel}
                onChange={e => setReportLevel(e.target.value as any)}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer"
                style={{ minWidth: 130 }}
              >
                <option value="District">District</option>
                <option value="Block Units">Block Units</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Districts */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Districts</label>
            <div className="relative">
              <select
                value={filterDistrictId}
                onChange={e => setFilterDistrictId(e.target.value)}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer"
                style={{ minWidth: 160 }}
              >
                <option value="ALL">All Districts</option>
                <option value="KUMAON">Kumaon</option>
                <option value="GARHWAL">Garhwal</option>
                {stateDistricts.map(d => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Report Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Report Selector</label>
            <div className="relative">
              <select
                value={reportType}
                onChange={e => setReportType(e.target.value)}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer"
                style={{ minWidth: 180 }}
              >
                <option value="ALL">All Reports</option>
                <option value="DAILY_PROGRESS">Daily Progress Report</option>
                <option value="MONTHLY_DUE_LIST">Monthly Due List Report</option>
                <option value="MONTHLY_STOCK">Monthly Vaccine Stock Balance Report</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* From Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="pl-2.5 pr-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 cursor-pointer"
              style={{ minWidth: 140 }}
            />
          </div>

          {/* To Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="pl-2.5 pr-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 cursor-pointer"
              style={{ minWidth: 140 }}
            />
          </div>

          {/* Generate Report Button */}
          <button
            onClick={fetchReport}
            disabled={loading}
            style={{ height: 36, borderRadius: 8, minWidth: 160 }}
            className="flex items-center justify-center gap-2 px-5 font-bold text-xs text-white bg-gradient-to-r from-[#3B1C63] to-[#522B85] hover:from-[#522B85] hover:to-[#6d3aad] rounded-lg transition-all shadow-md shadow-purple-900/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

        {!isExpanded && (
          <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-2.5 flex flex-wrap items-center gap-3 justify-between shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-purple-500" />
          <span>Report Period:</span>
          <span className="font-extrabold text-slate-900">{new Date(fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} to {new Date(toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <div onClick={() => setOrder('best')} className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${order === 'best' ? 'border-purple-600' : 'border-slate-300'}`}>
              {order === 'best' && <div className="w-1.5 h-1.5 rounded-full bg-purple-600" />}
            </div>
            <span className={`text-xs font-semibold cursor-pointer ${order === 'best' ? 'text-purple-700' : 'text-slate-500'}`} onClick={() => setOrder('best')}>Best on Top</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <div onClick={() => setOrder('worst')} className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${order === 'worst' ? 'border-purple-600' : 'border-slate-300'}`}>
              {order === 'worst' && <div className="w-1.5 h-1.5 rounded-full bg-purple-600" />}
            </div>
            <span className={`text-xs font-semibold cursor-pointer ${order === 'worst' ? 'text-purple-700' : 'text-slate-500'}`} onClick={() => setOrder('worst')}>Worst on Top</span>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ranked By</span>
          <div className="relative">
            <select value={rankedBy} onChange={e => setRankedBy(e.target.value as any)} className="pl-2.5 pr-7 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer">
              <option value="reporting">Reporting (%) (Default)</option>
              <option value="ontime">On Time (%)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1.5 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
          <div className="bg-white rounded-md shadow-sm border border-slate-200 p-2.5 flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-50 text-[#522B85] rounded-md flex items-center justify-center shrink-0">
              <BarChart3 className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-[11px] font-black text-slate-900">{reportLevel === 'Block Units' ? 'All Blocks (Statewide)' : 'All Districts (Statewide)'}</h3>
              <p className="text-[9px] text-slate-500 font-medium">Report Selector: {reportType === 'ALL' ? 'All Reports' : reportType.replace(/_/g, ' ')}</p>
            </div>
          </div>
          
          <div className="bg-white rounded-md shadow-sm border border-slate-200 p-2.5 flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Reports Expected</div>
              <div className="text-base font-black text-slate-900 leading-none">{kpis?.expected.toLocaleString() || '—'}</div>
            </div>
            <div className="text-center">
              <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Reports Received</div>
              <div className="text-base font-black text-slate-900 leading-none">{kpis?.received.toLocaleString() || '—'}</div>
            </div>
          </div>
          
          <div className="bg-white rounded-md shadow-sm border border-slate-200 p-2.5 flex items-center justify-center gap-4">
            <div className="flex flex-col gap-0.5">
              <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider text-right">Overall Reporting (%)</div>
              <div className="text-lg font-black text-emerald-600 text-right leading-none">{kpis?.reportingPct || 0}%</div>
            </div>
            <CircularProgress pct={kpis?.reportingPct || 0} size={32} strokeWidth={4} />
            <div className="h-6 border-l border-slate-200"></div>
            <div className="text-center">
              <div className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Reporting Units</div>
              <div className="text-base font-black text-slate-900 leading-none mt-1">{kpis?.units.toLocaleString() || '—'}</div>
            </div>
          </div>
        </div>
          </>
        )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-[400px] overflow-hidden">
        
        {/* Table toolbar */}
        <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">
              {rows.length} {reportLevel === 'Block Units' ? 'Block' : 'District'}{rows.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider transition-colors mx-auto">
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {isExpanded ? 'Collapse Table' : 'Expand Table'}
          </button>
          
          <div className="relative" style={{ width: 140 }}>
             {/* Invisible placeholder for symmetry */}
          </div>
        </div>

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
          
          <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
              <span>Show</span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-700 focus:outline-none focus:border-purple-500">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>records per page</span>
              <span className="ml-2">
                Showing {sortedRows.length > 0 ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, sortedRows.length)} of {sortedRows.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pg = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                return (
                  <button key={pg} onClick={() => setPage(pg)} className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-colors ${page === pg ? 'bg-purple-700 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                    {pg}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Footer Note */}
        <div className="bg-[#f3eff7] rounded-xl px-4 py-3 border border-[#e1d9ea] flex items-start gap-3">
          <Info className="w-5 h-5 text-[#522B85] shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-slate-700">
            <span className="font-bold">Note:</span> Daily Progress Report is expected every day. Monthly Due List Report and Monthly Vaccine Stock Balance Report are expected by the 5th of each month.
          </p>
        </div>
      </div>
  );
};
