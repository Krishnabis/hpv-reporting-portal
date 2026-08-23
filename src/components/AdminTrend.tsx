import React, { useState, useMemo } from 'react';
import { Download, RotateCcw, Filter } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { SearchableSelect } from './SearchableSelect';

interface ReportData {
  reporting_date: string;
  line_list_count: number;
  beneficiaries_vaccinated: number;
}

interface AdminTrendProps {
  statesList: any[];
  divisionsList: any[];
  districtsList: any[];
  blocksList: any[];
  filterLevel: 'State' | 'Division' | 'District' | 'Block';
  setFilterLevel: (level: 'State' | 'Division' | 'District' | 'Block') => void;
  filterStateId: string;
  setFilterStateId: (id: string) => void;
  filterDivisionId: string;
  setFilterDivisionId: (id: string) => void;
  filterDistrictId: string;
  setFilterDistrictId: (id: string) => void;
  filterBlockId: string;
  setFilterBlockId: (id: string) => void;
}

export const AdminTrend: React.FC<AdminTrendProps> = ({
  statesList, divisionsList, districtsList, blocksList,
  filterLevel, setFilterLevel,
  filterStateId, setFilterStateId,
  filterDivisionId, setFilterDivisionId,
  filterDistrictId, setFilterDistrictId,
  filterBlockId, setFilterBlockId
}) => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<{ base_population: number } | null>(null);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [scopeName, setScopeName] = useState<string>('');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewBy, setViewBy] = useState('daily');

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const params = new URLSearchParams({
        level: filterLevel.toUpperCase(),
        divisionId: filterDivisionId,
        districtId: filterDistrictId,
        blockId: filterBlockId
      });
      const res = await fetch(`/api/admin/trend?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch trend');
      setProfile(data.profile);
      setReports(data.reports);

      // Determine scope name based on selection
      if (filterLevel === 'State') {
        const state = statesList.find(s => s.id.toString() === filterStateId);
        setScopeName(state ? state.name : 'State');
      } else if (filterLevel === 'Division') {
        if (filterDivisionId === 'ALL') setScopeName('All Divisions');
        else {
          const div = divisionsList.find(d => d.id.toString() === filterDivisionId);
          setScopeName(div ? div.name : 'Division');
        }
      } else if (filterLevel === 'District') {
        if (filterDistrictId === 'ALL') setScopeName('All Districts');
        else {
          const dist = districtsList.find(d => d.id.toString() === filterDistrictId);
          setScopeName(dist ? dist.name : 'District');
        }
      } else {
        if (filterBlockId === 'ALL') setScopeName('All Blocks');
        else {
          const blk = blocksList.find(b => b.id.toString() === filterBlockId);
          setScopeName(blk ? blk.name : 'Block');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!profile || profile.base_population === 0 || reports.length === 0) return [];
    const target = Math.round(profile.base_population * 0.01);
    if (target === 0) return [];
    
    // 1. Filter by date range
    let filtered = reports;
    if (startDate) {
      filtered = filtered.filter(r => r.reporting_date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(r => r.reporting_date <= endDate);
    }
    
    // Sort ascending
    filtered.sort((a, b) => a.reporting_date.localeCompare(b.reporting_date));
    
    // 2. Group by view
    const groups: Record<string, ReportData[]> = {};
    filtered.forEach(r => {
      const d = new Date(r.reporting_date);
      let key = '';
      
      if (viewBy === 'daily') {
        const day = d.getUTCDate().toString().padStart(2, '0');
        const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        const year = d.getUTCFullYear();
        key = `${day}-${month}-${year}`;
      } else if (viewBy === 'weekly') {
        const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = dCopy.getUTCDay() || 7;
        dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(),0,1));
        const weekNo = Math.ceil((((dCopy.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
        key = `W${weekNo.toString().padStart(2, '0')} ${dCopy.getUTCFullYear()}`;
      } else if (viewBy === 'biweekly') {
        const dCopy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = dCopy.getUTCDay() || 7;
        dCopy.setUTCDate(dCopy.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(dCopy.getUTCFullYear(),0,1));
        const weekNo = Math.ceil((((dCopy.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
        const biweekNo = Math.ceil(weekNo / 2);
        key = `BiW${biweekNo.toString().padStart(2, '0')} ${dCopy.getUTCFullYear()}`;
      } else if (viewBy === 'monthly') {
        key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    
    // 3. For cumulative metrics, take the LAST report in each group
    const aggregated = Object.entries(groups).map(([key, groupReports]) => {
      const lastReport = groupReports[groupReports.length - 1];
      return {
        dateLabel: key,
        rawDate: lastReport.reporting_date, 
        lineListedPct: Number(((lastReport.line_list_count / target) * 100).toFixed(1)),
        vaccinatedPct: Number(((lastReport.beneficiaries_vaccinated / target) * 100).toFixed(1)),
        rawLineList: lastReport.line_list_count,
        rawVaccinated: lastReport.beneficiaries_vaccinated
      };
    });
    
    return aggregated.sort((a, b) => a.rawDate.localeCompare(b.rawDate));
    
  }, [reports, profile, startDate, endDate, viewBy]);

  const maxLineListed = chartData.length > 0 ? Math.max(...chartData.map(d => d.lineListedPct)) : 0;
  const maxVaccinated = chartData.length > 0 ? Math.max(...chartData.map(d => d.vaccinatedPct)) : 0;
  
  const maxLineListedCount = chartData.length > 0 ? chartData[chartData.length - 1].rawLineList : 0;
  const maxVaccinatedCount = chartData.length > 0 ? chartData[chartData.length - 1].rawVaccinated : 0;

  const handleDownload = () => {
    if (chartData.length === 0) return;
    const headers = ['Date', 'Line Listed Count', 'Line Listed %', 'Vaccinated Count', 'Vaccinated %'];
    const csvContent = [
      headers.join(','),
      ...chartData.map(row => 
        [
          `"${row.dateLabel}"`, 
          row.rawLineList, 
          row.lineListedPct, 
          row.rawVaccinated, 
          row.vaccinatedPct
        ].join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${scopeName || 'Trend'}_Progress_Trend.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setViewBy('daily');
  };

  const stateOptions = statesList.map(s => ({ id: s.id.toString(), name: s.name }));
  const districtOptions = [{ id: 'ALL', name: 'All Districts' }, ...districtsList.map(d => ({ id: d.id.toString(), name: d.name }))];
  const blockOptions = [{ id: 'ALL', name: 'All Blocks' }, ...blocksList.map(b => ({ id: b.id.toString(), name: `${b.name} (${b.district_name})` }))];

  return (
    <div className="flex flex-col min-h-full lg:h-full gap-2 lg:min-h-0 max-w-7xl mx-auto w-full pb-10 lg:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Admin Trend Generator</h1>
          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Generate State, District, or Block level cumulative reporting analytics</p>
        </div>
      </div>

      <div className="bg-white p-2.5 lg:px-4 lg:py-2.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 mb-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800 pb-2 lg:pb-0 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-100 lg:pr-4">
          <Filter className="w-4 h-4 text-emerald-600" /> Filters
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Select Area</label>
            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value as any)} className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold focus:border-emerald-500 focus:outline-none">
              <option value="State">State</option>
              <option value="Division">Division</option>
              <option value="District">District</option>
              <option value="Block">Block</option>
            </select>
          </div>

          {filterLevel === 'State' && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">State</label>
              <SearchableSelect 
                label="State"
                options={stateOptions} 
                value={stateOptions.find(o => o.id === filterStateId) || null} 
                onChange={(opt) => opt && setFilterStateId(opt.id.toString())} 
                placeholder="Select State..." 
              />
            </div>
          )}

          {filterLevel === 'Division' && (() => {
            const divOptions = [{id: 'ALL', name: 'All Divisions'}, ...divisionsList.map(d => ({ id: d.id.toString(), name: d.name }))];
            return (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Division</label>
                <SearchableSelect 
                  label="Division"
                  options={divOptions} 
                  value={divOptions.find(o => o.id === filterDivisionId) || null} 
                  onChange={(opt) => opt && setFilterDivisionId(opt.id.toString())} 
                  placeholder="Select Division..." 
                />
              </div>
            );
          })()}

          {filterLevel === 'District' && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">District</label>
              <SearchableSelect 
                label="District"
                options={districtOptions} 
                value={districtOptions.find(o => o.id === filterDistrictId) || null} 
                onChange={(opt) => opt && setFilterDistrictId(opt.id.toString())} 
                placeholder="Select District..." 
              />
            </div>
          )}

          {filterLevel === 'Block' && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Block</label>
              <SearchableSelect 
                label="Block"
                options={blockOptions} 
                value={blockOptions.find(o => o.id === filterBlockId) || null} 
                onChange={(opt) => opt && setFilterBlockId(opt.id.toString())} 
                placeholder="Select Block..." 
              />
            </div>
          )}
        </div>

        <div className="pt-2 lg:pt-0 lg:pl-4 border-t lg:border-t-0 lg:border-l border-slate-100 shrink-0">
          <button onClick={handleGenerate} disabled={loading} className="w-full lg:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            GENERATE TREND
          </button>
        </div>
      </div>

      {(profile && reports.length > 0) ? (
        <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-2xl overflow-y-auto lg:overflow-hidden relative p-3 sm:p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex flex-col">
                <label className="text-[9px] font-bold uppercase text-slate-500 mb-1">Date Range (Start)</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-600" />
              </div>
              <div className="flex flex-col">
                <label className="text-[9px] font-bold uppercase text-slate-500 mb-1">Date Range (End)</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-600" />
              </div>
              <div className="flex items-end">
                <button onClick={handleReset} className="px-4 py-2 flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>
            </div>

            <button onClick={handleDownload} disabled={chartData.length === 0} className="px-4 py-2 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 mt-4 sm:mt-0">
              <Download className="w-3.5 h-3.5" />
              Download Data
            </button>
          </div>

          {/* Summary Metric Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-white border-l-4 border-l-emerald-600 rounded-2xl p-3 border-y border-r border-slate-200 shadow-sm flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">HPV Target Population</span>
              <span className="text-2xl font-extrabold font-mono text-slate-900">{profile ? Math.round(profile.base_population * 0.01).toLocaleString('en-IN') : 0}</span>
              <span className="text-xs font-semibold text-slate-500">Goal ({scopeName}): &gt;90% (&gt;{profile ? Math.round(profile.base_population * 0.01 * 0.9).toLocaleString('en-IN') : 0})</span>
            </div>
            <div className="bg-emerald-50 border-l-4 border-l-emerald-500 rounded-2xl p-3 border-y border-r border-emerald-100 shadow-sm flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-emerald-700 mb-1">Eligible Girls Line Listed</span>
              <span className="text-2xl font-extrabold font-mono text-emerald-800">{maxLineListed}%</span>
              <span className="text-xs font-semibold text-emerald-600/80 mb-1">Cumulative Percentage</span>
              <span className="text-[11px] font-bold text-emerald-700">Count: {maxLineListedCount.toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-pink-50 border-l-4 border-l-pink-500 rounded-2xl p-3 border-y border-r border-pink-100 shadow-sm flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-pink-700 mb-1">Eligible Girls Vaccinated</span>
              <span className="text-2xl font-extrabold font-mono text-pink-800">{maxVaccinated}%</span>
              <span className="text-xs font-semibold text-pink-600/80 mb-1">Cumulative Percentage</span>
              <span className="text-[11px] font-bold text-pink-700">Count: {maxVaccinatedCount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm flex flex-col flex-1 min-h-[300px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Run Chart – Cumulative Progress Over Time (%)
                  <div className="w-4 h-4 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold" title="Shows cumulative progress over the selected interval">i</div>
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">View By</label>
                <select value={viewBy} onChange={e => setViewBy(e.target.value)} className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-600">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div style={{ width: '100%', height: '100%', minHeight: 300 }}>
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-slate-500 font-semibold text-sm">
                  No trend data found for the selected range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#64748b' }} tickMargin={10} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(value) => `${value}%`} width={40} />
                    <Tooltip 
                      formatter={(value: number, name: string, props: any) => {
                        const count = props.dataKey === 'lineListedPct' ? props.payload.rawLineList : props.payload.rawVaccinated;
                        return [`${value}% (${count.toLocaleString('en-IN')})`, ''];
                      }} 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                      labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }} 
                    />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '10px' }} />
                    <ReferenceLine y={90} label={{ position: 'top', value: `Goal: >90% (>${profile ? Math.round(profile.base_population * 0.01 * 0.9).toLocaleString('en-IN') : 0})`, fill: '#6366f1', fontSize: 10, fontWeight: 'bold' }} stroke="#6366f1" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="lineListedPct" name="Eligible Girls % Line Listed" stroke="#10b981" strokeWidth={2} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="vaccinatedPct" name="Eligible Girls Vaccinated %" stroke="#ec4899" strokeWidth={2} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 5 }} label={(props: any) => {
                      const { x, y, value, index } = props;
                      const point = chartData[index];
                      if (!point) return null;
                      return (
                        <text x={x} y={y - 12} fill="#ec4899" fontSize={10} fontWeight="bold" textAnchor="middle">
                          {value}% ({Number(point.rawVaccinated).toLocaleString('en-IN')})
                        </text>
                      );
                    }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Filter className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Trend Generated</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">Select a state, district, or block from the filters above and click Generate Trend to view the cumulative progress chart.</p>
          </div>
        </div>
      )}
    </div>
  );
};
