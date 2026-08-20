import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, Download, RotateCcw, Calendar as CalendarIcon } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';

interface BlockData {
  id: number;
  name: string;
  district_name: string;
  state_name: string;
  is_urban?: boolean;
}

interface ProfileData {
  base_population: number;
}

interface ReportData {
  id: string;
  reporting_date: string;
  line_list_count: number;
  beneficiaries_vaccinated: number;
}

export const ProgressTrend: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const blockId = searchParams.get('blockId');

  const [loading, setLoading] = useState(true);
  const [block, setBlock] = useState<BlockData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [reports, setReports] = useState<ReportData[]>([]);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewBy, setViewBy] = useState('daily');

  useEffect(() => {
    if (!blockId) {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [blockRes, reportsRes] = await Promise.all([
          fetch(`/api/blocks/${blockId}`),
          fetch(`/api/reports/block/${blockId}`)
        ]);
        const blockData = await blockRes.json();
        const reportsData = await reportsRes.json();

        if (blockData.error) {
          navigate('/');
          return;
        }

        setBlock(blockData.block);
        setProfile(blockData.profile);
        
        if (!reportsData.error) {
          setReports(reportsData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [blockId, navigate]);

  const chartData = useMemo(() => {
    if (!profile || profile.base_population === 0 || reports.length === 0) return [];
    const target = Math.round(profile.base_population * 0.01);
    
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
      let key = r.reporting_date; // daily
      
      if (viewBy === 'weekly') {
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
        rawDate: lastReport.reporting_date, // for sorting if needed
        lineListedPct: Number(((lastReport.line_list_count / target) * 100).toFixed(1)),
        vaccinatedPct: Number(((lastReport.beneficiaries_vaccinated / target) * 100).toFixed(1)),
        rawLineList: lastReport.line_list_count,
        rawVaccinated: lastReport.beneficiaries_vaccinated
      };
    });
    
    // Sorting by the raw date of the last item in the group ensures chronological order
    return aggregated.sort((a, b) => a.rawDate.localeCompare(b.rawDate));
    
  }, [reports, profile, startDate, endDate, viewBy]);

  const maxLineListed = chartData.length > 0 ? Math.max(...chartData.map(d => d.lineListedPct)) : 0;
  const maxVaccinated = chartData.length > 0 ? Math.max(...chartData.map(d => d.vaccinatedPct)) : 0;

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
    link.setAttribute('download', `${block?.name || 'Block'}_Progress_Trend.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setViewBy('daily');
  };

  if (loading || !block) {
    return (
      <div className="h-[100dvh] w-full bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-hpv-purple border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600">Loading Trend Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <img src="/loginlogo.png" alt="Logo" className="h-10 object-contain" />
          <button 
            onClick={() => navigate(`/report?blockId=${blockId}`)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-hpv-purple bg-slate-100 hover:bg-hpv-purple-soft px-3 py-1.5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reporting
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 py-2 space-y-2 flex-1 overflow-y-auto min-h-0">
        
        {/* Block Hero Card */}
        <div className="gradient-header rounded-2xl p-3 text-white shadow-lg shadow-hpv-purple/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Building2 className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10">
            <p className="text-hpv-teal-light text-[10px] font-bold uppercase tracking-widest mb-0.5">
              HPV Vaccination Program
            </p>
            <h1 className="text-xl font-extrabold tracking-tight">{block.name} {block.is_urban ? 'City (Urban)' : 'Block (Rural)'}</h1>
            <p className="text-slate-300 text-xs mt-0.5">{block.district_name} District · {block.state_name}</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Date Range (Start)</label>
              <div className="relative">
                <CalendarIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input 
                  type="date" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-hpv-purple/20"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Date Range (End)</label>
              <div className="relative">
                <CalendarIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input 
                  type="date" 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-hpv-purple/20"
                />
              </div>
            </div>
            <button 
              onClick={handleReset}
              className="px-4 py-2 flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          <button 
            onClick={handleDownload}
            disabled={chartData.length === 0}
            className="px-4 py-2 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-hpv-purple hover:bg-hpv-purple-dark rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Download Data
          </button>
        </div>

        {/* Summary Metric Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white border-l-4 border-l-hpv-purple rounded-2xl p-3 border-y border-r border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">HPV Target Population</span>
            <span className="text-2xl font-extrabold font-mono text-slate-900">{profile ? Math.round(profile.base_population * 0.01).toLocaleString() : 0}</span>
            <span className="text-xs font-semibold text-slate-500">Goal</span>
          </div>
          <div className="bg-sky-50 border-l-4 border-l-sky-500 rounded-2xl p-3 border-y border-r border-sky-100 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-sky-700 mb-1">Eligible Girls Line Listed</span>
            <span className="text-2xl font-extrabold font-mono text-sky-800">{maxLineListed}%</span>
            <span className="text-xs font-semibold text-sky-600/80">Cumulative Percentage</span>
          </div>
          <div className="bg-emerald-50 border-l-4 border-l-emerald-500 rounded-2xl p-3 border-y border-r border-emerald-100 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-emerald-700 mb-1">Eligible Girls Vaccinated</span>
            <span className="text-2xl font-extrabold font-mono text-emerald-800">{maxVaccinated}%</span>
            <span className="text-xs font-semibold text-emerald-600/80">Cumulative Percentage</span>
          </div>
        </div>

        {/* Chart Area */}
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
              <select 
                value={viewBy} 
                onChange={e => setViewBy(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-hpv-purple"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div className="w-full flex-1 h-[250px] min-h-[250px]">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-500 font-semibold text-sm">
                No reporting data found for the selected range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="dateLabel" 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickMargin={10}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(value) => `${value}%`}
                    width={40}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value}%`, '']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '10px' }}
                  />
                  <ReferenceLine y={90} label={{ position: 'top', value: 'Goal (90%)', fill: '#6366f1', fontSize: 10, fontWeight: 'bold' }} stroke="#6366f1" strokeDasharray="3 3" />
                  <Line 
                    type="monotone" 
                    dataKey="lineListedPct" 
                    name="Eligible Girls % Line Listed"
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="vaccinatedPct" 
                    name="Eligible Girls Vaccinated %"
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </main>

      <footer className="w-full text-center py-2 text-xs text-slate-400 px-4 space-y-1 shrink-0 bg-white border-t border-slate-200 mt-auto">
        <div className="font-medium text-[11px] sm:text-[10px]">HPV Program Monitoring Portal • Version: 1.0 • UK 2026</div>
        <div className="flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-400">Powered by:</span>
          <img src="/impactcode.png" alt="ImpactCode" className="h-8 object-contain" />
        </div>
      </footer>
    </div>
  );
};
