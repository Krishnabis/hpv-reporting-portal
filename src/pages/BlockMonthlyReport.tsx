import React, { useState } from 'react';
import { ArrowLeft, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { BlockShell, useBlock } from '../components/BlockShell';

const StockContent: React.FC = () => {
  const { blockId } = useBlock();
  const [reportMonth, setReportMonth] = useState('');
  const [ccpStatusList, setCcpStatusList] = useState<any[]>([]);
  const [selectedCcp, setSelectedCcp] = useState<any>(null);
  const [qty, setQty] = useState('');
  const [remarks, setRemarks] = useState('');
  const [fetchingCcps, setFetchingCcps] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockMsg, setStockMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);

  const fetchCcps = async (month: string) => {
    if (!month || !blockId) return;
    setFetchingCcps(true); setStockMsg(null);
    try {
      const res = await fetch(`/api/vaccine/monthly-report/status?month=${month}&blockId=${blockId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCcpStatusList(data.ccps || []);
    } catch (err: any) { setStockMsg({ type: 'error', text: err.message }); setCcpStatusList([]); }
    setFetchingCcps(false);
  };

  const handleSubmitStock = async () => {
    if (!qty) return;
    setStockLoading(true); setStockMsg(null);
    try {
      const res = await fetch('/api/vaccine/monthly-report/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: reportMonth, blockId, facility_id: selectedCcp.id, facility_name: selectedCcp.facility_name, quantity: Number(qty), handler_name: selectedCcp.name_of_unit_incharge, handler_mobile: selectedCcp.contact_number, remarks })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setStockMsg({ type: 'success', text: `Submitted balance for ${selectedCcp.facility_name}` });
      setSelectedCcp(null); setQty(''); setRemarks('');
      fetchCcps(reportMonth);
    } catch (err: any) { setStockMsg({ type: 'error', text: err.message }); }
    setStockLoading(false);
  };

  return (
    <div className="space-y-3">
      {/* Page title */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-extrabold text-slate-900">HPV Vaccine Month-End Stock Report</h2>
          <div className="relative">
            <button onMouseEnter={() => setShowInfoTooltip(true)} onMouseLeave={() => setShowInfoTooltip(false)} className="text-slate-400 hover:text-hpv-purple transition-colors">
              <Info className="w-3.5 h-3.5" />
            </button>
            {showInfoTooltip && (
              <div className="absolute bottom-full left-0 mb-1.5 w-72 bg-slate-800 text-white text-[9px] font-medium rounded-xl px-3 py-2 shadow-xl z-50 leading-relaxed">
                The Facility (Reporting) Manager should collect the month-end HPV vaccine stock balance from all Cold Chain Points and submit the consolidated report by the 5th of every month.
                <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-800" />
              </div>
            )}
          </div>
        </div>
        <p className="text-[10px] text-amber-600 font-semibold mt-1">Please submit this report by the 5th of every month.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        {!selectedCcp ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm mb-1">Select Month</h3>
              <p className="text-slate-500 text-xs mb-3">Choose a month to view and submit CCP stock balances</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <input type="month" value={reportMonth} onChange={e => { setReportMonth(e.target.value); if (e.target.value) fetchCcps(e.target.value); }}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 font-medium bg-slate-50"
                />
                <button onClick={() => fetchCcps(reportMonth)} disabled={!reportMonth || fetchingCcps} className="px-5 py-2 gradient-header text-white rounded-xl text-xs font-bold hover:shadow-md transition-all disabled:opacity-50 shadow-sm">
                  {fetchingCcps ? 'Loading...' : 'Fetch Facilities'}
                </button>
              </div>
            </div>

            {stockMsg && (
              <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${stockMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                {stockMsg.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {stockMsg.text}
              </div>
            )}

            {reportMonth && ccpStatusList.length > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-2.5 text-[10px] font-bold text-slate-600 uppercase">Facility</th>
                      <th className="px-4 py-2.5 text-[10px] font-bold text-slate-600 uppercase hidden sm:table-cell">Manager</th>
                      <th className="px-4 py-2.5 text-[10px] font-bold text-slate-600 uppercase">Status</th>
                      <th className="px-4 py-2.5 text-[10px] font-bold text-slate-600 uppercase text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ccpStatusList.map((ccp: any) => (
                      <tr key={ccp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5 text-xs font-bold text-slate-800">{ccp.facility_name}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600 hidden sm:table-cell">{ccp.name_of_unit_incharge || 'N/A'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${ccp.status === 'Entered' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {ccp.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => { setSelectedCcp(ccp); setQty(''); setRemarks(''); }}
                            className="px-3 py-1.5 text-[10px] font-bold text-hpv-purple bg-hpv-purple-soft/50 hover:bg-hpv-purple-soft rounded-lg transition-colors border border-hpv-purple/20">
                            Submit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {reportMonth && ccpStatusList.length === 0 && !fetchingCcps && (
              <div className="p-8 text-center text-slate-500 text-sm bg-slate-50 rounded-xl border border-slate-200 border-dashed">No CCPs found for this block.</div>
            )}
          </div>
        ) : (
          <div className="max-w-xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button onClick={() => setSelectedCcp(null)} className="text-xs font-bold text-hpv-purple flex items-center gap-1.5 bg-hpv-purple-soft/30 px-3 py-1.5 rounded-lg w-fit transition-colors hover:bg-hpv-purple-soft">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to List
            </button>
            <div className="bg-hpv-purple-soft/30 p-3 rounded-xl border border-hpv-purple/20">
              <h4 className="font-extrabold text-base text-slate-800">{selectedCcp.facility_name}</h4>
              <p className="text-xs font-bold text-hpv-purple mt-0.5">
                {new Date(reportMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">CCP Handler</p>
                <p className="text-xs font-bold text-slate-800">{selectedCcp.name_of_unit_incharge || '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Mobile</p>
                <p className="text-xs font-bold text-slate-800">{selectedCcp.contact_number || '—'}</p>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-700 block mb-1 uppercase tracking-wide">Physical Vaccine Doses Available *</label>
              <p className="text-[9px] text-slate-400 mb-1.5">Enter physical vaccine doses available on the last day of the month (evening count).</p>
              <input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} placeholder="Enter dose count"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-base font-bold text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-hpv-purple/50 bg-slate-50 hover:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-700 block mb-1 uppercase tracking-wide">Remarks</label>
              <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} placeholder="Any discrepancies or notes..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-hpv-purple/50 bg-slate-50 resize-none"
              />
            </div>
            {stockMsg && (
              <div className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${stockMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                {stockMsg.type === 'error' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                {stockMsg.text}
              </div>
            )}
            <button onClick={handleSubmitStock} disabled={stockLoading || !qty}
              className="w-full py-3 gradient-header text-white rounded-xl text-sm font-extrabold hover:shadow-lg transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2">
              {stockLoading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</> : 'Submit Month End Balance'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const BlockMonthlyReport: React.FC = () => (
  <BlockShell currentPage="stock">
    <StockContent />
  </BlockShell>
);
