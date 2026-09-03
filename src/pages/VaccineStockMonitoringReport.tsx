import React, { useState, useEffect, useMemo } from 'react';
import { Download, AlertCircle, Info, Building2, MapPin, Filter, Calendar, Clock, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    <th className={`px-3 py-3 text-[11px] font-bold tracking-tight select-none group relative border-b border-purple-900/40 ${
      align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right'
    } ${highlight ? 'bg-purple-950/80 text-amber-200' : 'text-white/90'}`}>
      <div className={`inline-flex items-center gap-1 ${align === 'left' ? 'justify-start' : align === 'center' ? 'justify-center' : 'justify-end'} w-full`}>
        <span className="leading-snug">{title}</span>
        <div className="relative inline-block text-left shrink-0">
          <Info className="w-3.5 h-3.5 text-white/50 group-hover:text-amber-300 transition-colors cursor-help shrink-0" />
          <div className={`pointer-events-none absolute top-full mt-2 hidden group-hover:block w-56 p-2.5 bg-slate-900 text-slate-100 text-[11px] font-normal leading-relaxed rounded-lg shadow-2xl border border-slate-700 z-50 transition-opacity duration-200 ${tooltipPosClass} text-left`}>
            {tooltip}
            <div className={`absolute bottom-full border-4 border-transparent border-b-slate-900 ${arrowPosClass}`} />
          </div>
        </div>
      </div>
    </th>
  );
};

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

  // States & Districts Lists
  const [statesList, setStatesList] = useState<StateItem[]>(initialStates);
  const [districtsList, setDistrictsList] = useState<DistrictItem[]>(initialDistricts);
  
  // Filter Controls
  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [selectedDistrictId] = useState<string>('ALL');
  const [selectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isFilterActive, setIsFilterActive] = useState<boolean>(false);

  // Current Date display
  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      day: 'numeric',
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
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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

  // Set default selected state
  useEffect(() => {
    if (selectedStateId) return;

    if (adminUser?.state_id) {
      setSelectedStateId(String(adminUser.state_id));
    } else if (statesList.length > 0) {
      const ukState = statesList.find(s => s.name.toLowerCase().includes('uttarakhand'));
      setSelectedStateId(String(ukState ? ukState.id : statesList[0].id));
    }
  }, [statesList, adminUser, selectedStateId]);

  const selectedStateName = useMemo(() => {
    const found = statesList.find(s => String(s.id) === String(selectedStateId));
    return found ? found.name : 'Uttarakhand';
  }, [statesList, selectedStateId]);

  // Format selected month period string e.g. "September 2026"
  const formattedMonthPeriod = useMemo(() => {
    if (!selectedMonth) return '';
    const [yr, mo] = selectedMonth.split('-');
    const dateObj = new Date(parseInt(yr), parseInt(mo) - 1, 1);
    return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // Fetch Stock Data
  const fetchData = async () => {
    if (!selectedStateId) return;

    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const params = new URLSearchParams({
        reportingMonth: selectedMonth,
        level: 'DISTRICT',
        state_id: selectedStateId
      });

      const res = await fetch(`/api/admin/reports/stock-monitoring?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) throw new Error('Failed to fetch vaccine stock report');
      const json = await res.json();
      setData(json.rows || []);
    } catch (err: any) {
      setError(err.message || 'Error fetching stock data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStateId) {
      fetchData();
    }
  }, [selectedStateId, selectedMonth]);

  // Number Formatter
  const fmt = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return Math.round(val).toLocaleString('en-IN');
  };

  // Process and calculate each row deterministically
  const processedRows = useMemo(() => {
    const rawRows = selectedDistrictId === 'ALL'
      ? data
      : data.filter(row => String(row.district_id) === String(selectedDistrictId) || String(row.id) === String(selectedDistrictId));

    const calculated = rawRows.map(row => {
      const annualReq = row.annual_requirement || 0;
      const reportingPct = row.month_end_reporting_pct || 0;
      const reportingCount = row.month_end_reporting_count || 0;
      const totalCcp = row.month_end_total_ccp || 0;
      const reportedStock = row.month_end_stock_reported;

      const received12M = row.vaccine_received_last_12_months || 0;
      const vax12M = row.vaccinations_last_12_months || 0;
      const vaccineConsumedWastage12M = Math.round(vax12M * 1.01);

      // Crude Method Opening Stock = Vaccine Received Last 12 Months - Vaccine Consumed (Wastage Factor 1.01)
      const openingStockCrude = Math.max(0, received12M - vaccineConsumedWastage12M);

      // CRITICAL BUSINESS RULE: Use reported stock ONLY IF previous month reporting is 100%
      const is100PctReporting = reportingPct >= 100 || (totalCcp > 0 && reportingCount === totalCcp);
      const estimationModel = is100PctReporting ? 'Reported Stock' : 'Crude Method';

      // Opening stock is FIXED for the current month
      const openingStock = is100PctReporting && reportedStock !== null ? reportedStock : openingStockCrude;

      const vaccineReceived = row.vaccine_received || 0;
      const vaccinations = row.vaccinations || 0;
      const vaccineConsumedCurrentMonth = Math.round(vaccinations * 1.01);

      // Closing Stock (Estimated) = Opening Stock + Received - (Vaccinations x 1.01)
      const closingStockEstimated = Math.max(0, openingStock + vaccineReceived - vaccineConsumedCurrentMonth);

      // Stock Availability (%) = Closing Stock / Annual Requirement * 100
      const stockAvailabilityPct = annualReq > 0 ? Math.round((closingStockEstimated / annualReq) * 100) : 0;

      // Action Status Category
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
  }, [data, selectedDistrictId, formattedMonthPeriod, isFilterActive]);

  // Aggregate Totals for the Summary Row
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
    link.download = `Vaccine_Stock_District_${selectedStateName.replace(/\s+/g, '_')}_${selectedMonth}.csv`;
    link.click();
  };

  // EXPORT PDF HANDLER
  const downloadPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');

    // PDF Title & Subheader
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(49, 16, 84);
    doc.text(`Vaccine Stock & Availability Report - ${selectedStateName}`, 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Reporting Period: ${formattedMonthPeriod}  |  Generated Date: ${currentDateFormatted}`, 14, 22);

    const tableHeaders = [[
      'Site / District',
      'Annual Req.',
      'Pre. Reporting',
      'Opening (Reported)',
      'Opening (Crude)',
      'Received',
      'Vaccinations',
      'Closing (Est.)',
      'Model',
      'Avail (%)',
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
      headStyles: { fillColor: [49, 16, 84], textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: 'grid'
    });

    doc.save(`Vaccine_Stock_Report_${selectedStateName.replace(/\s+/g, '_')}_${selectedMonth}.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Top Section Header */}
      <div className="bg-white border-b border-slate-200 shadow-xs z-20 shrink-0">
        <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600 shrink-0" />
              <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                Vaccine Stock & Availability
              </h1>
              {/* CURRENT DATE DISPLAY ON TOP */}
              <div className="ml-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-bold border border-slate-300">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Report Date: <strong className="text-slate-900">{currentDateFormatted}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* EXPORT PDF BUTTON */}
            <button
              onClick={downloadPDF}
              disabled={processedRows.length === 0}
              className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-red-600" />
              Export PDF
            </button>

            {/* EXPORT CSV BUTTON */}
            <button
              onClick={downloadCSV}
              disabled={processedRows.length === 0}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* TOP FILTER BAR */}
        <div className="px-5 py-2.5 bg-slate-100/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Current Date Display */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Current Date:</span>
              <span className="text-xs font-black text-slate-900">{currentDateFormatted}</span>
            </div>

            {/* Single Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setIsFilterActive(prev => !prev)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-xs select-none cursor-pointer ${
                isFilterActive
                  ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 ring-2 ring-indigo-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Filter className={`w-3.5 h-3.5 ${isFilterActive ? 'text-white' : 'text-indigo-600'}`} />
              <span>Least Availability % First</span>
              <span
                className={`px-1.5 py-0.5 text-[10px] font-black rounded-full uppercase ${
                  isFilterActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isFilterActive ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          <div className="text-[11px] font-semibold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md">
            State: <span className="font-bold text-indigo-700">{selectedStateName}</span> (As of {currentDateFormatted})
          </div>
        </div>
      </div>

      {/* Main Content Area - STRETCHES TO FILL FULL CARD HEIGHT */}
      <div className="flex-1 p-3 sm:p-4 bg-slate-100 flex flex-col min-h-0 overflow-hidden">
        <div className="h-full bg-white rounded-xl shadow-xs border border-slate-200 flex flex-col overflow-hidden">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1 p-12 text-slate-500">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
              <p className="font-bold text-slate-700 text-sm">Calculating Vaccine Stock Data...</p>
              <p className="text-xs text-slate-400 mt-0.5">Applying crude estimation models and rolling 12-month metrics</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center flex-1 p-12 text-red-500">
              <AlertCircle className="w-10 h-10 mb-2 opacity-60" />
              <p className="font-bold text-sm">{error}</p>
              <button
                onClick={fetchData}
                className="mt-3 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold border border-red-200 hover:bg-red-100"
              >
                Retry Loading
              </button>
            </div>
          ) : processedRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 p-12 text-slate-500">
              <Building2 className="w-10 h-10 mb-2 text-slate-300" />
              <p className="font-bold text-slate-700 text-sm">No district data found for the selected filters</p>
              <p className="text-xs text-slate-400 mt-0.5">Please select another month from above</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between overflow-hidden h-full">
              <table className="w-full text-xs text-left border-collapse table-auto flex-1 flex flex-col justify-between h-full">
                <thead className="bg-[#311054] text-white shrink-0">
                  <tr className="flex w-full">
                    <ColumnHeader 
                      title="Site / District" 
                      tooltip="Name of the district unit within Uttarakhand."
                      align="left"
                      highlight={true}
                    />
                    <ColumnHeader 
                      title="Annual Requirement (Doses)" 
                      tooltip="Target annual vaccine requirement in doses for this unit."
                      align="center"
                    />
                    <ColumnHeader 
                      title="Pre. Month-end Reporting (%)" 
                      tooltip="Percentage of expected reporting units that submitted the previous month's month-end stock report."
                      align="center"
                      highlight={true}
                    />
                    <ColumnHeader 
                      title="Opening Stock (Reported)" 
                      tooltip="Actual reported stock from previous month-end reports. Fixed for the current month."
                      align="center"
                    />
                    <ColumnHeader 
                      title="Opening Stock (Crude Estimate)" 
                      tooltip="Calculated crude opening stock formula: (Vaccine Received Last 12 Months) - (Vaccinations Last 12 Months with 1.01 wastage factor)."
                      align="center"
                      highlight={true}
                    />
                    <ColumnHeader 
                      title="Vaccine Received" 
                      tooltip="Vaccine doses received in the unit during the selected month."
                      align="center"
                    />
                    <ColumnHeader 
                      title="Vaccinations (This Month)" 
                      tooltip="Total vaccinations performed in the unit during the selected month."
                      align="center"
                    />
                    <ColumnHeader 
                      title="Closing Stock (Estimated)" 
                      tooltip="Estimated closing stock at month end. Formula: Opening Stock + Vaccine Received - (Vaccinations x 1.01)."
                      align="center"
                      highlight={true}
                    />
                    <ColumnHeader 
                      title="Estimation Model" 
                      tooltip="Methodology used to determine Opening Stock."
                      align="center"
                      highlight={true}
                    />
                    <ColumnHeader 
                      title="Stock Availability (%)" 
                      tooltip="Stock availability percentage measured against annual requirement."
                      align="center"
                      highlight={true}
                    />
                    <ColumnHeader 
                      title="Action" 
                      tooltip="Recommended stock status action based on Stock Availability percentage."
                      align="center"
                      highlight={true}
                    />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 flex-1 flex flex-col justify-between">
                  {processedRows.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-indigo-50/40 transition-colors flex w-full items-center">
                      {/* 1. Site / District */}
                      <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap text-xs flex-1 text-left">
                        <span>{row.name || row.district}</span>
                      </td>

                      {/* 2. Annual Requirement (Doses) */}
                      <td className="px-3 py-2.5 text-center font-semibold text-slate-700 whitespace-nowrap text-[11px] flex-1">
                        {fmt(row.annualReq)}
                      </td>

                      {/* 3. Pre. Month-end Reporting (%) */}
                      <td className="px-3 py-2.5 text-center font-bold whitespace-nowrap text-[11px] flex-1">
                        <span className={row.reportingPct >= 100 ? 'text-emerald-700 font-black' : 'text-amber-700'}>
                          {Math.round(row.reportingPct)}%
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 ml-1">
                          ({row.reportingCount}/{row.totalCcp})
                        </span>
                      </td>

                      {/* 4. Opening Stock (Reported) */}
                      <td className="px-3 py-2.5 text-center font-semibold text-slate-700 whitespace-nowrap text-[11px] flex-1">
                        {row.reportedStock != null ? fmt(row.reportedStock) : '—'}
                      </td>

                      {/* 5. Opening Stock (Crude Estimate) */}
                      <td className="px-3 py-2.5 text-center font-bold text-orange-600 whitespace-nowrap text-[11px] flex-1">
                        {fmt(row.openingStockCrude)}
                      </td>

                      {/* 6. Vaccine Received */}
                      <td className="px-3 py-2.5 text-center font-semibold text-slate-700 whitespace-nowrap text-[11px] flex-1">
                        {fmt(row.vaccineReceived)}
                      </td>

                      {/* 7. Vaccinations (This Month) */}
                      <td className="px-3 py-2.5 text-center font-semibold text-slate-700 whitespace-nowrap text-[11px] flex-1">
                        {fmt(row.vaccinations)}
                      </td>

                      {/* 8. Closing Stock (Estimated) */}
                      <td className="px-3 py-2.5 text-center font-black text-indigo-700 bg-indigo-50/50 whitespace-nowrap text-[11px] flex-1">
                        {fmt(row.closingStockEstimated)}
                      </td>

                      {/* 9. Estimation Model */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap flex-1">
                        {row.estimationModel === 'Reported Stock' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Reported Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                            Crude Method
                          </span>
                        )}
                      </td>

                      {/* 10. Stock Availability (%) */}
                      <td className="px-3 py-2.5 text-center font-black text-slate-900 bg-slate-50/80 whitespace-nowrap text-[11px] flex-1">
                        {row.annualReq > 0 ? `${row.stockAvailabilityPct}%` : '—'}
                      </td>

                      {/* 11. Action */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap flex-1">
                        {row.actionCategory === 'Critical' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-300">
                            Critical
                          </span>
                        ) : row.actionCategory === 'Replenish' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                            Replenish
                          </span>
                        ) : row.actionCategory === 'Monitor' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
                            Monitor
                          </span>
                        ) : row.actionCategory === 'Adequate' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Adequate
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">—</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Summary / Totals Row */}
                  <tr className="bg-slate-200/90 font-black border-t-2 border-slate-300 text-slate-900 flex w-full items-center shrink-0">
                    <td className="px-3 py-3 font-black text-indigo-900 text-xs flex-1 text-left">
                      {`${selectedStateName} Summary`}
                    </td>
                    <td className="px-3 py-3 text-center text-[11px] flex-1">{fmt(aggregateTotals.annualReq)}</td>
                    <td className="px-3 py-3 text-center text-indigo-900 text-[11px] flex-1">
                      {Math.round(aggregateTotals.overallReportingPct)}% ({aggregateTotals.reportingCount}/{aggregateTotals.totalCcp})
                    </td>
                    <td className="px-3 py-3 text-center text-[11px] flex-1">{fmt(aggregateTotals.reportedStock)}</td>
                    <td className="px-3 py-3 text-center text-orange-700 text-[11px] flex-1">{fmt(aggregateTotals.openingStockCrude)}</td>
                    <td className="px-3 py-3 text-center text-[11px] flex-1">{fmt(aggregateTotals.vaccineReceived)}</td>
                    <td className="px-3 py-3 text-center text-[11px] flex-1">{fmt(aggregateTotals.vaccinations)}</td>
                    <td className="px-3 py-3 text-center text-indigo-800 text-[11px] flex-1">{fmt(aggregateTotals.closingStock)}</td>
                    <td className="px-3 py-3 text-center text-slate-600 text-[11px] flex-1">—</td>
                    <td className="px-3 py-3 text-center text-slate-900 text-[11px] flex-1">{aggregateTotals.overallAvailability}%</td>
                    <td className="px-3 py-3 text-center flex-1">
                      {aggregateTotals.overallAction === 'Critical' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-red-200 text-red-900">Critical</span>
                      ) : aggregateTotals.overallAction === 'Replenish' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-200 text-amber-900">Replenish</span>
                      ) : aggregateTotals.overallAction === 'Monitor' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-200 text-blue-900">Monitor</span>
                      ) : aggregateTotals.overallAction === 'Adequate' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-200 text-emerald-900">Adequate</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default VaccineStockMonitoringReport;
