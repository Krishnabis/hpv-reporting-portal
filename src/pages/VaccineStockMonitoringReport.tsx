import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar, Download, BarChart3, ChevronDown, Search, Maximize2, Minimize2, TrendingDown,
  AlertCircle, MapPin, Users, Target, CheckCircle2, PackageMinus, Layers, Zap, AlertTriangle,
  ChevronLeft, ChevronRight, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, Filter
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Logo } from '../components/Logo';
import { getDefaultLocationForUser } from '../utils/userLocation';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

function getActionBadge(action: string | null) {
  if (!action || action === '—') return <span className="text-slate-400 font-semibold">—</span>;
  const l = action.toLowerCase();
  if (l.includes('critical')) return <span className="flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded text-[10px] font-bold border border-red-200"><span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" /> Critical</span>;
  if (l.includes('replenish') || l.includes('re-order')) return <span className="flex items-center gap-1 text-orange-700 bg-orange-50 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-200"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Re-order</span>;
  return <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Adequate</span>;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  icon: React.ReactNode; label: string; value: string;
  subLabel?: string; subValue?: string; iconBg: string; valueColor?: string; loading?: boolean;
  onClick?: () => void;
  active?: boolean;
}> = ({ icon, label, value, subLabel, subValue, iconBg, valueColor = 'text-slate-900', loading, onClick, active }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-xl px-2.5 py-2 shadow-sm border flex items-center gap-2 transition-all ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${active ? 'border-hpv-purple ring-1 ring-hpv-purple/50 bg-hpv-purple-soft/10' : 'border-slate-200'}`}
  >
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
    {Array.from({ length: 12 }).map((_, i) => (
      <td key={i} className="px-3 py-2"><div className="h-3.5 bg-slate-200 rounded w-full" /></td>
    ))}
  </tr>
);

export interface VaccineStockMonitoringReportProps {
  adminUser?: any;
  states?: any[];
  allDistricts?: any[];
  masterBlocks?: any[];
  divisions?: any[];
}

export const VaccineStockMonitoringReport: React.FC<VaccineStockMonitoringReportProps> = ({
  adminUser,
  states: initialStates,
  allDistricts: initialDistricts,
  masterBlocks,
  divisions: initialDivisions,
}) => {
  const [statesList, setStatesList] = useState<any[]>(initialStates || []);
  const [districtsList, setDistrictsList] = useState<any[]>(initialDistricts || []);

  const todayStr = new Date().toISOString().split('T')[0].slice(0, 7);
  const [filterMonth, setFilterMonth] = useState(todayStr);
  const [reportLevel, setReportLevel] = useState<'District' | 'Block Units'>('District');
  const [filterStateId, setFilterStateId] = useState('');
  const [filterDistrictId, setFilterDistrictId] = useState('ALL');

  const [rows, setRows] = useState<any[]>([]);
  const [kpiData, setKpiData] = useState<{totalDvs: number; totalCcp: number}>({ totalDvs: 0, totalCcp: 0 });
  
  const [loading, setLoading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportDateLabel, setReportDateLabel] = useState('');
  const [isSavingImg, setIsSavingImg] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;
  const [isExpanded, setIsExpanded] = useState(false);
  const [leastOnTop, setLeastOnTop] = useState(false);
  const [activeActionFilter, setActiveActionFilter] = useState<'ALL' | 'CRITICAL' | 'REORDER'>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  useEffect(() => {
    if (initialStates && initialStates.length > 0) setStatesList(initialStates);
    if (initialDistricts && initialDistricts.length > 0) setDistrictsList(initialDistricts);
    if (!initialStates || !initialStates.length) {
      Promise.all([
        fetch('/api/locations/states').then(r => r.json()),
        fetch('/api/locations/districts').then(r => r.json()),
      ]).then(([states, districts]) => {
        if (Array.isArray(states)) setStatesList(states);
        if (Array.isArray(districts)) setDistrictsList(districts);
      }).catch(console.error);
    }
  }, [initialStates, initialDistricts]);

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
  }, [filterStateId, filterDistrictId, reportLevel, filterMonth]);

  const generateReport = async () => {
    const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
    setLoading(true);
    const apiLevel = reportLevel === 'District' ? 'DISTRICT' : 'BLOCK';
    const params = new URLSearchParams({ reportingMonth: filterMonth, level: apiLevel });
    if (filterStateId) params.set('state_id', filterStateId);
    if (filterDistrictId && filterDistrictId !== 'ALL') params.set('districtId', filterDistrictId);
    
    try {
      const res = await fetch(`/api/admin/reports/stock-monitoring?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      // Calculate row-level fields
      const enrichedRows = (data.rows || []).map((r: any) => {
        const wastage = (r.month_end_stock_reported != null && r.estimated_stock_balance != null) 
          ? Math.max(0, r.estimated_stock_balance - r.month_end_stock_reported) 
          : null;
        
        const wastagePct = (wastage != null && r.vaccine_received > 0) 
          ? (wastage / r.vaccine_received) * 100 
          : null;
          
        return { ...r, wastage, wastagePct };
      });
      
      setRows(enrichedRows);
      setKpiData(data.kpis || { totalDvs: 0, totalCcp: 0 });
      setReportDateLabel(filterMonth);
      setReportGenerated(true);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleGenerate = () => generateReport();

  const handleSavePDF = async () => {
    // Simple PDF export
    setIsSavingImg(true);
    try {
      const pdf = new jsPDF('l', 'mm', 'a4');
      pdf.setFontSize(16);
      pdf.text('HPV Vaccine Stock Monitoring Report', 14, 15);
      pdf.setFontSize(10);
      pdf.text(`Month: ${filterMonth} | Level: ${reportLevel}`, 14, 22);
      
      const head = [[
        'Site / Unit', 'Requirement', 'Opening', 'Received', 'Vaccinations',
        'Wastage', 'Reporting %', 'Est. Balance', 'Actual Balance', 'Avail %', 'Action'
      ]];

      const body = paginated.map(row => [
        row.name,
        fmt(row.annual_requirement),
        fmt(row.opening_stock),
        fmt(row.vaccine_received),
        fmt(row.vaccinations),
        fmt(row.wastage),
        row.month_end_reporting_pct != null ? `${fmt(row.month_end_reporting_pct, 1)}%` : '—',
        fmt(row.estimated_stock_balance),
        fmt(row.month_end_stock_reported),
        row.stock_availability_pct != null ? `${fmt(row.stock_availability_pct, 1)}%` : '—',
        row.action_required || '—'
      ]);

      autoTable(pdf, {
        startY: 30,
        head,
        body,
        theme: 'grid',
        styles: { fontSize: 7 }
      });

      pdf.save(`Stock_Report_${filterMonth}.pdf`);
    } catch (err) { console.error('Failed to save PDF', err); }
    setIsSavingImg(false);
  };

  const filteredBySearch = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => r.name.toLowerCase().includes(q));
  }, [rows, search]);

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

  const sortedRows = useMemo(() => {
    let result = [...filteredBySearch];
    if (activeActionFilter !== 'ALL') {
      result = result.filter(r => {
        const a = (r.action_required || '').toLowerCase();
        if (activeActionFilter === 'CRITICAL') return a.includes('critical');
        if (activeActionFilter === 'REORDER') return a.includes('re-order') || a.includes('replenish');
        return true;
      });
    }
    
    result.sort((a, b) => {
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
    
    return result;
  }, [filteredBySearch, activeActionFilter, sortConfig]);

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);
  const paginated = useMemo(() => {
    if (isSavingImg) return sortedRows;
    const start = (currentPage - 1) * rowsPerPage;
    return sortedRows.slice(start, start + rowsPerPage);
  }, [sortedRows, currentPage, isSavingImg]);

  const kpis = useMemo(() => {
    const totalPop = rows.reduce((s, r) => s + (r.population || 0), 0);
    const totalRequirement = rows.reduce((s, r) => s + (r.annual_requirement || 0), 0);
    
    let totalReportingPctSum = 0;
    let countPct = 0;
    let totalWastage = 0;
    let totalReceived = 0;
    
    let criticalDistricts = 0;
    let criticalBlocks = 0;
    let reorderDistricts = 0;
    let reorderBlocks = 0;
    
    rows.forEach(r => {
      if (r.month_end_reporting_pct != null) {
        totalReportingPctSum += r.month_end_reporting_pct;
        countPct++;
      }
      if (r.wastage) totalWastage += r.wastage;
      if (r.vaccine_received) totalReceived += r.vaccine_received;
      
      const act = (r.action_required || '').toLowerCase();
      if (act.includes('critical')) {
        if (r.entity_type === 'BLOCK') criticalBlocks++; else criticalDistricts++;
      } else if (act.includes('re-order') || act.includes('replenish')) {
        if (r.entity_type === 'BLOCK') reorderBlocks++; else reorderDistricts++;
      }
    });
    
    const avgReporting = countPct > 0 ? totalReportingPctSum / countPct : 0;
    const overallWastagePct = totalReceived > 0 ? (totalWastage / totalReceived) * 100 : 0;
    
    return {
      totalPop, totalRequirement, avgReporting, overallWastagePct,
      criticalDistricts, criticalBlocks, reorderDistricts, reorderBlocks
    };
  }, [rows]);

  const handleCSV = () => {
    if (!rows.length) return;
    const headers = ['Reporting Unit','Requirement','Opening Stock','Received','Vaccinations','Wastage','Reporting %','Est. Balance','Actual Balance','Avail %','Action'];
    const csvRows = filtered.map((r: any) => [
      `"${r.name}"`, r.annual_requirement, r.opening_stock, r.vaccine_received, r.vaccinations,
      r.wastage, r.month_end_reporting_pct, r.estimated_stock_balance, r.month_end_stock_reported,
      r.stock_availability_pct, r.action_required
    ]);
    const content = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Stock_Report.csv`; a.click();
  };

  const stateDistricts = useMemo(() => districtsList.filter(d => !filterStateId || String(d.state_id) === filterStateId), [districtsList, filterStateId]);

  const locationLabel = useMemo(() => {
    if (filterDistrictId && filterDistrictId !== 'ALL') {
      return stateDistricts.find(d => String(d.id) === filterDistrictId)?.name || 'Selected District';
    }
    if (filterStateId) return statesList.find(s => String(s.id) === filterStateId)?.name || 'Uttarakhand';
    return 'All Units';
  }, [filterDistrictId, filterStateId, stateDistricts, statesList]);

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
        <div className="flex items-center gap-3 ml-auto">
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
                {stateDistricts.map(d => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Report Month */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Report Month From - To</label>
            <input
              type="month"
              value={filterMonth}
              max={todayStr}
              onChange={e => setFilterMonth(e.target.value)}
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

      <div ref={reportRef} className="flex-1 flex flex-col min-h-0 gap-3 pb-2 bg-slate-50 rounded-xl">
        {!isExpanded && (
          <>
            <div className="shrink-0 p-1">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-hpv-purple" />
                  <span className="text-xs font-bold text-slate-700">{locationLabel}</span>
                  <span className="text-[10px] text-slate-400">— {reportLevel === 'District' ? 'Districts inside State' : 'Blocks inside District'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-1.5">
                <KpiCard loading={loading} icon={<Users className="w-4 h-4 text-hpv-purple" />} iconBg="bg-hpv-purple-soft"
                  label="Total Population" value={fmt(kpis.totalPop)} valueColor="text-hpv-purple" />
                <KpiCard loading={loading} icon={<Target className="w-4 h-4 text-green-600" />} iconBg="bg-green-50"
                  label="Annual Requirement" value={fmt(kpis.totalRequirement)} valueColor="text-green-700"
                  subLabel="Doses needed" />
                <KpiCard loading={loading} icon={<Layers className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50"
                  label="District Vaccine Stores" value={fmt(kpiData.totalDvs)} />
                <KpiCard loading={loading} icon={<PackageMinus className="w-4 h-4 text-orange-500" />} iconBg="bg-orange-50"
                  label="Cold Chain Points" value={fmt(kpiData.totalCcp)} />
                <KpiCard loading={loading} icon={<CheckCircle2 className="w-4 h-4 text-teal-600" />} iconBg="bg-teal-50"
                  label="Month-end Reporting" value={`${fmt(kpis.avgReporting, 1)}%`} subLabel="average" />
                <KpiCard loading={loading} icon={<AlertTriangle className="w-4 h-4 text-red-600" />} iconBg="bg-red-50"
                  label="Wastage (%)" value={`${fmt(kpis.overallWastagePct, 1)}%`} valueColor="text-red-700" />
                
                {/* Clickable Action KPI Cards */}
                <KpiCard loading={loading} icon={<AlertCircle className="w-4 h-4 text-red-600" />} iconBg="bg-red-100"
                  label="Critical Stock" value={`${kpis.criticalDistricts} Dist / ${kpis.criticalBlocks} Blk`} valueColor="text-red-800"
                  onClick={() => setActiveActionFilter(activeActionFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
                  active={activeActionFilter === 'CRITICAL'}
                />
                <KpiCard loading={loading} icon={<Zap className="w-4 h-4 text-orange-600" />} iconBg="bg-orange-100"
                  label="Re-Order Stock" value={`${kpis.reorderDistricts} Dist / ${kpis.reorderBlocks} Blk`} valueColor="text-orange-800"
                  onClick={() => setActiveActionFilter(activeActionFilter === 'REORDER' ? 'ALL' : 'REORDER')}
                  active={activeActionFilter === 'REORDER'}
                />
              </div>
            </div>
          </>
        )}

        {/* ── Data Table ────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-700">
                {sortedRows.length} {reportLevel === 'District' ? 'Districts' : 'Blocks'}
              </span>
              {activeActionFilter !== 'ALL' && (
                <span className="text-[10px] font-bold bg-hpv-purple-soft text-hpv-purple px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer hover:bg-hpv-purple-soft transition-colors" onClick={() => setActiveActionFilter('ALL')}>
                  {activeActionFilter} Filter Active <Minimize2 className="w-3 h-3"/>
                </span>
              )}
            </div>
            
            <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider transition-colors mx-auto">
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isExpanded ? 'Collapse Table' : 'Expand Table'}
            </button>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setLeastOnTop(!leastOnTop); setCurrentPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  leastOnTop ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                Least on Top
              </button>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input type="text" placeholder="Search by name..." value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 focus:border-hpv-purple" style={{ width: 200 }} />
            </div>
          </div>
            </div>

          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full" style={{ fontSize: '11px' }}>
              <thead className="sticky top-0 z-10">
                <tr className="gradient-header text-white shadow-sm">
                  <th className="px-3 py-2 text-left font-bold uppercase tracking-wide sticky left-0 gradient-header z-20 cursor-pointer hover:bg-white/10" style={{ minWidth: 140 }} onClick={() => handleSort('name')}>Site / Unit{renderSortIcon('name')}</th>
                  <th className="px-3 py-2 text-right font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('annual_requirement')}>Annual Req.{renderSortIcon('annual_requirement')}</th>
                  <th className="px-3 py-2 text-right font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('opening_stock')}>Opening Stock{renderSortIcon('opening_stock')}</th>
                  <th className="px-3 py-2 text-right font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('received')}>Vaccine Received{renderSortIcon('received')}</th>
                  <th className="px-3 py-2 text-right font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('vaccinations')}>Vaccinations{renderSortIcon('vaccinations')}</th>
                  <th className="px-3 py-2 text-right font-bold uppercase tracking-wide text-red-200 cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('wastage')}>Wastage (Rep.){renderSortIcon('wastage')}</th>
                  <th className="px-3 py-2 text-center font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('month_end_reporting_pct')}>Month-end Rep. %{renderSortIcon('month_end_reporting_pct')}</th>
                  <th className="px-3 py-2 text-right font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('estimated_stock_balance')}>Est. Balance{renderSortIcon('estimated_stock_balance')}</th>
                  <th className="px-3 py-2 text-right font-bold uppercase tracking-wide text-green-200 cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('month_end_stock_reported')}>Actual Balance{renderSortIcon('month_end_stock_reported')}</th>
                  <th className="px-3 py-2 text-center font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('stock_wastage_pct')}>Wastage %{renderSortIcon('stock_wastage_pct')}</th>
                  <th className="px-3 py-2 text-center font-bold uppercase tracking-wide cursor-pointer hover:bg-white/10 border-b border-hpv-purple/40" onClick={() => handleSort('stock_availability_pct')}>Availability %{renderSortIcon('stock_availability_pct')}</th>
                  <th className="px-3 py-2 text-center font-bold uppercase tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('action_required')}>Action{renderSortIcon('action_required')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />) :
                paginated.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center">
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
                  const isDistrictStore = row.entity_type === 'CCL_LEVEL_2_DISTRICT_STORE';
                  const rowClass = isDistrictStore ? 'bg-pink-50/30 hover:bg-pink-100/30' : (isEven ? 'bg-white hover:bg-hpv-purple-soft/30' : 'bg-slate-50/60 hover:bg-hpv-purple-soft/30');
                  return (
                    <tr key={row.id} className={`border-b border-slate-100 transition-colors group ${rowClass}`}>
                      <td className={`px-2 py-1.5 font-bold text-slate-800 sticky left-0 z-[5] border-r border-slate-100 ${rowClass}`}>
                        {row.name}
                        {row.is_urban && <span className="ml-1.5 text-[8px] font-bold text-hpv-purple bg-hpv-purple-soft px-1.5 py-0.5 rounded uppercase tracking-wider">Urban</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold text-slate-700">{fmt(row.annual_requirement)}</td>
                      <td className="px-2 py-1.5 text-right font-semibold text-slate-600">{fmt(row.opening_stock)}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-blue-700">{fmt(row.vaccine_received)}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-orange-700">{fmt(row.vaccinations)}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-red-600">{fmt(row.wastage)}</td>
                      <td className="px-2 py-1.5 text-center font-semibold">{row.month_end_reporting_pct != null ? `${fmt(row.month_end_reporting_pct, 1)}%` : '—'}</td>
                      <td className="px-2 py-1.5 text-right font-semibold text-slate-700">{fmt(row.estimated_stock_balance)}</td>
                      <td className="px-2 py-1.5 text-right font-black text-green-700 bg-green-50/50">{fmt(row.month_end_stock_reported)}</td>
                      <td className="px-2 py-1.5 text-center font-semibold text-red-600">{row.wastagePct != null ? `${fmt(row.wastagePct, 1)}%` : '—'}</td>
                      <td className="px-2 py-1.5 text-center font-semibold">{row.stock_availability_pct != null ? `${fmt(row.stock_availability_pct, 1)}%` : '—'}</td>
                      <td className="px-2 py-1.5 text-center flex justify-center">{getActionBadge(row.action_required)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-800 border-t border-slate-300">
                  <td className="px-2 py-2 sticky left-0 z-[5] bg-slate-100 border-r border-slate-200 uppercase tracking-wider text-xs">Total</td>
                  <td className="px-2 py-2 text-right">{fmt(sortedRows.reduce((s, r) => s + (r.annual_requirement || 0), 0))}</td>
                  <td className="px-2 py-2 text-right">{fmt(sortedRows.reduce((s, r) => s + (r.opening_stock || 0), 0))}</td>
                  <td className="px-2 py-2 text-right text-blue-700">{fmt(sortedRows.reduce((s, r) => s + (r.vaccine_received || 0), 0))}</td>
                  <td className="px-2 py-2 text-right text-orange-700">{fmt(sortedRows.reduce((s, r) => s + (r.vaccinations || 0), 0))}</td>
                  <td className="px-2 py-2 text-right text-red-600">{fmt(sortedRows.reduce((s, r) => s + (r.wastage || 0), 0))}</td>
                  <td className="px-2 py-2 text-center">—</td>
                  <td className="px-2 py-2 text-right">{fmt(sortedRows.reduce((s, r) => s + (r.estimated_stock_balance || 0), 0))}</td>
                  <td className="px-2 py-2 text-right text-green-700 font-black">{fmt(sortedRows.reduce((s, r) => s + (r.month_end_stock_reported || 0), 0))}</td>
                  <td className="px-2 py-2 text-center text-red-600">—</td>
                  <td className="px-2 py-2 text-center">
                    {sortedRows.reduce((s, r) => s + (r.annual_requirement || 0), 0) > 0 
                      ? `${fmt((sortedRows.reduce((s, r) => s + (r.month_end_stock_reported || 0), 0) / sortedRows.reduce((s, r) => s + (r.annual_requirement || 0), 0)) * 100, 1)}%`
                      : '—'}
                  </td>
                  <td className="px-2 py-2 text-center"></td>
                </tr>
              </tfoot>

            </table>
          </div>
          
          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
              <span className="text-xs text-slate-500 font-medium">Page <span className="font-bold text-slate-700">{currentPage}</span> of {totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-slate-200 disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
