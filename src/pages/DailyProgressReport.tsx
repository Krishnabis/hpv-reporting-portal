import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar, Download, BarChart3, ChevronDown, Search, Maximize2, Minimize2,
  ChevronLeft, ChevronRight, Activity, Target, Users,
  Syringe, Filter, RefreshCw, CheckCircle2, AlertCircle, MapPin, Camera, PieChart,
  ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Logo } from '../components/Logo';

import { getDefaultLocationForUser } from '../utils/userLocation';

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
  is_urban?: boolean;
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

export interface DailyProgressReportProps {
  adminUser?: any;
  states?: any[];
  allDistricts?: any[];
  masterBlocks?: any[];
  divisions?: any[];
}

export const DailyProgressReport: React.FC<DailyProgressReportProps> = ({
  adminUser,
  states: initialStates,
  allDistricts: initialDistricts,
  masterBlocks,
  divisions: initialDivisions,
}) => {
  const [statesList, setStatesList] = useState<any[]>(initialStates || []);
  const [divisionsList, setDivisionsList] = useState<any[]>(initialDivisions || []);
  const [districtsList, setDistrictsList] = useState<any[]>(initialDistricts || []);

  const today = new Date().toISOString().split('T')[0];
  const [filterDate, setFilterDate] = useState(today);
  const [reportLevel, setReportLevel] = useState<'District' | 'Block Units'>('District');
  const [filterStateId, setFilterStateId] = useState('');
  const [filterDistrictId, setFilterDistrictId] = useState('ALL');

  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportDateLabel, setReportDateLabel] = useState('');
  const [hasAutoGenerated, setHasAutoGenerated] = useState(false);
  const [isSavingImg, setIsSavingImg] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (initialStates && initialStates.length > 0) setStatesList(initialStates);
    if (initialDistricts && initialDistricts.length > 0) setDistrictsList(initialDistricts);
    if (initialDivisions && initialDivisions.length > 0) setDivisionsList(initialDivisions);

    if (!initialStates || !initialStates.length) {
      Promise.all([
        fetch('/api/locations/states').then(r => r.json()),
        fetch('/api/locations/divisions').then(r => r.json()),
        fetch('/api/locations/districts').then(r => r.json()),
      ]).then(([states, divisions, districts]) => {
        if (Array.isArray(states) && states.length) setStatesList(states);
        if (Array.isArray(divisions) && divisions.length) setDivisionsList(divisions);
        if (Array.isArray(districts) && districts.length) setDistrictsList(districts);
      }).catch(console.error);
    }
  }, [initialStates, initialDistricts, initialDivisions]);

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

  useEffect(() => {
    if (filterStateId || (filterDistrictId && filterDistrictId !== 'ALL')) {
      generateReport();
    }
  }, [filterStateId, filterDistrictId, reportLevel, filterDate]);

  const generateReport = async () => {
    const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
    setLoading(true);
    const apiLevel = reportLevel === 'District' ? 'DISTRICT' : 'BLOCK';
    const params = new URLSearchParams({ date: filterDate, level: apiLevel });
    if (filterStateId) params.set('state_id', filterStateId);
    if (filterDistrictId && filterDistrictId !== 'ALL') params.set('districtId', filterDistrictId);
    
    try {
      const res = await fetch(`/api/admin/reports/generate?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setRows(data.rows || []);
      setReportDateLabel(filterDate);
      setReportGenerated(true);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleGenerate = () => generateReport();

  const handleSavePDF = async () => {
    setIsSavingImg(true);
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
      pdf.text('HPV Vaccination \u2014 Daily Progress Report', 32, 16);
      
      // Subtitle
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.setFont('helvetica', 'normal');
      pdf.text('Tracks daily & cumulative HPV vaccination progress at State, Division, District, and Block levels', 32, 22);

      // Top Right:
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.setFont('helvetica', 'normal');
      const generatedDate = new Date().toLocaleString('en-IN', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true}).replace(/ am| pm/i, m => m.toUpperCase());
      pdf.text(`Report Generated On: ${generatedDate}`, 282, 15, { align: 'right' });
      pdf.text('Page 1 of 1', 282, 20, { align: 'right' });

      // Time Duration
      pdf.setFontSize(10);
      pdf.setTextColor(30, 41, 59); // slate-800
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Time Duration: Date ${reportDateLabel || filterDate}`, 14, 34);

      // Location row
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59); // dark text
      pdf.text(locationLabel, 14, 40);
      
      const locWidth = pdf.getTextWidth(locationLabel);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(148, 163, 184); // slate-400
      const subLabel = ` \u2014 ${reportLevel === 'District' ? 'Districts inside State' : 'Blocks inside District'}`;
      pdf.text(subLabel, 14 + locWidth, 40);
      
      // Right side badge: "Progressing"
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(37, 99, 235); // blue-600
      pdf.text('Progressing', 282, 40, { align: 'right' });

      // Draw KPIs
      const kpiY = 50;
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
        `Reporting Unit (${reportLevel === 'District' ? 'District' : 'Block'})`,
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
        startY: 70,
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

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const renderSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="inline w-3 h-3 ml-1 text-white/30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1 text-white" /> : <ArrowDown className="inline w-3 h-3 ml-1 text-white" />;
  };

  const rowsWithRank = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const rankedList = [...rows].sort((a, b) => {
      const covA = a.vaccination_coverage_pct ?? -1;
      const covB = b.vaccination_coverage_pct ?? -1;
      if (covB !== covA) return covB - covA;
      
      const vaccA = a.beneficiaries_vaccinated ?? 0;
      const vaccB = b.beneficiaries_vaccinated ?? 0;
      if (vaccB !== vaccA) return vaccB - vaccA;
      
      return (a.name || '').localeCompare(b.name || '');
    });

    const rankMap = new Map<any, number>();
    rankedList.forEach((item, index) => {
      rankMap.set(item.id ?? item.name, index + 1);
    });

    return rows.map(r => ({
      ...r,
      rank: rankMap.get(r.id ?? r.name) || 0
    }));
  }, [rows]);

  const sortedRows = useMemo(() => {
    let sorted = [...rowsWithRank];
    sorted.sort((a, b) => {
      let valA = (a as any)[sortConfig.key];
      let valB = (b as any)[sortConfig.key];
      
      if (valA == null) valA = '';
      if (valB == null) valB = '';
      
      let comparison = 0;
      if (typeof valA === 'number' || typeof valB === 'number') {
         comparison = (Number(valA) || 0) - (Number(valB) || 0);
      } else {
         comparison = String(valA).localeCompare(String(valB));
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [rowsWithRank, sortConfig]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sortedRows;
    const q = search.toLowerCase();
    return sortedRows.filter(r => r.name.toLowerCase().includes(q));
  }, [sortedRows, search]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginated = useMemo(() => {
    if (isSavingImg) return filtered; // Render all rows if saving image
    const start = (currentPage - 1) * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, currentPage, isSavingImg]);

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
    const headers = ['Rank','Reporting Unit','Coverage %'];
    const csvRows = sortedRows.map((r: any) => [r.rank, `"${r.name}"`, r.vaccination_coverage_pct]);
    const content = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Report.csv`; a.click();
  };

  const stateDistricts = useMemo(() => districtsList.filter(d => !filterStateId || String(d.state_id) === filterStateId), [districtsList, filterStateId]);

  const locationLabel = useMemo(() => {
    if (filterDistrictId === 'KUMAON') return 'Kumaon Division';
    if (filterDistrictId === 'GARHWAL') return 'Garhwal Division';
    if (filterDistrictId !== 'ALL') {
      return stateDistricts.find(d => String(d.id) === filterDistrictId)?.name || 'Selected District';
    }
    if (filterStateId) return statesList.find(s => String(s.id) === filterStateId)?.name || 'Uttarakhand';
    return 'All Units';
  }, [filterDistrictId, filterStateId, stateDistricts, statesList]);

  const tierInfo = coverageTier(reportGenerated ? kpis.coveragePct : null);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">HPV Vaccination — Daily Progress Report</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Tracks daily &amp; cumulative HPV vaccination progress at State, Division, District, and Block levels</p>
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
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 appearance-none cursor-pointer"
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
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 appearance-none cursor-pointer"
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
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 appearance-none cursor-pointer"
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

          {/* Report Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Report Date</label>
            <input
              type="date"
              value={filterDate}
              max={today}
              onChange={e => setFilterDate(e.target.value)}
              className="pl-2.5 pr-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 focus:border-hpv-purple cursor-pointer"
              style={{ minWidth: 148 }}
            />
          </div>

          {/* Generate Report Button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{ height: 36, borderRadius: 8, minWidth: 160 }}
            className="flex items-center justify-center gap-2 px-5 font-bold text-xs text-white bg-gradient-to-r from-[#3A0088] to-[#3A0088] hover:from-[#3A0088] hover:to-[#3A0088] rounded-lg transition-all shadow-md shadow-hpv-purple/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
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
        {!isExpanded && (
          <>
            <div className="shrink-0 p-1">
              <div className="flex items-center justify-between mb-1.5 px-1">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-hpv-purple" />
              <span className="text-xs font-bold text-slate-700">{locationLabel}</span>
              <span className="text-[10px] text-slate-400">— {reportLevel === 'District' ? 'Districts inside State' : 'Blocks inside District'}</span>
            </div>
          {reportGenerated && (
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${tierInfo.bg} ${tierInfo.color}`}>{tierInfo.label}</span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-1.5">
          <KpiCard loading={loading} icon={<Users className="w-4 h-4 text-hpv-purple" />} iconBg="bg-hpv-purple-soft"
            label="Total Population" value={fmt(kpis.totalPop)} valueColor="text-hpv-purple" />
          <KpiCard loading={loading} icon={<Target className="w-4 h-4 text-green-600" />} iconBg="bg-green-50"
            label="Goal" value={fmt(kpis.totalTarget)} valueColor="text-green-700"
            subLabel="0.8% of total population" />
          <KpiCard loading={loading} icon={<Syringe className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50"
            label="HPV Vaccinations" value={fmt(kpis.totalVaccCumm)}
            subValue={fmt(kpis.totalVaccToday)} subLabel="Today" />
          <KpiCard loading={loading} icon={<Calendar className="w-4 h-4 text-orange-500" />} iconBg="bg-orange-50"
            label="Sessions Held" value={fmt(kpis.totalSessionsCumm)}
            subValue={fmt(kpis.totalSessionsToday)} subLabel="Today" />
          <KpiCard loading={loading} icon={<Activity className="w-4 h-4 text-teal-600" />} iconBg="bg-teal-50"
            label="Vacc / Session" value={fmt(kpis.vaccPerSession, 2)} subLabel="cumulative avg" />

          <KpiCard loading={loading} icon={<PieChart className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50"
            label="Goal Achieved" value={`${fmt(kpis.coveragePct, 1)}%`} valueColor={coverageTier(kpis.coveragePct).color}
            subLabel={tierInfo.label.split(' ')[0]} />

          <KpiCard loading={loading} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50"
            label="Reporting Today" value={fmt(kpis.reportingToday)}
            subValue={`of ${rows.length}`} subLabel={reportLevel === 'District' ? 'districts' : 'blocks'} />
        </div>
      </div>

      {/* ── Second Toolbar (below cards) ───────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-2.5 flex flex-wrap items-center gap-3 justify-between shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-hpv-purple" />
          <span>Report Date:</span>
          <span className="font-extrabold text-slate-900">{fmtDate(reportDateLabel || today)}</span>
        </div>

        {/* Sort direction */}
        <div className="flex items-center gap-3">
          {(['asc', 'desc'] as Array<'asc'|'desc'>).map(val => (
            <label key={val} className="flex items-center gap-1.5 cursor-pointer select-none">
              <div
                onClick={() => setSortConfig(prev => ({ ...prev, direction: val }))}
                className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${sortConfig.direction === val ? 'border-hpv-purple' : 'border-slate-300'}`}
              >
                {sortConfig.direction === val && <div className="w-1.5 h-1.5 rounded-full bg-hpv-purple" />}
              </div>
              <span className={`text-xs font-semibold cursor-pointer ${sortConfig.direction === val ? 'text-hpv-purple' : 'text-slate-500'}`}
                onClick={() => setSortConfig(prev => ({ ...prev, direction: val }))}>
                {val === 'asc' ? 'Ascending' : 'Descending'}
              </span>
            </label>
          ))}
        </div>

        {/* Ranked By */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Sort By</span>
          <div className="relative">
            <select value={sortConfig.key} onChange={e => setSortConfig(prev => ({ ...prev, key: e.target.value }))}
              className="pl-2.5 pr-7 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 appearance-none cursor-pointer">
              <option value="name">Name</option>
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
          </>
        )}

      {/* ── Data Table — flex-1 so it fills remaining space ────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-0 overflow-hidden">

        {/* Table toolbar */}
        <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">
              {filtered.length} {reportLevel === 'District' ? 'District' : 'Block'}{filtered.length !== 1 ? 's' : ''}
            </span>
            {reportGenerated && !loading && (
              <span className="text-[10px] text-slate-400">• {rows.filter(r => r.has_today_report).length} reported today</span>
            )}
          </div>
          
          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider transition-colors mx-auto">
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {isExpanded ? 'Collapse Table' : 'Expand Table'}
          </button>
          
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input type="text" placeholder="Search by name..." value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 focus:border-hpv-purple" style={{ width: 200 }} />
          </div>
        </div>

        {/* Scrollable table body */}
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full" style={{ fontSize: '9px' }}>
            <thead className="sticky top-0 z-10">
              <tr className="gradient-header text-white shadow-sm">
                <th className="px-3 py-2 text-left font-bold uppercase tracking-wide sticky left-0 gradient-header z-20 cursor-pointer hover:bg-white/10" style={{ minWidth: 140 }} onClick={() => handleSort('name')}>Reporting Unit ({reportLevel === 'District' ? 'District' : 'Block'}){renderSortIcon('name')}</th>
                <th className="px-3 py-2 text-center font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('last_reporting_date')}>Last Reported{renderSortIcon('last_reporting_date')}</th>
                <th className="px-3 py-2 text-right font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('population')}>Population{renderSortIcon('population')}</th>
                <th className="px-3 py-2 text-right font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('hpv_target')}>HPV Goal{renderSortIcon('hpv_target')}</th>
                <th className="px-3 py-2 text-right font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('sessions_held_today')}>Sessions Today{renderSortIcon('sessions_held_today')}</th>
                <th className="px-3 py-2 text-right font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('vaccinated_today')}>Vaccinations Today{renderSortIcon('vaccinated_today')}</th>
                <th className="px-3 py-2 text-right font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('sessions_held_cumulative')}>Sessions Cumulative{renderSortIcon('sessions_held_cumulative')}</th>
                <th className="px-3 py-2 text-right font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('beneficiaries_vaccinated')}>Vaccinations Cumulative{renderSortIcon('beneficiaries_vaccinated')}</th>
                <th className="px-3 py-2 text-right font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('vaccinations_per_session')}>Vaccinations Per Session{renderSortIcon('vaccinations_per_session')}</th>
                <th className="px-3 py-2 text-center font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('vaccination_coverage_pct')}>Goal %{renderSortIcon('vaccination_coverage_pct')}</th>
                <th className="px-3 py-2 text-center font-bold uppercase tracking-wide border-b border-hpv-purple/40">Rank</th>
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
                  <tr key={row.id} className={`border-b border-slate-100 hover:bg-hpv-purple-soft/30 transition-colors group ${rowBg}`}>
                    <td className={`px-2 py-1.5 font-bold text-slate-800 sticky left-0 z-[5] border-r border-slate-100 ${rowBg} group-hover:bg-hpv-purple-soft/30`}>
                      {row.name}
                      {row.is_urban && <span className="ml-1.5 text-[8px] font-bold text-hpv-purple bg-hpv-purple-soft px-1.5 py-0.5 rounded uppercase tracking-wider">Urban</span>}
                    </td>
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
                <tr className="border-t-2 border-[#3A0088]/20 font-bold text-slate-800" style={{ background: 'rgba(58,0,136,0.04)', fontSize: '9px' }}>
                  <td className="px-2 py-1.5 font-extrabold sticky left-0 border-r border-slate-200" style={{ background: 'rgba(58,0,136,0.04)' }}>TOTAL ({rows.length})</td>
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
                      className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-colors ${currentPage === page ? 'bg-hpv-purple text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
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
