import React, { useState, useEffect, useMemo } from 'react';
import { Download, AlertCircle, Info, Building2, MapPin, Filter, Calendar, Clock, Eye, EyeOff } from 'lucide-react';

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
    <th className={`px-2.5 py-3 text-[11px] font-bold tracking-tight select-none group relative border-b border-purple-900/40 ${
      align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right'
    } ${highlight ? 'bg-purple-950/80 text-amber-200' : 'text-white/90'}`}>
      <div className={`inline-flex items-center gap-1 ${align === 'left' ? 'justify-start' : align === 'center' ? 'justify-center' : 'justify-end'} w-full`}>
        <span className="leading-snug">{title}</span>
        <div className="relative inline-block text-left shrink-0">
          <Info className="w-3.5 h-3.5 text-white/50 group-hover:text-amber-300 transition-colors cursor-help shrink-0" />
          {/* TOOLTIP DROPS DOWN BELOW HEADER ROW (top-full mt-2) TO PREVENT TOP CLIPPING */}
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
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('ALL');
  
  // Toggle for hiding/showing 4 calculation side columns
  const [showCalculationColumns, setShowCalculationColumns] = useState<boolean>(false);

  // Reporting Month Selection
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

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

  // Available Districts for the selected State
  const availableDistricts = useMemo(() => {
    if (!selectedStateId) return districtsList;
    return districtsList.filter(d => !d.state_id || String(d.state_id) === String(selectedStateId));
  }, [districtsList, selectedStateId]);

  // Reset district filter when state changes
  useEffect(() => {
    setSelectedDistrictId('ALL');
  }, [selectedStateId]);

  const selectedStateName = useMemo(() => {
    const found = statesList.find(s => String(s.id) === String(selectedStateId));
    return found ? found.name : 'Selected State';
  }, [statesList, selectedStateId]);

  const selectedDistrictName = useMemo(() => {
    if (selectedDistrictId === 'ALL') return 'All Districts';
    const found = availableDistricts.find(d => String(d.id) === String(selectedDistrictId));
    return found ? found.name : 'Selected District';
  }, [availableDistricts, selectedDistrictId]);

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

  // Process and calculate each row deterministically according to prompt logic
  const processedRows = useMemo(() => {
    const rawRows = selectedDistrictId === 'ALL'
      ? data
      : data.filter(row => String(row.district_id) === String(selectedDistrictId) || String(row.id) === String(selectedDistrictId));

    return rawRows.map(row => {
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
  }, [data, selectedDistrictId, formattedMonthPeriod]);

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

  // Export CSV Handler
  const downloadCSV = () => {
    const headers = [
      'Selected Month Period',
      'Site / District',
      'Annual Requirement (Doses)',
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

    if (showCalculationColumns) {
      headers.push(
        'Vaccine Received Last 12 Months (since the selected date)',
        'Vaccinations Last 12 Months (since the selected date)',
        'Vaccine Consumed (Wastage Factor) 1.01',
        'Opening Stock * Crude Method'
      );
    }

    const rows = processedRows.map(r => {
      const rowArr = [
        `"${r.monthPeriod}"`,
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
      ];
      if (showCalculationColumns) {
        rowArr.push(r.received12M, r.vax12M, r.vaccineConsumedWastage12M, r.crudeOpeningFormulaValue);
      }
      return rowArr;
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Vaccine_Stock_District_${selectedStateName.replace(/\s+/g, '_')}_${selectedMonth}.csv`;
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Top Section Header & Current Date Display */}
      <div className="bg-white border-b border-slate-200 shadow-xs z-20 shrink-0">
        <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600 shrink-0" />
              <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                Vaccine Stock & Availability
              </h1>
              {/* CURRENT DATE DISPLAY ON TOP */}
              <div className="ml-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-bold border border-slate-300">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Current Date: <strong className="text-slate-900">{currentDateFormatted}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Toggle calculation columns button */}
            <button
              onClick={() => setShowCalculationColumns(!showCalculationColumns)}
              className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
              title={showCalculationColumns ? "Hide 12-month calculation columns" : "Show 12-month calculation columns"}
            >
              {showCalculationColumns ? <EyeOff className="w-3.5 h-3.5 text-slate-600" /> : <Eye className="w-3.5 h-3.5 text-indigo-600" />}
              <span>{showCalculationColumns ? "Hide 12M Side Columns" : "Show 12M Side Columns"}</span>
            </button>

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

        {/* TOP FILTER BAR: MONTH/PERIOD, STATE, AND DISTRICT SELECTORS */}
        <div className="px-5 py-2.5 bg-slate-100/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* 1. Month / Period Selector Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Period:
              </span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {monthOptions.map(m => (
                  <option key={m.val} value={m.val}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* 2. State Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" /> State:
              </span>
              <select
                value={selectedStateId}
                onChange={(e) => setSelectedStateId(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[150px]"
              >
                {statesList.map(s => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* 3. District Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-indigo-600" /> District:
              </span>
              <select
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[150px]"
              >
                <option value="ALL">All Districts</option>
                {availableDistricts.map(d => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-[11px] font-semibold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md">
            {selectedDistrictId === 'ALL' ? (
              <>Showing districts for: <span className="font-bold text-indigo-700">{selectedStateName}</span> ({formattedMonthPeriod})</>
            ) : (
              <>Showing district: <span className="font-bold text-indigo-700">{selectedDistrictName}, {selectedStateName}</span> ({formattedMonthPeriod})</>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area - SINGLE SCREEN FIT WITHOUT SLIDERS */}
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
              <p className="text-xs text-slate-400 mt-0.5">Please select another district, state, or month from above</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              <table className="w-full text-xs text-left border-collapse table-auto">
                <thead className="bg-[#311054] text-white">
                  <tr>
                    <ColumnHeader 
                      title="Selected Month Period" 
                      tooltip="The month and year for which this stock availability report is calculated."
                      align="left"
                    />
                    <ColumnHeader 
                      title="Site / District" 
                      tooltip="Name of the district unit within the selected State."
                      align="left"
                      highlight={true}
                    />
                    <ColumnHeader 
                      title="Annual Requirement (Doses)" 
                      tooltip="Target annual vaccine requirement in doses for this unit."
                      align="right"
                    />
                    <ColumnHeader 
                      title="Pre. Month-end Reporting (%)" 
                      tooltip="Percentage of expected reporting units that submitted the previous month's month-end stock report. Formula: (Submitted Units / Total Expected Units) x 100."
                      align="right"
                      highlight={true}
                    />

                    {/* UPDATED COLUMN HEADER NAME 1: Opening Stock (Reported) */}
                    <ColumnHeader 
                      title="Opening Stock (Reported)" 
                      tooltip="Actual reported stock from previous month-end reports. Used as primary opening stock ONLY when previous month reporting is 100%."
                      align="right"
                    />

                    <ColumnHeader 
                      title="Opening Stock (Crude Estimate)" 
                      tooltip="Calculated crude opening stock formula: (Vaccine Received Last 12 Months) - (Vaccinations Last 12 Months with 1.01 wastage factor)."
                      align="right"
                      highlight={true}
                    />
                    <ColumnHeader 
                      title="Vaccine Received" 
                      tooltip="Vaccine doses received in the unit during the selected month."
                      align="right"
                    />

                    {/* UPDATED COLUMN HEADER NAME 2: Vaccinations (This Month) */}
                    <ColumnHeader 
                      title="Vaccinations (This Month)" 
                      tooltip="Total vaccinations performed in the unit during the selected month."
                      align="right"
                    />

                    <ColumnHeader 
                      title="Closing Stock (Estimated)" 
                      tooltip="Estimated closing stock at month end. Formula: Opening Stock + Vaccine Received - (Vaccinations x 1.01)."
                      align="right"
                      highlight={true}
                    />
                    <ColumnHeader 
                      title="Estimation Model" 
                      tooltip="Methodology used to determine Opening Stock. Displays 'Reported Stock' if previous month reporting is 100%, otherwise 'Crude Method'."
                      align="center"
                      highlight={true}
                    />
                    <ColumnHeader 
                      title="Stock Availability (%)" 
                      tooltip="Stock availability percentage measured against annual requirement. Formula: (Closing Stock / Annual Requirement) x 100."
                      align="right"
                      highlight={true}
                    />
                    <ColumnHeader 
                      title="Action" 
                      tooltip="Recommended stock status action based on Stock Availability percentage: Adequate (>=50%), Monitor (25-49%), Replenish (10-24%), Critical (<10%)."
                      align="center"
                      highlight={true}
                    />

                    {/* 4 SIDE CALCULATION COLUMNS (HIDDEN BY DEFAULT TO FIT ALL COLUMNS ON ONE SCREEN) */}
                    {showCalculationColumns && (
                      <>
                        <ColumnHeader 
                          title="Vaccine Received Last 12 Months (since date)" 
                          tooltip="Total vaccine doses received over the rolling 12-month period ending at the selected date."
                          align="right"
                        />
                        <ColumnHeader 
                          title="Vaccinations Last 12 Months (since date)" 
                          tooltip="Total vaccinations recorded over the rolling 12-month period ending at the selected date."
                          align="right"
                        />
                        <ColumnHeader 
                          title="Vaccine Consumed (Wastage 1.01)" 
                          tooltip="Vaccine consumed over last 12 months calculated with 1.01 wastage factor."
                          align="right"
                        />
                        <ColumnHeader 
                          title="Opening Stock * Crude Method" 
                          tooltip="Exposed crude opening stock calculation: Vaccine Received Last 12 Months - ROUND(Vaccinations Last 12 Months x 1.01)."
                          align="right"
                        />
                      </>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {processedRows.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-indigo-50/40 transition-colors">
                      {/* 1. Selected Month Period */}
                      <td className="px-2.5 py-1.5 font-medium text-slate-600 whitespace-nowrap text-[11px]">
                        {row.monthPeriod}
                      </td>

                      {/* 2. Site / District */}
                      <td className="px-2.5 py-1.5 font-bold text-slate-900 whitespace-nowrap text-xs">
                        <span>{row.name || row.district}</span>
                      </td>

                      {/* 3. Annual Requirement (Doses) */}
                      <td className="px-2.5 py-1.5 text-right font-semibold text-slate-700 whitespace-nowrap text-[11px]">
                        {fmt(row.annualReq)}
                      </td>

                      {/* 4. Pre. Month-end Reporting (%) */}
                      <td className="px-2.5 py-1.5 text-right font-bold whitespace-nowrap text-[11px]">
                        <span className={row.reportingPct >= 100 ? 'text-emerald-700 font-black' : 'text-amber-700'}>
                          {Math.round(row.reportingPct)}%
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 ml-1">
                          ({row.reportingCount}/{row.totalCcp})
                        </span>
                      </td>

                      {/* 5. Opening Stock (Reported) */}
                      <td className="px-2.5 py-1.5 text-right font-semibold text-slate-700 whitespace-nowrap text-[11px]">
                        {row.reportedStock != null ? fmt(row.reportedStock) : '—'}
                      </td>

                      {/* 6. Opening Stock (Crude Estimate) */}
                      <td className="px-2.5 py-1.5 text-right font-bold text-orange-600 whitespace-nowrap text-[11px]">
                        {fmt(row.openingStockCrude)}
                      </td>

                      {/* 7. Vaccine Received */}
                      <td className="px-2.5 py-1.5 text-right font-semibold text-slate-700 whitespace-nowrap text-[11px]">
                        {fmt(row.vaccineReceived)}
                      </td>

                      {/* 8. Vaccinations (This Month) */}
                      <td className="px-2.5 py-1.5 text-right font-semibold text-slate-700 whitespace-nowrap text-[11px]">
                        {fmt(row.vaccinations)}
                      </td>

                      {/* 9. Closing Stock (Estimated) */}
                      <td className="px-2.5 py-1.5 text-right font-black text-indigo-700 bg-indigo-50/50 whitespace-nowrap text-[11px]">
                        {fmt(row.closingStockEstimated)}
                      </td>

                      {/* 10. Estimation Model */}
                      <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
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

                      {/* 11. Stock Availability (%) */}
                      <td className="px-2.5 py-1.5 text-right font-black text-slate-900 bg-slate-50/80 whitespace-nowrap text-[11px]">
                        {row.annualReq > 0 ? `${row.stockAvailabilityPct}%` : '—'}
                      </td>

                      {/* 12. Action */}
                      <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
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

                      {/* 4 SIDE CALCULATION COLUMNS (HIDDEN BY DEFAULT) */}
                      {showCalculationColumns && (
                        <>
                          <td className="px-2.5 py-1.5 text-right font-semibold text-slate-600 whitespace-nowrap text-[11px]">
                            {fmt(row.received12M)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-semibold text-slate-600 whitespace-nowrap text-[11px]">
                            {fmt(row.vax12M)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-semibold text-slate-600 whitespace-nowrap text-[11px]">
                            {fmt(row.vaccineConsumedWastage12M)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-bold text-slate-800 whitespace-nowrap text-[11px]">
                            {fmt(row.crudeOpeningFormulaValue)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}

                  {/* Summary / Totals Row */}
                  <tr className="bg-slate-200/90 font-black border-t-2 border-slate-300 text-slate-900">
                    <td className="px-2.5 py-2 font-bold text-slate-700 text-[11px]">Total</td>
                    <td className="px-2.5 py-2 font-black text-indigo-900 text-xs">
                      {selectedDistrictId === 'ALL' ? `${selectedStateName} Summary` : `${selectedDistrictName}`}
                    </td>
                    <td className="px-2.5 py-2 text-right text-[11px]">{fmt(aggregateTotals.annualReq)}</td>
                    <td className="px-2.5 py-2 text-right text-indigo-900 text-[11px]">
                      {Math.round(aggregateTotals.overallReportingPct)}% ({aggregateTotals.reportingCount}/{aggregateTotals.totalCcp})
                    </td>
                    <td className="px-2.5 py-2 text-right text-[11px]">{fmt(aggregateTotals.reportedStock)}</td>
                    <td className="px-2.5 py-2 text-right text-orange-700 text-[11px]">{fmt(aggregateTotals.openingStockCrude)}</td>
                    <td className="px-2.5 py-2 text-right text-[11px]">{fmt(aggregateTotals.vaccineReceived)}</td>
                    <td className="px-2.5 py-2 text-right text-[11px]">{fmt(aggregateTotals.vaccinations)}</td>
                    <td className="px-2.5 py-2 text-right text-indigo-800 text-[11px]">{fmt(aggregateTotals.closingStock)}</td>
                    <td className="px-2.5 py-2 text-center text-slate-600 text-[11px]">—</td>
                    <td className="px-2.5 py-2 text-right text-slate-900 text-[11px]">{aggregateTotals.overallAvailability}%</td>
                    <td className="px-2.5 py-2 text-center">
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

                    {showCalculationColumns && (
                      <>
                        <td className="px-2.5 py-2 text-right text-[11px]">{fmt(aggregateTotals.received12M)}</td>
                        <td className="px-2.5 py-2 text-right text-[11px]">{fmt(aggregateTotals.vax12M)}</td>
                        <td className="px-2.5 py-2 text-right text-[11px]">{fmt(aggregateTotals.totalVaxConsumed12M)}</td>
                        <td className="px-2.5 py-2 text-right text-[11px]">{fmt(aggregateTotals.openingStockCrude)}</td>
                      </>
                    )}
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
