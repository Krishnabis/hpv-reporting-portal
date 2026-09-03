import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Download, AlertCircle, Info, Building2, MapPin, Filter, Calendar, Clock, FileText, Target, Syringe, Layers, CheckCircle2, ChevronDown, BarChart3, RefreshCw, Maximize2, Minimize2, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getDefaultLocationForUser } from '../utils/userLocation';

interface ReportRow {
  id: string | number;
  name: string;
  district: string;
  district_id: number | string;
  annual_requirement: number;
  opening_stock: number;
  vaccine_received: number;
  vaccinations: number;
  month_end_reporting_pct: number;
  month_end_reporting_count: number;
  month_end_total_ccp: number;
  month_end_stock_reported: number | null;
  opening_stock_crude_method: number;
  estimated_stock_balance: number;
  estimation_model: string;
  stock_availability_pct: number;
  action_required: string;
  vaccine_received_last_12_months: number;
  vaccinations_last_12_months: number;
  entity_type?: string;
}

interface StateItem {
  id: number | string;
  name: string;
}

interface DistrictItem {
  id: number | string;
  name: string;
  state_id?: number | string;
}

interface ColumnTooltipProps {
  title: string;
  tooltip: string;
  align?: 'left' | 'center' | 'right';
  highlight?: boolean;
}

const ColumnHeader: React.FC<ColumnTooltipProps> = ({ title, tooltip, align = 'right', highlight = false }) => {
  const tooltipPosClass = align === 'left'
    ? 'left-0'
    : align === 'center'
    ? 'left-1/2 -translate-x-1/2'
    : 'right-0';

  const arrowPosClass = align === 'left'
    ? 'left-4'
    : align === 'center'
    ? 'left-1/2 -translate-x-1/2'
    : 'right-4';

  return (
    <th className={`px-2 py-1.5 text-[10px] font-bold tracking-tight select-none group relative border-b border-purple-900/40 uppercase ${
      align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right'
    } ${highlight ? 'text-amber-200 font-extrabold' : 'text-white'}`}>
      <div className={`inline-flex items-center gap-1 ${align === 'left' ? 'justify-start' : align === 'center' ? 'justify-center' : 'justify-end'} w-full`}>
        <span className="leading-snug">{title}</span>
        <div className="relative inline-block text-left shrink-0">
          <Info className="w-3 h-3 text-white/50 group-hover:text-amber-300 transition-colors cursor-help shrink-0" />
          <div className={`pointer-events-none absolute top-full mt-2 hidden group-hover:block w-56 p-2.5 bg-slate-900 text-slate-100 text-[11px] font-normal leading-relaxed rounded-lg shadow-2xl border border-slate-700 z-50 transition-opacity duration-200 ${tooltipPosClass} text-left normal-case`}>
            {tooltip}
            <div className={`absolute bottom-full border-4 border-transparent border-b-slate-900 ${arrowPosClass}`} />
          </div>
        </div>
      </div>
    </th>
  );
};

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

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: decimals });
}

