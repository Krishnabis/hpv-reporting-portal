import React, { useState, useEffect, useMemo } from 'react';
import { Download, AlertCircle, Info, Building2, MapPin } from 'lucide-react';

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
}

interface StateItem {
  id: number | string;
  name: string;
}

interface ColumnTooltipProps {
  title: string;
  tooltip: string;
  align?: 'left' | 'center' | 'right';
  highlight?: boolean;
}

const ColumnHeader: React.FC<ColumnTooltipProps> = ({ title, tooltip, align = 'right', highlight = false }) => {
  return (
    <th className={`px-3 py-3.5 text-xs font-bold tracking-wider select-none group relative border-b border-purple-900/40 ${
      align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right'
    } ${highlight ? 'bg-purple-950/70 text-amber-200' : 'text-white/90'}`}>
      <div className={`inline-flex items-center gap-1.5 ${align === 'left' ? 'justify-start' : align === 'center' ? 'justify-center' : 'justify-end'} w-full`}>
        <span>{title}</span>
        <div className="relative inline-block text-left">
          <Info className="w-3.5 h-3.5 text-white/50 group-hover:text-amber-300 transition-colors cursor-help shrink-0" />
          <div className="pointer-events-none absolute bottom-full mb-2 hidden group-hover:block w-64 p-2.5 bg-slate-900 text-slate-100 text-[11px] font-normal leading-relaxed rounded-lg shadow-xl border border-slate-700 z-50 transition-opacity duration-200 left-1/2 -translate-x-1/2">
            {tooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </div>
        </div>
      </div>
    </th>
  );
};

export const VaccineStockMonitoringReport: React.FC<{ 
  adminUser?: any;
  divisions?: any[];
  districts?: any[];
  states?: StateItem[];
  reportingMonth?: string;
}> = ({ adminUser, states: initialStates = [] }) => {
  const [data, setData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // States List
  const [statesList, setStatesList] = useState<StateItem[]>(initialStates);
  const [selectedStateId, setSelectedStateId] = useState<string>('');

  // Selected Reporting Period Month
  const [currentPeriodStr] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

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
    return found ? found.name : 'Selected State';
  }, [statesList, selectedStateId]);

  // Format month period string e.g. "August 2026"
  const formattedMonthPeriod = useMemo(() => {
    if (!currentPeriodStr) return '';
    const [yr, mo] = currentPeriodStr.split('-');
    const dateObj = new Date(parseInt(yr), parseInt(mo) - 1, 1);
    return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentPeriodStr]);

  // Fetch Stock Data for selected State
  const fetchData = async () => {
    if (!selectedStateId) return;

    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const params = new URLSearchParams({
        reportingMonth: currentPeriodStr,
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
  }, [selectedStateId, currentPeriodStr]);

  // Number Formatter
  const fmt = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return Math.round(val).toLocaleString('en-IN');
  };

  // Process and calculate each district row deterministically according to prompt logic
  const processedRows = useMemo(() => {
    return data.map(row => {
      const annualReq = row.annual_requirement || 0;
      const reportingPct = row.month_end_reporting_pct || 0;
      const reportingCount = row.month_end_reporting_count || 0;
      const totalCcp = row.month_end_total_ccp || 0;
      const reportedStock = row.month_end_stock_reported;

      const received12M = row.vaccine_received_last_12_months || 0;
      const vax12M = row.vaccinations_last_12_months || 0;
      const vaccineConsumedWastage12M = Math.round(vax12M * 1.01);

      // Crude Method Opening Stock
      const openingStockCrude = Math.max(0, received12M - vax12M - vaccineConsumedWastage12M);

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
  }, [data, formattedMonthPeriod]);

  // Aggregate Totals for the State Summary Row
  const aggregateTotals = useMemo(() => {
    let annualReq = 0;
    let reportingCount = 0;
    let totalCcp = 0;
    let reportedStock = 0;
    let openingStockCrude = 0;
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
      openingStockCrude += r.openingStockCrude;
      vaccineReceived += r.vaccineReceived;
      vaccinations += r.vaccinations;
      closingStock += r.closingStockEstimated;
      received12M += r.received12M;
      vax12M += r.vax12M;
    });

    const totalVaxConsumed12M = Math.round(vax12M * 1.01);
    const overallCrudeOpening = Math.max(0, received12M - vax12M - totalVaxConsumed12M);
    const overallReportingPct = totalCcp > 0 ? (reportingCount / totalCcp) * 100 : 0;
    const overallOpening = overallReportingPct >= 100 ? reportedStock : overallCrudeOpening;
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
      'Pre. Month-end Stock (Reported)',
      'Opening Stock (Crude Estimate)',
      'Vaccine Received',
      'Vaccinations',
      'Closing Stock (Estimated)',
      'Estimation Model',
      'Stock Availability (%)',
      'Action',
      'Vaccine Received Last 12 Months (since the selected date)',
      'Vaccinations Last 12 Months (since the selected date)',
      'Vaccine Consumed (Wastage Factor) 1.01',
      'Opening Stock * Crude Method'
    ];

    const rows = processedRows.map(r => [
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
      `"${r.actionCategory}"`,
      r.received12M,
      r.vax12M,
      r.vaccineConsumedWastage12M,
      r.crudeOpeningFormulaValue
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `District_Vaccine_Stock_${selectedStateName.replace(/\s+/g, '_')}_${currentPeriodStr}.csv`;
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Top Section Header & State Filter Bar */}
      <div className="bg-white border-b border-slate-200 shadow-xs z-20 shrink-0">
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                Vaccine Stock & Availability
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              District-wise monthly vaccine stock estimation and availability calculations
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={downloadCSV}
              disabled={processedRows.length === 0}
              className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold shadow-xs hover:bg-slate-50 hover:border-slate-400 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              Export CSV
            </button>
          </div>
        </div>

        {/* 1. PAGE FILTER BAR: ONLY ONE FILTER (STATE) */}
        <div className="px-5 py-3 bg-slate-100/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-indigo-600" /> State:
            </span>
            <select
              value={selectedStateId}
              onChange={(e) => setSelectedStateId(e.target.value)}
              className="text-sm font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-1.5 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[200px]"
            >
              {statesList.map(s => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="text-xs font-semibold text-indigo-900 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-md">
            Showing districts for: <span className="font-bold text-indigo-700">{selectedStateName}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-4 sm:p-6 bg-slate-100 flex flex-col min-h-0">
        <div className="h-full bg-white rounded-xl shadow-xs border border-slate-200 flex flex-col overflow-hidden">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1 p-12 text-slate-500">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
              <p className="font-bold text-slate-700 text-base">Calculating District Vaccine Stock...</p>
              <p className="text-xs text-slate-400 mt-1">Applying crude estimation models and 12-month rolling data</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center flex-1 p-12 text-red-500">
              <AlertCircle className="w-12 h-12 mb-3 opacity-60" />
              <p className="font-bold text-base">{error}</p>
              <button
                onClick={fetchData}
                className="mt-4 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-xs font-bold border border-red-200 hover:bg-red-100"
              >
                Retry Loading
              </button>
            </div>
          ) : processedRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 p-12 text-slate-500">
              <Building2 className="w-12 h-12 mb-3 text-slate-300" />
              <p className="font-bold text-slate-700 text-base">No districts found for {selectedStateName}</p>
              <p className="text-xs text-slate-400 mt-1">Please select another state from the filter above</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto relative">
              <table className="w-full text-xs text-left border-collapse min-w-[2100px]">
                {/* 3. EXACT COLUMN ORDER */}
                <thead className="sticky top-0 bg-[#311054] text-white z-20 shadow-sm">
                  <tr>
                    <ColumnHeader 
                      title="Selected Month Period" 
                      tooltip="The month and year for which this stock availability report is calculated."
                      align="left"
                    />
                    <ColumnHeader 
                      title="Site / District" 
                      tooltip="Name of the district within the selected State."
                      align="left"
                      highlight={true}
                    />
                    <ColumnHeader 
                      title="Annual Requirement (Doses)" 
                      tooltip="Target annual vaccine requirement in doses for this district."
                      align="right"
                    />
                    <ColumnHeader 
                      title="Pre. Month-end Reporting (%)" 
                      tooltip="Percentage of expected reporting units that submitted the previous month's month-end stock report. Formula: (Submitted Units / Total Expected Units) x 100. Reported stock is used for availability calculations ONLY when reporting is 100%."
                      align="right"
                      highlight={true}
                    />
                    <ColumnHeader 
                      title="Pre. Month-end Stock (Reported)" 
                      tooltip="Actual reported stock from previous month-end reports. Used as primary opening stock ONLY when previous month reporting is 100%."
                      align="right"
                    />
                    <ColumnHeader 
                      title="Opening Stock (Crude Estimate)" 
                      tooltip="Calculated crude opening stock formula: (Vaccine Received Last 12 Months) - (Vaccinations Last 12 Months) - (Vaccine Consumed Last 12 Months with 1.01 wastage factor)."
                      align="right"
                      highlight={true}
                    />
                    <ColumnHeader 
                      title="Vaccine Received" 
                      tooltip="Vaccine doses received in the district during the selected month."
                      align="right"
                    />
                    <ColumnHeader 
                      title="Vaccinations" 
                      tooltip="Total vaccinations performed in the district during the selected month."
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
                    <ColumnHeader 
                      title="Vaccine Received Last 12 Months (since the selected date)" 
                      tooltip="Total vaccine doses received over the rolling 12-month period ending at the selected date."
                      align="right"
                    />
                    <ColumnHeader 
                      title="Vaccinations Last 12 Months (since the selected date)" 
                      tooltip="Total vaccinations recorded over the rolling 12-month period ending at the selected date."
                      align="right"
                    />
                    <ColumnHeader 
                      title="Vaccine Consumed (Wastage Factor) 1.01" 
                      tooltip="Vaccine consumed over the last 12 months calculated with a 1.01 wastage factor: ROUND(Vaccinations Last 12 Months x 1.01)."
                      align="right"
                    />
                    <ColumnHeader 
                      title="Opening Stock * Crude Method" 
                      tooltip="Exposed crude opening stock calculation: Vaccine Received Last 12 Months - Vaccinations Last 12 Months - ROUND(Vaccinations Last 12 Months x 1.01)."
                      align="right"
                    />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {processedRows.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-indigo-50/40 transition-colors">
                      {/* 1. Selected Month Period */}
                      <td className="px-3 py-2.5 font-medium text-slate-600 whitespace-nowrap">
                        {row.monthPeriod}
                      </td>

                      {/* 2. Site / District */}
                      <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap sticky left-0 bg-white shadow-xs z-10">
                        {row.name || row.district}
                      </td>

                      {/* 3. Annual Requirement (Doses) */}
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-700 whitespace-nowrap">
                        {fmt(row.annualReq)}
                      </td>

                      {/* 4. Pre. Month-end Reporting (%) */}
                      <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap">
                        <span className={row.reportingPct >= 100 ? 'text-emerald-700 font-black' : 'text-amber-700'}>
                          {Math.round(row.reportingPct)}%
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 ml-1">
                          ({row.reportingCount}/{row.totalCcp})
                        </span>
                      </td>

                      {/* 5. Pre. Month-end Stock (Reported) */}
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-700 whitespace-nowrap">
                        {row.reportedStock != null ? fmt(row.reportedStock) : '—'}
                      </td>

                      {/* 6. Opening Stock (Crude Estimate) */}
                      <td className="px-3 py-2.5 text-right font-bold text-orange-600 whitespace-nowrap">
                        {fmt(row.openingStockCrude)}
                      </td>

                      {/* 7. Vaccine Received */}
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-700 whitespace-nowrap">
                        {fmt(row.vaccineReceived)}
                      </td>

                      {/* 8. Vaccinations */}
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-700 whitespace-nowrap">
                        {fmt(row.vaccinations)}
                      </td>

                      {/* 9. Closing Stock (Estimated) */}
                      <td className="px-3 py-2.5 text-right font-black text-indigo-700 bg-indigo-50/50 whitespace-nowrap">
                        {fmt(row.closingStockEstimated)}
                      </td>

                      {/* 10. Estimation Model */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {row.estimationModel === 'Reported Stock' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Reported Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                            Crude Method
                          </span>
                        )}
                      </td>

                      {/* 11. Stock Availability (%) */}
                      <td className="px-3 py-2.5 text-right font-black text-slate-900 bg-slate-50/80 whitespace-nowrap">
                        {row.annualReq > 0 ? `${row.stockAvailabilityPct}%` : '—'}
                      </td>

                      {/* 12. Action */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {row.actionCategory === 'Critical' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-red-100 text-red-800 border border-red-300">
                            Critical
                          </span>
                        ) : row.actionCategory === 'Replenish' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                            Replenish
                          </span>
                        ) : row.actionCategory === 'Monitor' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300">
                            Monitor
                          </span>
                        ) : row.actionCategory === 'Adequate' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Adequate
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">—</span>
                        )}
                      </td>

                      {/* 13. Vaccine Received Last 12 Months */}
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-600 whitespace-nowrap">
                        {fmt(row.received12M)}
                      </td>

                      {/* 14. Vaccinations Last 12 Months */}
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-600 whitespace-nowrap">
                        {fmt(row.vax12M)}
                      </td>

                      {/* 15. Vaccine Consumed (Wastage Factor) 1.01 */}
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-600 whitespace-nowrap">
                        {fmt(row.vaccineConsumedWastage12M)}
                      </td>

                      {/* 16. Opening Stock * Crude Method */}
                      <td className="px-3 py-2.5 text-right font-bold text-slate-800 whitespace-nowrap">
                        {fmt(row.crudeOpeningFormulaValue)}
                      </td>
                    </tr>
                  ))}

                  {/* Summary / Totals Row */}
                  <tr className="bg-slate-200/90 font-black border-t-2 border-slate-300 text-slate-900">
                    <td className="px-3 py-3 font-bold text-slate-700">Total</td>
                    <td className="px-3 py-3 font-black text-indigo-900 sticky left-0 bg-slate-200 z-10">
                      {selectedStateName} Summary
                    </td>
                    <td className="px-3 py-3 text-right">{fmt(aggregateTotals.annualReq)}</td>
                    <td className="px-3 py-3 text-right text-indigo-900">
                      {Math.round(aggregateTotals.overallReportingPct)}% ({aggregateTotals.reportingCount}/{aggregateTotals.totalCcp})
                    </td>
                    <td className="px-3 py-3 text-right">{fmt(aggregateTotals.reportedStock)}</td>
                    <td className="px-3 py-3 text-right text-orange-700">{fmt(aggregateTotals.openingStockCrude)}</td>
                    <td className="px-3 py-3 text-right">{fmt(aggregateTotals.vaccineReceived)}</td>
                    <td className="px-3 py-3 text-right">{fmt(aggregateTotals.vaccinations)}</td>
                    <td className="px-3 py-3 text-right text-indigo-800">{fmt(aggregateTotals.closingStock)}</td>
                    <td className="px-3 py-3 text-center text-slate-600">—</td>
                    <td className="px-3 py-3 text-right text-slate-900">{aggregateTotals.overallAvailability}%</td>
                    <td className="px-3 py-3 text-center">
                      {aggregateTotals.overallAction === 'Critical' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-200 text-red-900">Critical</span>
                      ) : aggregateTotals.overallAction === 'Replenish' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-200 text-amber-900">Replenish</span>
                      ) : aggregateTotals.overallAction === 'Monitor' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-200 text-blue-900">Monitor</span>
                      ) : aggregateTotals.overallAction === 'Adequate' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-200 text-emerald-900">Adequate</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">{fmt(aggregateTotals.received12M)}</td>
                    <td className="px-3 py-3 text-right">{fmt(aggregateTotals.vax12M)}</td>
                    <td className="px-3 py-3 text-right">{fmt(aggregateTotals.totalVaxConsumed12M)}</td>
                    <td className="px-3 py-3 text-right">{fmt(aggregateTotals.openingStockCrude)}</td>
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
