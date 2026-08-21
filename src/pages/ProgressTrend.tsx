import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, Download, RotateCcw, Calendar as CalendarIcon, Activity } from 'lucide-react';
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
    let filtered = [...reports];
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
      } else if (viewBy === 'quarterly') {
        const q = Math.floor(d.getMonth() / 3) + 1;
        key = `Q${q} ${d.getFullYear()}`;
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
        lineListedPct: Math.round((lastReport.line_list_count / target) * 100),
        vaccinatedPct: Math.round((lastReport.beneficiaries_vaccinated / target) * 100),
        rawLineList: lastReport.line_list_count,
        rawVaccinated: lastReport.beneficiaries_vaccinated
      };
    });
    
    // Sorting by the raw date of the last item in the group ensures chronological order
    return aggregated.sort((a, b) => a.rawDate.localeCompare(b.rawDate));
    
  }, [reports, profile, startDate, endDate, viewBy]);

  const latestData = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const maxLineListed = latestData ? latestData.lineListedPct : 0;
  const maxVaccinated = latestData ? latestData.vaccinatedPct : 0;
  const maxLineListCount = latestData ? latestData.rawLineList : 0;
  const maxVaccinatedCount = latestData ? latestData.rawVaccinated : 0;

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
        <div className="max-w-6xl mx-auto px-4 py-1.5 flex items-center justify-between relative min-h-[48px]">
          <div className="cursor-pointer flex items-center gap-3" onClick={() => navigate('/')}>
            <img src="/headinglogo.png" alt="Logo" className="h-14 object-contain hover:opacity-80 transition-opacity" />
          </div>
          <button 
            onClick={() => navigate(`/report?blockId=${blockId}`)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-hpv-purple bg-slate-100 hover:bg-hpv-purple-soft px-3 py-1.5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Reporting
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 py-2 flex flex-col gap-2 flex-1 overflow-y-auto min-h-0">
        
        {/* Block Hero Card */}
        <div className="shrink-0 gradient-header rounded-2xl py-2 px-3 text-white shadow-lg shadow-hpv-purple/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Building2 className="w-16 h-16 text-white" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div>
              <p className="text-hpv-teal-light text-[10px] font-bold uppercase tracking-widest mb-0.5">
                HPV Vaccination Program
              </p>
              <h1 className="text-lg font-extrabold tracking-tight flex items-baseline gap-2">
                <span>{block.name}</span>
                <span className="text-sm font-medium text-slate-300">{block.is_urban ? 'City (Urban)' : 'Block (Rural)'}</span>
              </h1>
              <p className="text-slate-300 text-xs mt-0.5">{block.district_name} District · {block.state_name}</p>
            </div>
            
            {(() => {
              const lastReport = reports[0];
              const target = profile ? Math.round(profile.base_population * 0.01) : 0;
              let perfPercentage = 0;
              if (target > 0 && lastReport) {
                perfPercentage = (lastReport.beneficiaries_vaccinated / target) * 100;
              }
              let catImg = 'cat1.png';
              let catName = 'Aspirational';
              if (perfPercentage >= 90) { catImg = 'cat4.png'; catName = 'Champions'; }
              else if (perfPercentage >= 70) { catImg = 'cat3.png'; catName = 'High-Performing'; }
              else if (perfPercentage >= 30) { catImg = 'cat2.png'; catName = 'Progressing'; }
              
              if (!profile || profile.base_population === 0) return null;
              
              return (
                <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0 self-start sm:self-auto">
                  <div className="bg-white/25 backdrop-blur-md border border-white/20 rounded-xl px-3 py-1.5 flex flex-col items-center justify-center">
                    <span className="text-[8px] uppercase tracking-widest text-slate-300 font-semibold block mb-1">Performance Category</span>
                    <div className="flex items-center gap-2">
                      <img src={`/${catImg}`} alt={catName} className="h-8 object-contain" />
                      <span className="text-sm font-bold text-white tracking-wide">{catName}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="flex items-center gap-2 px-1">
          <Activity className="w-5 h-5 text-hpv-purple" />
          <h2 className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-hpv-purple to-hpv-pink tracking-tight uppercase">Progress Trend</h2>
        </div>

        {/* Filter Bar */}
        <div className="shrink-0 bg-white rounded-xl p-2 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-end justify-between gap-2">
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
        <div className="shrink-0 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-slate-50 border-l-4 border-l-slate-400 rounded-xl p-2 border-y border-r border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 leading-tight">Total Population</span>
            <span className="text-xl font-extrabold font-mono text-slate-900 leading-tight">{profile ? profile.base_population.toLocaleString() : 0}</span>
            <span className="text-[10px] font-semibold text-slate-500">HPV Target (1%): {profile ? Math.round(profile.base_population * 0.01).toLocaleString() : 0}</span>
          </div>
          <div className="bg-white border-l-4 border-l-hpv-purple rounded-xl p-2 border-y border-r border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 leading-tight">HPV Vaccination Goal</span>
            <span className="text-xl font-extrabold font-mono text-slate-900 leading-tight">&gt;90%</span>
            <span className="text-[10px] font-semibold text-slate-500">Goal: &gt;{profile ? Math.round(profile.base_population * 0.01 * 0.90).toLocaleString() : 0}</span>
          </div>
          <div className="bg-sky-50 border-l-4 border-l-sky-500 rounded-xl p-2 border-y border-r border-sky-100 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-sky-700 leading-tight">Eligible Girls Line Listed</span>
            <span className="text-lg sm:text-xl font-extrabold font-mono text-sky-800 leading-tight">{maxLineListed}%</span>
            <span className="text-[10px] font-semibold text-sky-600/80">Count: {maxLineListCount.toLocaleString()}</span>
          </div>
          <div className="bg-emerald-50 border-l-4 border-l-emerald-500 rounded-xl p-2 border-y border-r border-emerald-100 shadow-sm flex flex-col justify-center">
            <span className="text-[10px] uppercase font-bold text-emerald-700 leading-tight">Eligible Girls Vaccinated</span>
            <span className="text-lg sm:text-xl font-extrabold font-mono text-emerald-800 leading-tight">{maxVaccinated}%</span>
            <span className="text-[10px] font-semibold text-emerald-600/80">Count: {maxVaccinatedCount.toLocaleString()}</span>
          </div>
        </div>

        {/* Chart Area */}
        <div className="bg-white rounded-xl p-2 sm:p-3 border border-slate-200 shadow-sm flex flex-col flex-1 min-h-[350px] overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Run Chart – Cumulative Progress Over Time (%)
                <div className="w-4 h-4 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold cursor-help" title="Shows cumulative progress over the selected interval. Higher is better.">i</div>
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
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>

          <div style={{ width: '100%', height: 300, minHeight: 300 }}>
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
                  <ReferenceLine y={90} label={{ position: 'top', value: `Goal: ${profile ? Math.round(profile.base_population * 0.01 * 0.90).toLocaleString() : 0} (>90%)`, fill: '#6366f1', fontSize: 10, fontWeight: 'bold' }} stroke="#6366f1" strokeDasharray="3 3" />
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
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-hpv-purple-soft/50 rounded flex items-center justify-center text-hpv-purple shrink-0">i</div>
              <span>Run chart shows cumulative progress of line listing and vaccination against the target goal over time.</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 font-bold shrink-0">
              <span className="w-4 h-4 bg-emerald-100 rounded flex items-center justify-center text-emerald-600">↑</span>
              <span>Higher is better</span>
            </div>
          </div>
        </div>

      </main>

      <footer className="w-full text-center py-2 text-xs text-slate-400 px-4 space-y-1 shrink-0 bg-white border-t border-slate-200 mt-auto">
        <div className="font-medium text-[11px] sm:text-[10px]">HPV Vaccination Program • Version: 1.0 • UK 2026</div>
        <div className="flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
          <span className="text-[11px] sm:text-xs font-semibold text-slate-400">Powered by:</span>
          <img src="/impactcode.png" alt="ImpactCode" className="h-4 object-contain" />
        </div>
      </footer>
    </div>
  );
};
