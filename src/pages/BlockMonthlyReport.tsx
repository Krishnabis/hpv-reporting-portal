import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { X, ArrowLeft, Building2 } from 'lucide-react';

export const BlockMonthlyReport: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const blockId = searchParams.get('blockId');

  const [reportMonth, setReportMonth] = useState('');
  const [ccpStatusList, setCcpStatusList] = useState<any[]>([]);
  const [selectedCcp, setSelectedCcp] = useState<any>(null);
  const [monthlyReportBatch, setMonthlyReportBatch] = useState('');
  const [monthlyReportQty, setMonthlyReportQty] = useState('');
  const [monthlyReportRemarks, setMonthlyReportRemarks] = useState('');
  const [fetchingCcpStatus, setFetchingCcpStatus] = useState(false);
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockMsg, setStockMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  useEffect(() => {
    if (!blockId) {
      navigate('/');
      return;
    }
    const token = localStorage.getItem(`hpv_block_token_${blockId}`) || sessionStorage.getItem(`hpv_block_token_${blockId}`);
    if (!token) {
      navigate('/');
      return;
    }
  }, [blockId, navigate]);

  const fetchBatches = (level?: string) => {
    let url = '/api/vaccine/batches';
    if (level) url += `?level=${level}`;
    fetch(url)
      .then(res => res.json())
      .then(data => setAvailableBatches(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  };

  const fetchBlockMonthlyReport = async (month: string) => {
    if (!month || !blockId) return;
    setFetchingCcpStatus(true);
    setStockMsg(null);
    try {
      const res = await fetch(`/api/vaccine/monthly-report/status?month=${month}&blockId=${blockId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch CCP status');
      setCcpStatusList(data.ccps || []);
    } catch (err: any) {
      setStockMsg({ type: 'error', text: err.message });
      setCcpStatusList([]);
    }
    setFetchingCcpStatus(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(`/report?blockId=${blockId}`)}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-hpv-purple" />
              Monthly Report - CCPs
            </h1>
          </div>
          <img src="/headinglogo.png" alt="Logo" className="h-10 object-contain" />
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          {!selectedCcp ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Select Month</h3>
                <p className="text-slate-500 text-sm mb-4">Choose a month to view and submit CCP balances</p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <input 
                    type="month" 
                    value={reportMonth} 
                    onChange={e => {
                      setReportMonth(e.target.value);
                      if (e.target.value) fetchBlockMonthlyReport(e.target.value);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 font-medium bg-slate-50" 
                  />
                  <button 
                    onClick={() => fetchBlockMonthlyReport(reportMonth)}
                    disabled={!reportMonth || fetchingCcpStatus}
                    className="px-6 py-2.5 bg-pink-600 text-white rounded-xl text-sm font-bold hover:bg-pink-700 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {fetchingCcpStatus ? 'Loading...' : 'Fetch Facilities'}
                  </button>
                </div>
              </div>

              {stockMsg && (
                <div className={`p-4 rounded-xl border text-sm font-semibold ${stockMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                  {stockMsg.text}
                </div>
              )}

              {reportMonth && ccpStatusList.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm mt-6">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase">Facility Name</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase hidden sm:table-cell">Manager</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase">Status</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ccpStatusList.map((ccp: any) => (
                        <tr key={ccp.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-bold text-slate-800">{ccp.facility_name}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 hidden sm:table-cell">
                            {ccp.name_of_unit_incharge || 'N/A'}
                            <div className="text-xs text-slate-500 font-mono">{ccp.contact_number}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${ccp.status === 'Entered' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {ccp.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedCcp(ccp);
                                setMonthlyReportQty('');
                                setMonthlyReportRemarks('');
                                setMonthlyReportBatch('');
                                fetchBatches('3'); // fetch CCP level batches
                              }}
                              className="px-4 py-1.5 text-xs font-bold text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors border border-blue-200"
                            >
                              Submit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {reportMonth && ccpStatusList.length === 0 && !fetchingCcpStatus && (
                <div className="p-8 text-center text-slate-500 text-sm bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                  No CCPs found for this block matching the LGD code. Please check your data upload.
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-xl mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button onClick={() => setSelectedCcp(null)} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 mb-2 bg-blue-50 px-3 py-1.5 rounded-lg w-fit transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to List
              </button>
              
              <div className="bg-hpv-purple-soft/30 p-5 rounded-xl border border-hpv-purple/20">
                <h4 className="font-extrabold text-xl text-slate-800">{selectedCcp.facility_name}</h4>
                <p className="text-sm font-bold text-hpv-purple mt-1">
                  Report Month: {new Date(reportMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wide">Select Batch *</label>
                  <select 
                    value={monthlyReportBatch} 
                    onChange={e => setMonthlyReportBatch(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-hpv-purple/50 bg-slate-50 hover:bg-white transition-colors"
                  >
                    <option value="">-- Select a Batch --</option>
                    {availableBatches.map((b: any) => (
                      <option key={b.id} value={b.batch_no}>{b.batch_no} (System Qty: {b.quantity})</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wide">Physical Balance Count *</label>
                  <input 
                    type="number" min="0" 
                    value={monthlyReportQty} onChange={e => setMonthlyReportQty(e.target.value)} 
                    placeholder="Enter physical doses left"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-hpv-purple/50 bg-slate-50 hover:bg-white transition-colors" 
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wide">Handler Name</label>
                  <input 
                    type="text" id="handler_name" defaultValue={selectedCcp.name_of_unit_incharge}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-hpv-purple/50 bg-slate-50" 
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wide">Handler Mobile</label>
                  <input 
                    type="tel" id="handler_mobile" defaultValue={selectedCcp.contact_number}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-hpv-purple/50 bg-slate-50" 
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wide">Remarks</label>
                  <textarea 
                    value={monthlyReportRemarks} onChange={e => setMonthlyReportRemarks(e.target.value)} rows={3}
                    placeholder="Any discrepancies or notes..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-hpv-purple/50 bg-slate-50" 
                  />
                </div>
              </div>

              <button 
                disabled={stockLoading || !monthlyReportBatch || !monthlyReportQty}
                onClick={async () => {
                  setStockLoading(true); setStockMsg(null);
                  try {
                    const hName = (document.getElementById('handler_name') as HTMLInputElement).value;
                    const hMobile = (document.getElementById('handler_mobile') as HTMLInputElement).value;
                    
                    const res = await fetch('/api/vaccine/monthly-report/submit', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        month: reportMonth, blockId, facility_id: selectedCcp.id, facility_name: selectedCcp.facility_name,
                        batch_no: monthlyReportBatch, quantity: Number(monthlyReportQty), handler_name: hName, handler_mobile: hMobile, remarks: monthlyReportRemarks
                      })
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || 'Failed');
                    
                    setStockMsg({ type: 'success', text: `Successfully submitted balance for ${selectedCcp.facility_name}` });
                    setSelectedCcp(null);
                    fetchBlockMonthlyReport(reportMonth);
                  } catch (err: any) { setStockMsg({ type: 'error', text: err.message }); }
                  setStockLoading(false);
                }}
                className="w-full py-4 bg-hpv-purple text-white rounded-xl text-base font-extrabold hover:bg-hpv-purple-dark transition-all disabled:opacity-50 shadow-md hover:shadow-lg mt-4 flex items-center justify-center gap-2"
              >
                {stockLoading ? (
                  <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Submitting...</>
                ) : 'Submit Monthly Balance'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
