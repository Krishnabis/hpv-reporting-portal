import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar, Download, BarChart3, ChevronDown, Search,
  ChevronLeft, ChevronRight, Activity, Target, Users,
  Syringe, Filter, RefreshCw, CheckCircle2, AlertCircle, MapPin, Camera, PieChart
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Logo } from '../components/Logo';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportRow {
  id: string | number;
  name: string;
  district: string;
  annual_requirement: number;
  opening_stock: number;
  vaccine_received: number;
  vaccinations: number;
  wastage_reported: number;
  month_end_reporting_pct: number | null;
  estimated_stock_balance: number;
  wastage_pct: number | null;
  stock_availability_pct: number | null;
  action_required: 'critical' | 'reorder' | 'ok';
}

type RankBy = 'stock_availability_pct' | 'wastage_pct' | 'month_end_reporting_pct';
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
  <div className="bg-white rounded-xl px-2.5 py-2 shadow-sm border border-slate-200 flex items-center gap-2 hover:shadow-md transition-shadow">
    {loading ? (
      <div className="animate-pulse flex items-center gap-2 w-full">
        <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
        <div className="flex flex-col gap-1 w-full">
          <div className="h-2 bg-slate-200 rounded w-1/2" />
          <div className="h-3 bg-slate-200 rounded w-3/4" />
        </div>
      </div>
    ) : (
      <>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg} shrink-0 [&>svg]:w-4 [&>svg]:h-4`}>
          {icon}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="text-[9px] font-semibold text-slate-600 truncate leading-tight">{label}</div>
          <div className={`text-[13px] font-extrabold leading-none mt-0.5 ${valueColor} truncate`}>{value}</div>
          {(subValue || subLabel) && (
            <>
              <div className="w-full h-px bg-slate-100 my-1" />
              <div className="text-[8px] font-bold leading-none truncate">
                {subValue && <span className="text-emerald-600">{subValue}</span>}
                {subValue && subLabel && <span className="text-slate-500 ml-0.5">{subLabel}</span>}
                {!subValue && subLabel && <span className="text-slate-400">{subLabel}</span>}
              </div>
            </>
          )}
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

// ─── Main Component ───────────────────────────────────────────────────────────

export const VaccineStockMonitoringReport: React.FC<{ adminUser: any }> = ({ adminUser }) => {
  const [statesList, setStatesList] = useState<any[]>([]);
  const [divisionsList, setDivisionsList] = useState<any[]>([]);
  const [districtsList, setDistrictsList] = useState<any[]>([]);

  const today = new Date().toISOString().split('T')[0];
  const [filterDate, setFilterDate] = useState(today);
  const [filterLevel, setFilterLevel] = useState<'Division' | 'District'>('Division');
  const [filterStateId, setFilterStateId] = useState('');
  const [filterDivisionId, setFilterDivisionId] = useState('ALL');
  const [filterDistrictId, setFilterDistrictId] = useState('ALL');

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportDateLabel, setReportDateLabel] = useState('');
  const [hasAutoGenerated, setHasAutoGenerated] = useState(false);
  const [isSavingImg, setIsSavingImg] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [sortDir, setSortDir] = useState<SortDir>('best');
  const [rankBy, setRankBy] = useState<RankBy>('stock_availability_pct');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  useEffect(() => {
    Promise.all([
      fetch('/api/locations/states').then(r => r.json()),
      fetch('/api/locations/divisions').then(r => r.json()),
      fetch('/api/locations/districts').then(r => r.json()),
    ]).then(([states, divisions, districts]) => {
      setStatesList(Array.isArray(states) ? states : []);
      setDivisionsList(Array.isArray(divisions) ? divisions : []);
      setDistrictsList(Array.isArray(districts) ? districts : []);
    }).catch(console.error);
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
      generateReport();
    }
  }, [filterStateId]);

  const generateReport = async () => {
    setLoading(true);
    setTimeout(() => {
      const mockRows: ReportRow[] = Array.from({ length: 15 }).map((_, i) => {
        const annual_requirement = Math.floor(Math.random() * 5000) + 1000;
        const opening_stock = Math.floor(annual_requirement * 0.1);
        const vaccine_received = Math.floor(annual_requirement * 0.2);
        const vaccinations = Math.floor(vaccine_received * 0.8);
        const wastage_reported = Math.floor(vaccine_received * 0.05);
        const estimated_stock_balance = opening_stock + vaccine_received - vaccinations - wastage_reported;
        const wastage_pct = vaccine_received > 0 ? (wastage_reported / vaccine_received) * 100 : 0;
        const stock_availability_pct = annual_requirement > 0 ? (estimated_stock_balance / annual_requirement) * 100 : 0;
        const month_end_reporting_pct = Math.floor(Math.random() * 40) + 60;
        
        let action_required: 'critical' | 'reorder' | 'ok' = 'ok';
        if (stock_availability_pct < 10) action_required = 'critical';
        else if (stock_availability_pct < 30) action_required = 'reorder';

        return {
          id: i,
          name: `Unit ${i + 1}`,
          district: `District ${Math.floor(i / 5) + 1}`,
          annual_requirement,
          opening_stock,
          vaccine_received,
          vaccinations,
          wastage_reported,
          month_end_reporting_pct,
          estimated_stock_balance,
          wastage_pct,
          stock_availability_pct,
          action_required
        };
      });
      setRows(mockRows);
      setReportDateLabel(filterDate);
      setReportGenerated(true);
      setLoading(false);
    }, 800);
  };

  const handleGenerate = () => generateReport();

  const handleSavePDF = async () => {
    setIsSavingImg(true);
    try {
      const pdf = new jsPDF('l', 'mm', 'a4');
      
      // Attempt to load and add logo
      try {
        const logoImg = new Image();
        logoImg.src = '/headinglogo.png';
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
        });
        // The original image might be wider now that it contains text.
        pdf.addImage(logoImg, 'PNG', 14, 10, 50, 15);
      } catch (e) {
        console.warn('Could not load headinglogo.png for PDF');
      }

      // Top Right:
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.setFont('helvetica', 'normal');
      const generatedDate = new Date().toLocaleString('en-IN', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true}).replace(/ am| pm/i, m => m.toUpperCase());
      pdf.text(`Report Generated On: ${generatedDate}`, 282, 15, { align: 'right' });
      pdf.text('Page 1 of 1', 282, 20, { align: 'right' });

      // Title
      pdf.setFontSize(18);
      pdf.setTextColor(15, 23, 42); // slate-900 (very dark)
      pdf.setFont('helvetica', 'bold');
      pdf.text('HPV Vaccination \u2014 Daily Progress Report', 14, 38);
      
      // Subtitle
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.setFont('helvetica', 'normal');
      pdf.text('Tracks daily & cumulative HPV vaccination progress at State, Division, District, and Block levels', 14, 43);
      
      // Location row (around Y=51)
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59); // dark text
      pdf.text(locationLabel, 14, 51);
      
      const locWidth = pdf.getTextWidth(locationLabel);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(148, 163, 184); // slate-400
      const subLabel = ` \u2014 ${filterLevel === 'Division' ? 'Districts inside Division' : (filterLevel === 'State' ? 'Divisions inside State' : (filterLevel === 'District' ? 'Blocks inside District' : 'Overview'))}`;
      pdf.text(subLabel, 14 + locWidth, 51);
      
      // Right side badge: "Progressing"
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(37, 99, 235); // blue-600
      pdf.text('Progressing', 282, 51, { align: 'right' });

      // Draw KPIs
      const kpiY = 64;
      const drawKpi = (x: number, y: number, label: string, val1: string, val2: string) => {
        pdf.setDrawColor(226, 232, 240); // slate-200
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(x, y, 36, 16, 2, 2, 'FD');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139); // slate-500
        pdf.text(label, x + 3, y + 5);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(30, 41, 59); // slate-800
        pdf.text(val1, x + 3, y + 10);
        if (val2) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(6);
          pdf.setTextColor(148, 163, 184); // slate-400
          pdf.text(val2, x + 3, y + 14);
        }
      };

      drawKpi(14, kpiY, 'Total Population', fmt(kpis.totalPop), '');
      drawKpi(52, kpiY, 'Goal', fmt(kpis.totalTarget), `${(kpis.totalPop ? (kpis.totalTarget/kpis.totalPop)*100 : 0).toFixed(1)}% of total pop`);
      drawKpi(90, kpiY, 'HPV Vaccinations', fmt(kpis.totalVaccCumm), `${fmt(kpis.totalVaccToday)} Today`);
      drawKpi(128, kpiY, 'Sessions Held', fmt(kpis.totalSessionsCumm), `${fmt(kpis.totalSessionsToday)} Today`);
      drawKpi(166, kpiY, 'Vacc / Session', kpis.vaccPerSession.toFixed(2), 'cumulative avg');
      drawKpi(204, kpiY, 'Goal Achieved', `${kpis.coveragePct.toFixed(1)}%`, '');
      drawKpi(242, kpiY, 'Reporting Today', `${kpis.reportingToday}`, `of ${rows.length} units`);
      
      const head = [[
        `Reporting Unit (${filterLevel === 'Division' ? 'District' : 'Block'})`,
        'Last Reported',
        'Population',
        'HPV Goal',
        'Sess. Today',
        'Vacc. Today',
        'Sess. Cumul.',
        'Vacc. Cumul.',
        'Vacc/Sess',
        'Goal %',
        'Rank'
      ]];

      const body = filtered.map(row => [
        row.name + (row.is_urban ? ' (Urban)' : ''),
        row.has_report ? fmtDate(row.last_reporting_date) : '—',
        fmt(row.population),
        fmt(row.hpv_target),
        row.sessions_held_today !== null ? fmt(row.sessions_held_today) : '—',
        row.vaccinated_today !== null ? fmt(row.vaccinated_today) : '—',
        row.sessions_held_cumulative !== null ? fmt(row.sessions_held_cumulative) : '—',
        row.beneficiaries_vaccinated !== null ? fmt(row.beneficiaries_vaccinated) : '—',
        row.vaccinations_per_session !== null ? fmt(row.vaccinations_per_session, 2) : '—',
        row.vaccination_coverage_pct != null ? `${fmt(row.vaccination_coverage_pct, 1)}%` : '—',
        (row as any).rank ?? '-'
      ]);

      // Add totals row
      if (filtered.length > 0) {
        body.push([
          `TOTAL (${filtered.length})`,
          '—',
          fmt(kpis.totalPop),
          fmt(kpis.totalTarget),
          fmt(kpis.totalSessionsToday),
          fmt(kpis.totalVaccToday),
          fmt(kpis.totalSessionsCumm),
          fmt(kpis.totalVaccCumm),
          '—',
          kpis.totalTarget > 0 ? `${fmt((kpis.totalVaccCumm / kpis.totalTarget) * 100, 1)}%` : '—',
          '—'
        ]);
      }

      autoTable(pdf, {
        startY: 85,
        head,
        body,
        theme: 'grid',
        headStyles: { fillColor: [44, 24, 76], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 8, textColor: 50 },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [30, 41, 59] }, // Name
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right', textColor: [16, 185, 129] }, // Goal
          4: { halign: 'right', textColor: [234, 88, 12] }, // Sess Today
          5: { halign: 'right', textColor: [37, 99, 235] }, // Vacc Today
          6: { halign: 'right', textColor: [234, 88, 12] }, // Sess Cumul
          7: { halign: 'right', textColor: [37, 99, 235] }, // Vacc Cumul
          8: { halign: 'right', textColor: [15, 118, 110] }, // Vacc/Sess
          9: { halign: 'center', fontStyle: 'bold' }, // Coverage
          10: { halign: 'center', fontStyle: 'bold' } // Rank
        },
        willDrawCell: (data) => {
          if (data.row.index === body.length - 1 && filtered.length > 0) {
            // Make the totals row bold
            pdf.setFont('helvetica', 'bold');
            if (data.column.index === 0) pdf.setFillColor(245, 243, 255); // faint purple
          }
        },
        margin: { top: 20 }
      });

      pdf.save(`HPV_Report_${filterDate}.pdf`);
    } catch (err) { console.error('Failed to save PDF', err); }
    setIsSavingImg(false);
  };

  const rankedRows = useMemo(() => {
    const bestFirst = [...rows]
      .sort((a, b) => ((a as any)[rankBy] ?? -1) - ((b as any)[rankBy] ?? -1))
      .reverse()
      .map((r, i) => ({ ...r, rank: i + 1 }));
    return sortDir === 'best' ? bestFirst : [...bestFirst].reverse();
  }, [rows, rankBy, sortDir]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rankedRows;
    const q = search.toLowerCase();
    return rankedRows.filter(r => r.name.toLowerCase().includes(q));
  }, [rankedRows, search]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginated = useMemo(() => {
    if (isSavingImg) return filtered; // Render all rows if saving image
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage, isSavingImg]);

  const kpis = useMemo(() => {
    const totalPop = rows.reduce((s, r: any) => s + (r.annual_requirement / 1.01 || 0), 0);
    const totalTarget = rows.reduce((s, r: any) => s + (r.annual_requirement || 0), 0);
    const totalStores = 2; // mock
    const totalColdChainPoints = 13; // mock
    const avgMonthEndReporting = rows.length ? rows.reduce((s, r: any) => s + (r.month_end_reporting_pct || 0), 0) / rows.length : 0;
    const avgWastage = rows.length ? rows.reduce((s, r: any) => s + (r.wastage_pct || 0), 0) / rows.length : 0;
    const criticalStockCount = rows.filter((r: any) => r.action_required === 'critical').length;
    const reorderStockCount = rows.filter((r: any) => r.action_required === 'reorder').length;
    return { totalPop, totalTarget, totalStores, totalColdChainPoints, avgMonthEndReporting, avgWastage, criticalStockCount, reorderStockCount };
  }, [rows]);

  const handleCSV = () => {
    if (!rows.length) return;
    const headers = ['Rank','Reporting Unit','Coverage %'];
    const csvRows = rankedRows.map((r: any, i: number) => [i + 1, `"${r.name}"`, r.vaccination_coverage_pct]);
    const content = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Report.csv`; a.click();
  };

  const stateDistricts = useMemo(() => districtsList.filter(d => String(d.state_id) === filterStateId), [districtsList, filterStateId]);
  const divisionDistricts = useMemo(() => stateDistricts.filter(d => filterDivisionId === 'ALL' || String(d.division_id) === filterDivisionId), [stateDistricts, filterDivisionId]);
  const isAdminOrState = adminUser?.role === 'SUPER_ADMIN' || adminUser?.role === 'ADMIN' || adminUser?.role === 'STATE_ADMIN';

  const canPickDivision = filterLevel === 'Division' && isAdminOrState;
  const canPickDistrict = filterLevel === 'District' && isAdminOrState;

  const locationLabel = useMemo(() => {
    if (filterLevel === 'District' && filterDistrictId !== 'ALL') {
      return stateDistricts.find(d => String(d.id) === filterDistrictId)?.name || 'Selected District';
    }
    if (filterLevel === 'Division' && filterDivisionId !== 'ALL') {
      return divisionsList.find(d => String(d.id) === filterDivisionId)?.name || 'Selected Division';
    }
    if (filterStateId) return statesList.find(s => String(s.id) === filterStateId)?.name || 'Selected State';
    return 'All Units';
  }, [filterLevel, filterDistrictId, filterDivisionId, filterStateId, stateDistricts, divisionsList, statesList]);

  const tierInfo = coverageTier(reportGenerated ? kpis.coveragePct : null);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">HPV Vaccine Stock Monitoring Report</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Monitors HPV vaccine stock availability and flags areas requiring timely replenishment.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSavePDF} disabled={!rows.length || isSavingImg}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 transition-colors shrink-0">
            {isSavingImg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-slate-500" />} Download PDF
          </button>
          <button onClick={handleCSV} disabled={!rows.length}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 transition-colors shrink-0">
            <Download className="w-3.5 h-3.5" /> Download CSV
          </button>
        </div>
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

          {/* Level (View By) */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">View By</label>
            <div className="relative">
              <select value={filterLevel}
                onChange={e => { setFilterLevel(e.target.value as any); setFilterDivisionId('ALL'); setFilterDistrictId('ALL'); }}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer" style={{ minWidth: 120 }}>
                {isAdminOrState && <option value="Division">Division</option>}
                <option value="District">District</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Division Dropdown */}
          {canPickDivision && (
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Division</label>
              <div className="relative">
                <select value={filterDivisionId} onChange={e => setFilterDivisionId(e.target.value)}
                  className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer" style={{ minWidth: 160 }}>
                  <option value="ALL">All Divisions</option>
                  {divisionsList.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          )}

          {/* District Dropdown */}
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

      {/* ── Dashboard Content to Save ─────────────────────────────────── */}
      <div ref={reportRef} className="flex-1 flex flex-col min-h-0 gap-3 pb-2 bg-slate-50 rounded-xl" style={{ backgroundColor: isSavingImg ? 'white' : undefined }}>
        {isSavingImg && (
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-4">
            <Logo size="md" variant="dark" />
            <div className="text-right flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-700">
                Report Generated On: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-xs font-semibold text-slate-700">
                Page 1 of {Math.ceil(((reportRef.current?.scrollHeight || 0) * (210 / (reportRef.current?.scrollWidth || 1))) / 297) || 1}
              </span>
            </div>
          </div>
        )}

        {/* ── KPI Cards ──────────────────────────────────────────────── */}
        <div className="shrink-0 p-1">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-xs font-bold text-slate-700">{locationLabel}</span>
              <span className="text-[10px] text-slate-400">— {filterLevel === 'Division' ? 'Districts inside Division' : 'Blocks inside District'}</span>
            </div>
          {reportGenerated && (
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${tierInfo.bg} ${tierInfo.color}`}>{tierInfo.label}</span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-1.5">
          <KpiCard loading={loading} icon={<Users className="w-4 h-4 text-purple-600" />} iconBg="bg-purple-50"
            label="Total Population" value={fmt(kpis.totalPop)} valueColor="text-purple-700" />
          <KpiCard loading={loading} icon={<Target className="w-4 h-4 text-green-600" />} iconBg="bg-green-50"
            label="Annual Requirement" value={fmt(kpis.totalTarget)} valueColor="text-green-700"
            subLabel="Population × 1.01" />
          <KpiCard loading={loading} icon={<Activity className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50"
            label="District Vaccine Stores" value={fmt(kpis.totalStores)} />
          <KpiCard loading={loading} icon={<Activity className="w-4 h-4 text-orange-500" />} iconBg="bg-orange-50"
            label="Cold Chain Points" value={fmt(kpis.totalColdChainPoints)} />
          <KpiCard loading={loading} icon={<CheckCircle2 className="w-4 h-4 text-teal-600" />} iconBg="bg-teal-50"
            label="Month-end Reporting" value={`${fmt(kpis.avgMonthEndReporting, 1)}%`} subLabel="average" />
          <KpiCard loading={loading} icon={<PieChart className="w-4 h-4 text-rose-600" />} iconBg="bg-rose-50"
            label="Wastage (%)" value={`${fmt(kpis.avgWastage, 1)}%`} subLabel="average" />
          <div className="cursor-pointer" onClick={() => { setSearch(''); setRankBy('stock_availability_pct'); setSortDir('worst'); }}>
            <KpiCard loading={loading} icon={<AlertCircle className="w-4 h-4 text-red-600" />} iconBg="bg-red-50"
              label="Critical Stock" value={fmt(kpis.criticalStockCount)} valueColor="text-red-700" subLabel="click to filter" />
          </div>
          <div className="cursor-pointer" onClick={() => { setSearch(''); setRankBy('stock_availability_pct'); setSortDir('worst'); }}>
            <KpiCard loading={loading} icon={<RefreshCw className="w-4 h-4 text-orange-600" />} iconBg="bg-orange-50"
              label="Re-Order Stock" value={fmt(kpis.reorderStockCount)} valueColor="text-orange-700" subLabel="click to filter" />
          </div>
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
              <option value="stock_availability_pct">Stock Availability (%)</option>
              <option value="wastage_pct">Wastage (%)</option>
              <option value="month_end_reporting_pct">Month-end Reporting (%)</option>
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
              {filtered.length} {filterLevel === 'Division' ? 'District' : 'Block'}{filtered.length !== 1 ? 's' : ''}
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
                <th className="px-2 py-1.5 text-left font-bold uppercase tracking-wide whitespace-nowrap sticky left-0 gradient-header z-20" style={{ minWidth: 140 }}>Site / Unit</th>
                <th className="px-2 py-1.5 text-left font-bold uppercase tracking-wide whitespace-nowrap">District</th>
                <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wide whitespace-nowrap">Annual Req.</th>
                <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wide whitespace-nowrap">Opening Stock</th>
                <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wide whitespace-nowrap">Vaccine Received</th>
                <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wide whitespace-nowrap">Vaccinations</th>
                <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wide whitespace-nowrap">Wastage (Rep)</th>
                <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wide whitespace-nowrap">Month-end Rep %</th>
                <th className="px-2 py-1.5 text-right font-bold uppercase tracking-wide whitespace-nowrap">Est. Stock Bal.</th>
                <th className="px-2 py-1.5 text-center font-bold uppercase tracking-wide whitespace-nowrap">Wastage %</th>
                <th className="px-2 py-1.5 text-center font-bold uppercase tracking-wide whitespace-nowrap">Stock Avail %</th>
                <th className="px-2 py-1.5 text-center font-bold uppercase tracking-wide whitespace-nowrap">Action</th>
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
                    <td className={`px-2 py-1.5 font-bold text-slate-800 sticky left-0 z-[5] border-r border-slate-100 ${rowBg} group-hover:bg-purple-50/30`}>
                      {row.name}
                    </td>
                    <td className="px-2 py-1.5 text-left font-medium text-slate-600">{row.district}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-700">{fmt(row.annual_requirement)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-blue-700">{fmt(row.opening_stock)}</td>
                    <td className="px-2 py-1.5 text-right font-bold text-green-700">{fmt(row.vaccine_received)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-purple-700">{fmt(row.vaccinations)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-rose-600">{fmt(row.wastage_reported)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-slate-600">{fmt(row.month_end_reporting_pct)}%</td>
                    <td className="px-2 py-1.5 text-right font-bold text-slate-800">{fmt(row.estimated_stock_balance)}</td>
                    <td className="px-2 py-1.5 text-center font-semibold text-rose-700">{fmt(row.wastage_pct, 1)}%</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`font-bold ${row.stock_availability_pct < 10 ? 'text-red-700' : row.stock_availability_pct < 30 ? 'text-orange-700' : 'text-green-700'}`}>
                        {fmt(row.stock_availability_pct, 1)}%
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {row.action_required === 'critical' ? (
                        <span className="bg-red-600 text-white text-[9px] font-bold px-2 py-1 rounded shadow-sm">Critical - Replenish Now</span>
                      ) : row.action_required === 'reorder' ? (
                        <span className="bg-orange-500 text-white text-[9px] font-bold px-2 py-1 rounded shadow-sm">Re-Order Stock</span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {!loading && paginated.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#3B1C63]/20 font-bold text-slate-800" style={{ background: 'rgba(59,28,99,0.04)', fontSize: '11px' }}>
                  <td className="px-2 py-1.5 font-extrabold sticky left-0 border-r border-slate-200" style={{ background: 'rgba(59,28,99,0.04)' }}>TOTAL ({rows.length})</td>
                  <td className="px-2 py-1.5 text-center text-slate-400">—</td>
                  <td className="px-2 py-1.5 text-right text-slate-700">{fmt(kpis.totalTarget)}</td>
                  <td className="px-2 py-1.5 text-center text-slate-400" colSpan={6}>—</td>
                  <td className="px-2 py-1.5 text-center font-semibold text-rose-700">{fmt(kpis.avgWastage, 1)}%</td>
                  <td className="px-2 py-1.5 text-center text-slate-400">—</td>
                  <td className="px-2 py-1.5 text-center text-slate-400">—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between shrink-0" data-html2canvas-ignore>
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
    </div>
  );
};

export default DailyProgressReport;
