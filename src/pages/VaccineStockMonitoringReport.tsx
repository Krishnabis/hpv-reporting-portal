import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Download, ChevronDown, Filter, AlertCircle, Syringe, Building2, SortAsc
} from 'lucide-react';

interface ReportRow {
  id: string | number;
  name: string;
  district: string;
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
  entity_type: string;
}

export const VaccineStockMonitoringReport: React.FC<{ 
  adminUser: any,
  divisions: any[],
  districts: any[]
}> = ({ adminUser, divisions, districts }) => {
  const [data, setData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [targetMonth, setTargetMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportLevel, setReportLevel] = useState<'DISTRICT' | 'BLOCK'>('BLOCK');
  const [selectedDivision, setSelectedDivision] = useState('ALL');
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // Least on Top is 'asc'

  // Divisions and districts are now passed as props, so we don't need to fetch them here.

  const fetchData = async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const params = new URLSearchParams({
        reportingMonth: targetMonth,
        level: reportLevel,
        divisionId: selectedDivision,
        districtId: selectedDistrict
      });
      if (reset) params.append('reset', 'true');
      
      const res = await fetch(`/api/admin/reports/stock-monitoring?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch report data');
      const json = await res.json();
      setData(json.rows || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [reportLevel, targetMonth, selectedDivision, selectedDistrict]);

  const fmt = (val: number | null | undefined, dec = 0) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return val.toLocaleString('en-IN', { maximumFractionDigits: dec });
  };

  const sortedData = useMemo(() => {
    let arr = [...data];
    arr.sort((a, b) => {
        if (sortOrder === 'asc') {
            return a.stock_availability_pct - b.stock_availability_pct;
        } else {
            return b.stock_availability_pct - a.stock_availability_pct;
        }
    });
    return arr;
  }, [data, sortOrder]);

  const aggregateTotals = useMemo(() => {
    let totals = {
      annual_req: 0, opening_crude: 0, opening: 0,
      received: 0, vaccinations: 0, closing: 0,
      reporting_count: 0, total_ccp: 0, stock_reported: 0
    };
    let received_12m_sum = 0;
    let vax_12m_sum = 0;

    data.forEach(d => {
      totals.annual_req += d.annual_requirement || 0;
      totals.received += d.vaccine_received || 0;
      totals.vaccinations += d.vaccinations || 0;
      totals.reporting_count += d.month_end_reporting_count || 0;
      totals.total_ccp += d.month_end_total_ccp || 0;
      totals.stock_reported += d.month_end_stock_reported || 0;

      if (reportLevel === 'BLOCK') {
          if (d.entity_type === 'CCL_LEVEL_2_DISTRICT_STORE') {
              received_12m_sum += d.vaccine_received_last_12_months || 0;
          } else {
              vax_12m_sum += d.vaccinations_last_12_months || 0;
          }
      } else {
          totals.opening_crude += d.opening_stock_crude_method || 0;
          totals.opening += d.opening_stock || 0;
          totals.closing += d.estimated_stock_balance || 0;
      }
    });

    if (reportLevel === 'BLOCK') {
        const consumed_12m = Math.round(vax_12m_sum * 1.01);
        totals.opening_crude = Math.max(0, received_12m_sum - consumed_12m);
        totals.opening = (totals.reporting_count === totals.total_ccp && totals.total_ccp > 0) ? totals.stock_reported : totals.opening_crude;
        const consumed_curr = Math.round(totals.vaccinations * 1.01);
        totals.closing = Math.max(0, totals.opening + totals.received - consumed_curr);
    }

    return totals;
  }, [data, reportLevel]);

  const overallAvailability = aggregateTotals.annual_req > 0 ? (aggregateTotals.opening / aggregateTotals.annual_req) * 100 : 0;
  const overallReportingPct = aggregateTotals.total_ccp > 0 ? (aggregateTotals.reporting_count / aggregateTotals.total_ccp) * 100 : 0;

  const downloadCSV = () => {
    const headers = [
      'Site Unit',
      'Annual Requirement (Doses)',
      'Pre. Month-end Reporting (%)',
      'Pre.Month-end Stock (Reported)',
      'Opening Stock (Crude Estimate)',
      'Vaccine Received',
      'Vaccinations',
      'Closing Stock (Estimated)',
      'Estimation Model',
      'Stock Availability (%)',
      'Action'
    ];
    
    const rows = sortedData.map(d => [
      d.name,
      d.annual_requirement,
      `${d.month_end_reporting_count}/${d.month_end_total_ccp} (${Math.round(d.month_end_reporting_pct)}%)`,
      d.month_end_stock_reported != null ? d.month_end_stock_reported : '—',
      d.opening_stock_crude_method,
      d.vaccine_received,
      d.vaccinations,
      d.estimated_stock_balance,
      d.estimation_model,
      `${Math.round(d.stock_availability_pct)}%`,
      d.action_required
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Stock_Monitoring_Report_${targetMonth}.csv`;
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
        <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">HPV Vaccine Stock Monitoring Report</h1>
            <p className="text-sm text-slate-500 font-medium">Dynamic stock estimation and status tracking</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <input 
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="text-sm font-semibold text-slate-700 focus:outline-none bg-transparent"
              />
            </div>
            <button 
              onClick={() => fetchData(true)}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors border border-indigo-200"
            >
              Generate Report
            </button>
            <button 
              onClick={downloadCSV}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50/50 border-t border-slate-200 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filters</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Report Level:</span>
            <select
              value={reportLevel}
              onChange={(e) => setReportLevel(e.target.value as any)}
              className="text-sm border-slate-200 rounded-md bg-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-1"
            >
              <option value="DISTRICT">Districts</option>
              <option value="BLOCK">Block Units</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Districts:</span>
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="text-sm border-slate-200 rounded-md bg-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-1"
            >
              <option value="ALL">All Districts</option>
              {divisions.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Block Units:</span>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="text-sm border-slate-200 rounded-md bg-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-1"
            >
              <option value="ALL">All Block Units</option>
              {districts.filter(d => selectedDivision === 'ALL' || d.division_id === parseInt(selectedDivision)).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
             <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm hover:bg-slate-50"
             >
                <SortAsc className={`w-3.5 h-3.5 ${sortOrder === 'asc' ? 'text-indigo-600' : 'text-slate-400'}`} />
                Least Stock on Top
             </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4 sm:p-6 bg-slate-100">
        <div className="h-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-slate-500">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="font-medium text-lg">Generating Stock Report...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-red-500">
                <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-bold text-lg">{error}</p>
                <button onClick={() => fetchData(true)} className="mt-4 text-sm underline font-medium hover:text-red-600">Try Again</button>
              </div>
            ) : data.length === 0 ? (
              <div className="flex items-center justify-center h-full p-8 text-slate-500 font-medium">
                No data available for the selected filters.
              </div>
            ) : (
              <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
                <thead className="sticky top-0 bg-[#311054] text-white z-10 shadow-md">
                  <tr>
                    <th className="px-3 py-3 font-semibold text-white/90">Site Unit</th>
                    <th className="px-2 py-3 font-semibold text-right text-red-200">Annual<br/>Requirement<br/>(Doses)</th>
                    <th className="px-2 py-3 font-semibold text-right text-emerald-200">Pre. Month-end<br/>Reporting (%)</th>
                    <th className="px-2 py-3 font-semibold text-right text-red-200">Pre.Month-end<br/>Stock (Reported)</th>
                    <th className="px-2 py-3 font-semibold text-right text-red-200">Opening Stock<br/>(Crude Estimate)</th>
                    <th className="px-2 py-3 font-semibold text-right text-white/90">Vaccine<br/>Received</th>
                    <th className="px-2 py-3 font-semibold text-right text-white/90">Vaccinations</th>
                    <th className="px-2 py-3 font-semibold text-right text-blue-200">Closing Stock<br/>(Estimated)</th>
                    <th className="px-2 py-3 font-semibold text-center text-white/90">Estimation<br/>Model</th>
                    <th className="px-2 py-3 font-semibold text-right text-white/90">Stock<br/>Availability (%)</th>
                    <th className="px-3 py-3 font-semibold text-center text-white/90">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedData.map((row, i) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                            {row.entity_type === 'CCL_LEVEL_2_DISTRICT_STORE' ? (
                                <Building2 className="w-4 h-4 text-pink-500 shrink-0" />
                            ) : (
                                <Syringe className="w-4 h-4 text-indigo-500 shrink-0" />
                            )}
                            <div>
                                <div className="font-bold text-slate-800">{row.name}</div>
                                {reportLevel === 'BLOCK' && row.entity_type !== 'CCL_LEVEL_2_DISTRICT_STORE' && (
                                    <div className="text-[10px] text-slate-500 font-medium">{row.district}</div>
                                )}
                            </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold text-slate-700">{fmt(row.annual_requirement)}</td>
                      <td className="px-2 py-2 text-right font-medium text-slate-600">
                        {row.month_end_reporting_count}/{row.month_end_total_ccp} ({Math.round(row.month_end_reporting_pct)}%)
                      </td>
                      <td className="px-2 py-2 text-right font-semibold text-slate-700">{row.month_end_stock_reported != null ? fmt(row.month_end_stock_reported) : '—'}</td>
                      <td className="px-2 py-2 text-right font-semibold text-orange-500">{fmt(row.opening_stock_crude_method)}</td>
                      <td className="px-2 py-2 text-right font-semibold text-slate-700">{fmt(row.vaccine_received)}</td>
                      <td className="px-2 py-2 text-right font-semibold text-slate-700">{fmt(row.vaccinations)}</td>
                      <td className="px-2 py-2 text-right font-bold text-blue-600">{fmt(row.estimated_stock_balance)}</td>
                      <td className="px-2 py-2 text-center font-medium text-slate-600">{row.estimation_model}</td>
                      <td className="px-2 py-2 text-right font-bold text-slate-800">{Math.round(row.stock_availability_pct)}%</td>
                      <td className="px-3 py-2 text-center">
                        {row.action_required === 'Critical' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">Critical</span>
                        ) : row.action_required === 'Re-order Stock' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">Reorder</span>
                        ) : (
                            <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Totals Row */}
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                    <td className="px-3 py-3 text-slate-800">Total</td>
                    <td className="px-2 py-3 text-right text-slate-700">{fmt(aggregateTotals.annual_req)}</td>
                    <td className="px-2 py-3 text-right text-slate-700">{aggregateTotals.reporting_count}/{aggregateTotals.total_ccp} ({Math.round(overallReportingPct)}%)</td>
                    <td className="px-2 py-3 text-right text-slate-700">{fmt(aggregateTotals.stock_reported)}</td>
                    <td className="px-2 py-3 text-right text-orange-600">{fmt(aggregateTotals.opening_crude)}</td>
                    <td className="px-2 py-3 text-right text-slate-700">{fmt(aggregateTotals.received)}</td>
                    <td className="px-2 py-3 text-right text-slate-700">{fmt(aggregateTotals.vaccinations)}</td>
                    <td className="px-2 py-3 text-right text-blue-700">{fmt(aggregateTotals.closing)}</td>
                    <td className="px-2 py-3 text-center">—</td>
                    <td className="px-2 py-3 text-right text-slate-800">{Math.round(overallAvailability)}%</td>
                    <td className="px-3 py-3 text-center">
                        {overallAvailability > 0 && overallAvailability < 10 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">Critical</span>
                        ) : overallAvailability > 0 && overallAvailability < 25 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">Reorder</span>
                        ) : (
                            <span className="text-slate-400">—</span>
                        )}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
