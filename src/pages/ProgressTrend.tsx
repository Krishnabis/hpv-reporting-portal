import React, { useState, useMemo } from 'react';
import { Download, RotateCcw, Calendar as CalendarIcon, Activity } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend, LabelList
} from 'recharts';
import { BlockShell, useBlock } from '../components/BlockShell';
import { useSearchParams } from 'react-router-dom';

interface ReportData {
  id: string;
  reporting_date: string;
  line_list_count: number;
  beneficiaries_vaccinated: number;
}

const TrendContent: React.FC = () => {
  const { blockId, profile } = useBlock();
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loadedBlockId, setLoadedBlockId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewBy, setViewBy] = useState('daily');

  // Fetch reports when blockId is available
  React.useEffect(() => {
    if (!blockId || blockId === loadedBlockId) return;
    fetch(`/api/reports/block/${blockId}`)
      .then(r => r.json())
      .then(data => { if (!data.error) setReports(data); setLoadedBlockId(blockId); })
      .catch(console.error);
  }, [blockId, loadedBlockId]);

  const chartData = useMemo(() => {
    if (!profile || profile.base_population === 0 || reports.length === 0) return [];
    const target = Math.round(profile.base_population * 0.01);
    let filtered = [...reports];
    if (startDate) filtered = filtered.filter(r => r.reporting_date >= startDate);
    if (endDate) filtered = filtered.filter(r => r.reporting_date <= endDate);
    filtered.sort((a, b) => a.reporting_date.localeCompare(b.reporting_date));

    const groups: Record<string, ReportData[]> = {};
    filtered.forEach(r => {
      const d = new Date(r.reporting_date);
      let key = '';
      if (viewBy === 'daily') {
        key = `${d.getUTCDate().toString().padStart(2, '0')}-${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}-${d.getUTCFullYear()}`;
      } else if (viewBy === 'weekly') {
        const dc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dn = dc.getUTCDay() || 7; dc.setUTCDate(dc.getUTCDate() + 4 - dn);
        const ys = new Date(Date.UTC(dc.getUTCFullYear(), 0, 1));
        key = `W${Math.ceil((((dc.getTime() - ys.getTime()) / 86400000) + 1) / 7).toString().padStart(2, '0')} ${dc.getUTCFullYear()}`;
      } else if (viewBy === 'biweekly') {
        const dc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dn = dc.getUTCDay() || 7; dc.setUTCDate(dc.getUTCDate() + 4 - dn);
        const ys = new Date(Date.UTC(dc.getUTCFullYear(), 0, 1));
        const wk = Math.ceil((((dc.getTime() - ys.getTime()) / 86400000) + 1) / 7);
        key = `BiW${Math.ceil(wk / 2).toString().padStart(2, '0')} ${dc.getUTCFullYear()}`;
      } else if (viewBy === 'monthly') {
        key = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      } else if (viewBy === 'quarterly') {
        key = `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    return Object.entries(groups)
      .map(([key, groupReports]) => {
        const last = groupReports[groupReports.length - 1];
        return {
          dateLabel: key, rawDate: last.reporting_date,
          lineListedPct: Math.round((last.line_list_count / target) * 100),
          vaccinatedPct: Math.round((last.beneficiaries_vaccinated / target) * 100),
          rawLineList: last.line_list_count, rawVaccinated: last.beneficiaries_vaccinated
        };
      })
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  }, [reports, profile, startDate, endDate, viewBy]);

  const latest = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const target = profile ? Math.round(profile.base_population * 0.01) : 0;

  const handleDownload = () => {
    if (!chartData.length) return;
    const headers = ['Date', 'Line Listed Count', 'Line Listed %', 'Vaccinated Count', 'Vaccinated %'];
    const csv = [headers.join(','), ...chartData.map(r => [`"${r.dateLabel}"`, r.rawLineList, r.lineListedPct, r.rawVaccinated, r.vaccinatedPct].join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'Progress_Trend.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="space-y-3">
      {/* Page header */}
      <div className="flex items-center gap-2 px-1">
        <Activity className="w-5 h-5 text-hpv-purple" />
        <h2 className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-hpv-purple to-hpv-pink tracking-tight uppercase">Progress Trend</h2>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-2">
          {[{ label: 'Date Range (Start)', val: startDate, set: setStartDate }, { label: 'Date Range (End)', val: endDate, set: setEndDate }].map(f => (
            <div key={f.label} className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{f.label}</label>
              <div className="relative">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input type="date" value={f.val} onChange={e => f.set(e.target.value)}
                  className="pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-hpv-purple/20" />
              </div>
            </div>
          ))}
          <button onClick={() => { setStartDate(''); setEndDate(''); setViewBy('daily'); }}
            className="px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors self-end">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
        <button onClick={handleDownload} disabled={!chartData.length}
          className="px-4 py-1.5 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-hpv-purple hover:bg-hpv-purple-dark rounded-lg transition-colors disabled:opacity-50 self-end">
          <Download className="w-3.5 h-3.5" /> Download Data
        </button>
      </div>

      {/* Summary metric boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Total Population', val: profile ? profile.base_population.toLocaleString('en-IN') : '0', sub: `HPV Target (1%): ${target.toLocaleString('en-IN')}`, border: 'slate' },
          { label: 'HPV Vaccination Goal', val: '>90%', sub: `Goal: >${profile ? Math.round(target * 0.90).toLocaleString('en-IN') : 0}`, border: 'hpv-purple' },
          { label: 'Eligible Girls Line Listed', val: `${latest?.lineListedPct || 0}%`, sub: `Count: ${(latest?.rawLineList || 0).toLocaleString('en-IN')}`, border: 'emerald-500' },
          { label: 'Eligible Girls Vaccinated', val: `${latest?.vaccinatedPct || 0}%`, sub: `Count: ${(latest?.rawVaccinated || 0).toLocaleString('en-IN')}`, border: 'pink-500' },
        ].map(box => (
          <div key={box.label} className={`bg-white border-l-4 border-l-${box.border} rounded-xl p-2.5 border-y border-r border-slate-200 shadow-sm flex flex-col justify-center`}>
            <span className="text-[9px] uppercase font-bold text-slate-500 leading-tight">{box.label}</span>
            <span className="text-lg font-extrabold font-mono text-slate-900 leading-tight">{box.val}</span>
            <span className="text-[9px] font-semibold text-slate-500">{box.sub}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm" style={{ height: 320 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Run Chart – Cumulative Progress Over Time (%)</h3>
            <div tabIndex={0} className="relative group flex items-center justify-center outline-none">
              <div className="w-4 h-4 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-bold cursor-help transition-colors">i</div>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all w-[240px] bg-slate-800 text-white text-[10px] font-bold py-2 px-3 rounded-lg shadow-xl z-50 text-center">
                Run chart shows cumulative progress of line listing and vaccination against the target goal over time.
                <span className="text-emerald-400 mt-1 block">↑ Higher is better</span>
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">View By</label>
            <select value={viewBy} onChange={e => setViewBy(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-hpv-purple">
              {['daily', 'weekly', 'biweekly', 'monthly', 'quarterly'].map(v => (
                <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ height: 250 }}>
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-500 font-semibold text-sm">No reporting data found.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 9, fill: '#64748b' }} tickMargin={8} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${v}%`} width={36} />
                <Tooltip
                  formatter={(value: number, name: string, props: any) =>
                    props.dataKey === 'vaccinatedPct' ? [`${value}% (${props.payload.rawVaccinated.toLocaleString('en-IN')})`, ''] : [`${value}%`, '']
                  }
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}
                />
                <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingTop: '8px' }} />
                <ReferenceLine y={90} label={{ position: 'top', value: `Goal: ${target ? Math.round(target * 0.9).toLocaleString('en-IN') : 0} (>90%)`, fill: '#6366f1', fontSize: 9, fontWeight: 'bold' }} stroke="#6366f1" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="lineListedPct" name="Eligible Girls % Line Listed" stroke="#10b981" strokeWidth={2} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="vaccinatedPct" name="Eligible Girls Vaccinated %" stroke="#ec4899" strokeWidth={2} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 5 }}>
                  <LabelList dataKey="vaccinatedPct" content={(props: any) => {
                    const { x, y, value, index } = props;
                    if (!chartData[index]) return null;
                    return <text x={x} y={y - 10} fill="#ec4899" fontSize={9} fontWeight="bold" textAnchor="middle">{`${value}% (${chartData[index].rawVaccinated.toLocaleString('en-IN')})`}</text>;
                  }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export const ProgressTrend: React.FC = () => (
  <BlockShell currentPage="trends">
    <TrendContent />
  </BlockShell>
);