export const VaccineStockMonitoringReport: React.FC<{
  adminUser?: any;
  divisions?: any[];
  districts?: DistrictItem[];
  states?: StateItem[];
  reportingMonth?: string;
}> = ({ adminUser, districts: initialDistricts = [], states: initialStates = [] }) => {
  const [data, setData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // States & Districts Lists
  const [statesList, setStatesList] = useState<StateItem[]>(initialStates);
  const [districtsList, setDistrictsList] = useState<DistrictItem[]>(initialDistricts);

  // Filter Controls
  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isFilterActive, setIsFilterActive] = useState<boolean>(false);

  // Current Date display
  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  // Available past 12 reporting months list for top filter
  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      options.push({ val, label });
    }
    return options;
  }, []);

  // Fetch States if not passed in props
  useEffect(() => {
    if (initialStates && initialStates.length > 0) {
      setStatesList(initialStates);
      return;
    }

    const fetchStates = async () => {
      try {
        const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
        const res = await fetch('/api/locations/states', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const json = await res.json();
          setStatesList(json || []);
        }
      } catch (err) {
        console.error('Failed to load states:', err);
      }
    };

    fetchStates();
  }, [initialStates]);

  // Fetch Districts if not passed in props
  useEffect(() => {
    if (initialDistricts && initialDistricts.length > 0) {
      setDistrictsList(initialDistricts);
      return;
    }

    const fetchDistricts = async () => {
      try {
        const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
        const res = await fetch('/api/locations/districts', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const json = await res.json();
          setDistrictsList(json || []);
        }
      } catch (err) {
        console.error('Failed to load districts:', err);
      }
    };

    fetchDistricts();
  }, [initialDistricts]);

  // Auto Select Uttarakhand or Admin user state/district
  const defaultLocationSet = useRef(false);
  useEffect(() => {
    if (statesList.length > 0 && adminUser && !defaultLocationSet.current) {
      const defLoc = getDefaultLocationForUser(adminUser, statesList, districtsList);
      if (defLoc.stateId) setSelectedStateId(defLoc.stateId);
      if (defLoc.districtId) setSelectedDistrictId(defLoc.districtId);
      defaultLocationSet.current = true;
    }
  }, [statesList, districtsList, adminUser]);

  const selectedStateName = useMemo(() => {
    const found = statesList.find(s => String(s.id) === String(selectedStateId));
    return found ? found.name : 'Uttarakhand';
  }, [statesList, selectedStateId]);

  const formattedMonthPeriod = useMemo(() => {
    if (!selectedMonth) return '';
    const [year, month] = selectedMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [selectedMonth]);

  // Main Data Fetch
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const params = new URLSearchParams({
        month: selectedMonth,
        state_id: selectedStateId || '1'
      });

      const res = await fetch(`/api/admin/reports/stock-monitoring?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) throw new Error('Failed to load vaccine stock monitoring data');
      const json = await res.json();
      setData(json.rows || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStateId) {
      fetchData();
    }
  }, [selectedStateId, selectedMonth]);

  // Derived Business Logic Calculations
  const processedRows = useMemo(() => {
    let list = data;
    if (selectedDistrictId && selectedDistrictId !== 'ALL') {
      list = list.filter(r => String(r.district_id) === String(selectedDistrictId));
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(r => (r.name || r.district || '').toLowerCase().includes(q));
    }

    const calculated = list.map(row => {
      const annualReq = row.annual_requirement || 0;
      const reportingPct = row.month_end_reporting_pct || 0;
      const reportingCount = row.month_end_reporting_count || 0;
      const totalCcp = row.month_end_total_ccp || 0;
      const reportedStock = row.month_end_stock_reported;

      const received12M = row.vaccine_received_last_12_months || 0;
      const vax12M = row.vaccinations_last_12_months || 0;
      const vaccineConsumedWastage12M = Math.round(vax12M * 1.01);

      const openingStockCrude = Math.max(0, received12M - vaccineConsumedWastage12M);

      const is100PctReporting = reportingPct >= 100 || (totalCcp > 0 && reportingCount === totalCcp);
      const estimationModel = is100PctReporting ? 'Reported Stock' : 'Crude Method';

      const openingStock = is100PctReporting && reportedStock !== null ? reportedStock : openingStockCrude;

      const vaccineReceived = row.vaccine_received || 0;
      const vaccinations = row.vaccinations || 0;
      const vaccineConsumedCurrentMonth = Math.round(vaccinations * 1.01);

      const closingStockEstimated = Math.max(0, openingStock + vaccineReceived - vaccineConsumedCurrentMonth);

      const stockAvailabilityPct = annualReq > 0 ? Math.round((closingStockEstimated / annualReq) * 100) : 0;

      let actionCategory = '—';
      if (annualReq > 0) {
        if (stockAvailabilityPct < 10) actionCategory = 'Critical';
        else if (stockAvailabilityPct < 25) actionCategory = 'Replenish';
        else if (stockAvailabilityPct < 50) actionCategory = 'Monitor';
        else actionCategory = 'Adequate';
      }

      return {
        ...row,
        monthPeriod: formattedMonthPeriod,
        annualReq,
        reportingPct,
        reportingCount,
        totalCcp,
        reportedStock,
        openingStockCrude,
        estimationModel,
        openingStock,
        vaccineReceived,
        vaccinations,
        closingStockEstimated,
        stockAvailabilityPct,
        actionCategory,
        received12M,
        vax12M,
        vaccineConsumedWastage12M,
        crudeOpeningFormulaValue: openingStockCrude
      };
    });

    if (isFilterActive) {
      calculated.sort((a, b) => a.stockAvailabilityPct - b.stockAvailabilityPct);
    } else {
      calculated.sort((a, b) => (a.name || a.district || '').localeCompare(b.name || b.district || ''));
    }

    return calculated;
  }, [data, selectedDistrictId, formattedMonthPeriod, isFilterActive, search]);

  // Aggregate Totals for Summary
  const aggregateTotals = useMemo(() => {
    let annualReq = 0;
    let reportingCount = 0;
    let totalCcp = 0;
    let reportedStock = 0;
    let vaccineReceived = 0;
    let vaccinations = 0;
    let closingStock = 0;
    let received12M = 0;
    let vax12M = 0;

    processedRows.forEach(r => {
      annualReq += r.annualReq;
      reportingCount += r.reportingCount;
      totalCcp += r.totalCcp;
      reportedStock += (r.reportedStock || 0);
      vaccineReceived += r.vaccineReceived;
      vaccinations += r.vaccinations;
      closingStock += r.closingStockEstimated;
      received12M += r.received12M;
      vax12M += r.vax12M;
    });

    const totalVaxConsumed12M = Math.round(vax12M * 1.01);
    const overallCrudeOpening = Math.max(0, received12M - totalVaxConsumed12M);
    const overallReportingPct = totalCcp > 0 ? (reportingCount / totalCcp) * 100 : 0;
    const overallAvailability = annualReq > 0 ? Math.round((closingStock / annualReq) * 100) : 0;

    let overallAction = '—';
    if (annualReq > 0) {
      if (overallAvailability < 10) overallAction = 'Critical';
      else if (overallAvailability < 25) overallAction = 'Replenish';
      else if (overallAvailability < 50) overallAction = 'Monitor';
      else overallAction = 'Adequate';
    }

    return {
      annualReq,
      reportingCount,
      totalCcp,
      overallReportingPct,
      reportedStock,
      openingStockCrude: overallCrudeOpening,
      vaccineReceived,
      vaccinations,
      closingStock,
      overallAvailability,
      overallAction,
      received12M,
      vax12M,
      totalVaxConsumed12M
    };
  }, [processedRows]);

  // EXPORT CSV HANDLER
  const downloadCSV = () => {
    const headers = [
      'Site / District',
      'Annual Req (Doses)',
      'Pre. Month-end Reporting (%)',
      'Opening Stock (Reported)',
      'Opening Stock (Crude Estimate)',
      'Vaccine Received',
      'Vaccinations (This Month)',
      'Closing Stock (Estimated)',
      'Estimation Model',
      'Stock Availability (%)',
      'Action'
    ];

    const rows = processedRows.map(r => [
      `"${r.name || r.district}"`,
      r.annualReq,
      `"${Math.round(r.reportingPct)}% (${r.reportingCount}/${r.totalCcp})"`,
      r.reportedStock != null ? r.reportedStock : '—',
      r.openingStockCrude,
      r.vaccineReceived,
      r.vaccinations,
      r.closingStockEstimated,
      `"${r.estimationModel}"`,
      `"${r.stockAvailabilityPct}%"`,
      `"${r.actionCategory}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Vaccine_Stock_Report_${selectedStateName.replace(/\s+/g, '_')}_${selectedMonth}.csv`;
    link.click();
  };

  // EXPORT PDF HANDLER
  const downloadPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(49, 16, 84);
    doc.text(`Vaccine Stock & Availability Report - ${selectedStateName}`, 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Period: ${formattedMonthPeriod}  |  Generated: ${currentDateFormatted}`, 14, 22);

    const tableHeaders = [[
      'Site / District',
      'Annual Req',
      'Reporting %',
      'Opening (Reported)',
      'Opening (Crude)',
      'Received',
      'Vaccinations',
      'Closing (Est)',
      'Model',
      'Availability %',
      'Action'
    ]];

    const tableRows = processedRows.map(r => [
      r.name || r.district,
      fmt(r.annualReq),
      `${Math.round(r.reportingPct)}% (${r.reportingCount}/${r.totalCcp})`,
      r.reportedStock != null ? fmt(r.reportedStock) : '—',
      fmt(r.openingStockCrude),
      fmt(r.vaccineReceived),
      fmt(r.vaccinations),
      fmt(r.closingStockEstimated),
      r.estimationModel,
      `${r.stockAvailabilityPct}%`,
      r.actionCategory
    ]);

    // Total row
    tableRows.push([
      `${selectedStateName} Summary`,
      fmt(aggregateTotals.annualReq),
      `${Math.round(aggregateTotals.overallReportingPct)}% (${aggregateTotals.reportingCount}/${aggregateTotals.totalCcp})`,
      fmt(aggregateTotals.reportedStock),
      fmt(aggregateTotals.openingStockCrude),
      fmt(aggregateTotals.vaccineReceived),
      fmt(aggregateTotals.vaccinations),
      fmt(aggregateTotals.closingStock),
      '—',
      `${aggregateTotals.overallAvailability}%`,
      aggregateTotals.overallAction
    ]);

    autoTable(doc, {
      head: tableHeaders,
      body: tableRows,
      startY: 26,
      styles: { fontSize: 8, cellPadding: 2.5, halign: 'center' },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' }
      },
      headStyles: { fillColor: [44, 24, 76], textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: 'grid'
    });

    doc.save(`Vaccine_Stock_Report_${selectedStateName.replace(/\s+/g, '_')}_${selectedMonth}.pdf`);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
            HPV Vaccination — Vaccine Stock &amp; Availability
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Tracks vaccine inventory, crude estimations, and stock availability metrics across reporting units
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadPDF}
            disabled={processedRows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Download PDF
          </button>
          <button
            onClick={downloadCSV}
            disabled={processedRows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Download CSV
          </button>
        </div>
      </div>

      {/* ── Filter Toolbar ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-extrabold text-slate-800">
            {selectedStateName} — ({currentDateFormatted})
          </span>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      {!isExpanded && (
        <div className="shrink-0 p-1">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-xs font-bold text-slate-700">{selectedStateName}</span>
              <span className="text-[10px] text-slate-400">— Stock Availability Overview</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-1.5">
            <KpiCard loading={loading} icon={<Target className="w-4 h-4 text-purple-600" />} iconBg="bg-purple-50"
              label="Annual Requirement" value={fmt(aggregateTotals.annualReq)} valueColor="text-purple-700" subLabel="Target doses" />
            <KpiCard loading={loading} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50"
              label="Month Reporting %" value={`${Math.round(aggregateTotals.overallReportingPct)}%`} valueColor="text-emerald-700"
              subValue={`${aggregateTotals.reportingCount}/${aggregateTotals.totalCcp}`} subLabel="reporting CCPs" />
            <KpiCard loading={loading} icon={<Layers className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50"
              label="Vaccine Received" value={fmt(aggregateTotals.vaccineReceived)} valueColor="text-blue-700" subLabel="This month" />
            <KpiCard loading={loading} icon={<Syringe className="w-4 h-4 text-orange-500" />} iconBg="bg-orange-50"
              label="Vaccinations" value={fmt(aggregateTotals.vaccinations)} valueColor="text-orange-700" subLabel="This month" />
            <KpiCard loading={loading} icon={<Building2 className="w-4 h-4 text-indigo-600" />} iconBg="bg-indigo-50"
              label="Closing Stock (Est.)" value={fmt(aggregateTotals.closingStock)} valueColor="text-indigo-700" subLabel="Estimated balance" />
            <KpiCard loading={loading} icon={<BarChart3 className="w-4 h-4 text-teal-600" />} iconBg="bg-teal-50"
              label="Stock Availability" value={`${aggregateTotals.overallAvailability}%`} valueColor="text-teal-700"
              subValue={aggregateTotals.overallAction} subLabel="status" />
          </div>
        </div>
      )}

      {/* ── Data Table Container ───────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Table toolbar */}
        <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">
              {processedRows.length} Reporting Unit{processedRows.length !== 1 ? 's' : ''}
            </span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider transition-colors mx-auto cursor-pointer"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {isExpanded ? 'Collapse Table' : 'Expand Table'}
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search site or district..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
              style={{ width: 220 }}
            />
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full" style={{ fontSize: '11px' }}>
            <thead className="sticky top-0 z-10">
              <tr className="gradient-header text-white">
                <ColumnHeader
                  title="Site / District"
                  tooltip="Name of the district unit within Uttarakhand."
                  align="left"
                  highlight={true}
                />
                <ColumnHeader
                  title="Annual Req"
                  tooltip="Target annual vaccine requirement in doses for this unit."
                  align="right"
                />
                <ColumnHeader
                  title="Month Reporting"
                  tooltip="Percentage of expected reporting units that submitted the previous month's month-end stock report."
                  align="center"
                  highlight={true}
                />
                <ColumnHeader
                  title="Opening (Reported)"
                  tooltip="Actual reported stock from previous month-end reports. Fixed for the current month."
                  align="right"
                />
                <ColumnHeader
                  title="Opening (Crude)"
                  tooltip="Calculated crude opening stock formula: (Vaccine Received Last 12 Months) - (Vaccinations Last 12 Months with 1.01 wastage factor)."
                  align="right"
                  highlight={true}
                />
                <ColumnHeader
                  title="Received"
                  tooltip="Vaccine doses received in the unit during the selected month."
                  align="right"
                />
                <ColumnHeader
                  title="Vaccinations"
                  tooltip="Total vaccinations performed in the unit during the selected month."
                  align="right"
                />
                <ColumnHeader
                  title="Closing (Est)"
                  tooltip="Estimated closing stock at month end. Formula: Opening Stock + Vaccine Received - (Vaccinations x 1.01)."
                  align="right"
                  highlight={true}
                />
                <ColumnHeader
                  title="Estimation Model"
                  tooltip="Methodology used to determine Opening Stock."
                  align="center"
                  highlight={true}
                />
                <ColumnHeader
                  title="Availability %"
                  tooltip="Stock availability percentage measured against annual requirement."
                  align="center"
                  highlight={true}
                />
                <ColumnHeader
                  title="Action Status"
                  tooltip="Recommended stock status action based on Stock Availability percentage."
                  align="center"
                  highlight={true}
                />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-slate-100">
                    <td colSpan={11} className="px-3 py-2.5"><div className="h-4 bg-slate-200 rounded w-full" /></td>
                  </tr>
                ))
              ) : processedRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-10 h-10 text-slate-300" />
                      <p className="text-slate-400 font-semibold text-sm">No district data found for the selected filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                processedRows.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  const rowBg = isEven ? 'bg-white' : 'bg-slate-50/60';
                  return (
                    <tr key={row.id || idx} className={`border-b border-slate-100 hover:bg-purple-50/30 transition-colors group ${rowBg}`}>
                      {/* Site / District */}
                      <td className={`px-3 py-2 font-bold text-slate-900 text-xs sticky left-0 z-[5] border-r border-slate-100 ${rowBg} group-hover:bg-purple-50/30`}>
                        {row.name || row.district}
                      </td>

                      {/* Annual Req */}
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{fmt(row.annualReq)}</td>

                      {/* Month Reporting */}
                      <td className="px-3 py-2 text-center font-bold">
                        <span className={row.reportingPct >= 100 ? 'text-emerald-700' : 'text-amber-700'}>
                          {Math.round(row.reportingPct)}%
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 ml-1">({row.reportingCount}/{row.totalCcp})</span>
                      </td>

                      {/* Opening Reported */}
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{row.reportedStock != null ? fmt(row.reportedStock) : '—'}</td>

                      {/* Opening Crude */}
                      <td className="px-3 py-2 text-right font-bold text-orange-600">{fmt(row.openingStockCrude)}</td>

                      {/* Received */}
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{fmt(row.vaccineReceived)}</td>

                      {/* Vaccinations */}
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{fmt(row.vaccinations)}</td>

                      {/* Closing Est */}
                      <td className="px-3 py-2 text-right font-extrabold text-indigo-700 bg-indigo-50/30">{fmt(row.closingStockEstimated)}</td>

                      {/* Estimation Model */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {row.estimationModel === 'Reported Stock' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Reported Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                            Crude Method
                          </span>
                        )}
                      </td>

                      {/* Stock Availability % */}
                      <td className="px-3 py-2 text-center font-extrabold text-slate-900 bg-slate-100/50">
                        {row.annualReq > 0 ? `${row.stockAvailabilityPct}%` : '—'}
                      </td>

                      {/* Action */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {row.actionCategory === 'Critical' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black bg-red-100 text-red-800 border border-red-300">Critical</span>
                        ) : row.actionCategory === 'Replenish' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">Replenish</span>
                        ) : row.actionCategory === 'Monitor' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-300">Monitor</span>
                        ) : row.actionCategory === 'Adequate' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">Adequate</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {!loading && processedRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#3B1C63]/20 font-bold text-slate-800" style={{ background: 'rgba(59,28,99,0.04)', fontSize: '11px' }}>
                  <td className="px-3 py-2 font-extrabold sticky left-0 border-r border-slate-200" style={{ background: 'rgba(59,28,99,0.04)' }}>
                    {selectedStateName} Summary
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(aggregateTotals.annualReq)}</td>
                  <td className="px-3 py-2 text-center text-indigo-900">
                    {Math.round(aggregateTotals.overallReportingPct)}% ({aggregateTotals.reportingCount}/{aggregateTotals.totalCcp})
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(aggregateTotals.reportedStock)}</td>
                  <td className="px-3 py-2 text-right text-orange-600">{fmt(aggregateTotals.openingStockCrude)}</td>
                  <td className="px-3 py-2 text-right">{fmt(aggregateTotals.vaccineReceived)}</td>
                  <td className="px-3 py-2 text-right">{fmt(aggregateTotals.vaccinations)}</td>
                  <td className="px-3 py-2 text-right text-indigo-700">{fmt(aggregateTotals.closingStock)}</td>
                  <td className="px-3 py-2 text-center text-slate-400">—</td>
                  <td className="px-3 py-2 text-center font-extrabold">{aggregateTotals.overallAvailability}%</td>
                  <td className="px-3 py-2 text-center">
                    {aggregateTotals.overallAction === 'Critical' ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-800">Critical</span>
                    ) : aggregateTotals.overallAction === 'Replenish' ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800">Replenish</span>
                    ) : aggregateTotals.overallAction === 'Monitor' ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-800">Monitor</span>
                    ) : aggregateTotals.overallAction === 'Adequate' ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800">Adequate</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default VaccineStockMonitoringReport;
