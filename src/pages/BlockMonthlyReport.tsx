import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { X, ArrowLeft, Building2, Settings, ChevronDown, ClipboardList, BarChart2, Package, MessageSquare, TrendingUp, Info, CheckCircle2, AlertTriangle } from 'lucide-react';

export const BlockMonthlyReport: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const blockId = searchParams.get('blockId');

  const [reportMonth, setReportMonth] = useState('');
  const [ccpStatusList, setCcpStatusList] = useState<any[]>([]);
  const [selectedCcp, setSelectedCcp] = useState<any>(null);
  const [monthlyReportQty, setMonthlyReportQty] = useState('');
  const [monthlyReportRemarks, setMonthlyReportRemarks] = useState('');
  const [fetchingCcpStatus, setFetchingCcpStatus] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockMsg, setStockMsg] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [showNavDropdown, setShowNavDropdown] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const navDropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navDropdownRef.current && !navDropdownRef.current.contains(e.target as Node)) {
        setShowNavDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  const navItems = [
    { label: 'Daily Report', icon: ClipboardList, path: `/report?blockId=${blockId}`, active: false },
    { label: 'Monthly Due List Report', icon: BarChart2, path: `/due-list-report?blockId=${blockId}`, active: false },
    { label: 'HPV Vaccine Stock Balance Report', icon: Package, path: `/monthly-report?blockId=${blockId}`, active: true },
    { label: 'Trends', icon: TrendingUp, path: `/progress-trend?blockId=${blockId}`, active: false },
    { label: 'Feedback', icon: MessageSquare, path: `/feedback?blockId=${blockId}`, active: false },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between min-h-[60px]">
          <div className="cursor-pointer" onClick={() => navigate('/')}>
            <img src="/headinglogo.png" alt="Logo" className="h-14 object-contain hover:opacity-80 transition-opacity" />
          </div>
          <div className="flex items-center gap-2">
            {/* Nav Dropdown */}
            <div className="relative" ref={navDropdownRef}>
              <button
                onClick={() => setShowNavDropdown(!showNavDropdown)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-hpv-purple-soft/40 hover:bg-hpv-purple-soft text-hpv-purple-dark text-xs font-bold transition-colors border border-hpv-purple/20"
              >
                <Package className="w-3.5 h-3.5" />
                Stock Balance
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showNavDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showNavDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  {navItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => { setShowNavDropdown(false); navigate(item.path); }}
                      className={`w-full text-left px-4 py-3 text-sm font-semibold flex items-center gap-3 transition-colors border-b border-slate-100 last:border-0
                        ${item.active ? 'bg-hpv-purple-soft/50 text-hpv-purple' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <item.icon className={`w-4 h-4 shrink-0 ${item.active ? 'text-hpv-purple' : 'text-slate-400'}`} />
                      {item.label}
                      {item.active && <span className="ml-auto text-[9px] bg-hpv-purple text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Current</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Settings */}
            <div className="relative">
              <button onClick={() => setShowSettingsDropdown(!showSettingsDropdown)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              {showSettingsDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-50">
                  <button onClick={() => { setShowSettingsDropdown(false); navigate(`/report?blockId=${blockId}`); }} className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">Change Passcode</button>
                  <button onClick={() => { localStorage.removeItem(`hpv_block_token_${blockId}`); sessionStorage.removeItem(`hpv_block_token_${blockId}`); navigate('/'); }} className="w-full text-left px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors border-t border-slate-100">Logout</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full p-4 sm:p-5 space-y-4">
        {/* Page title */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-slate-900">HPV Vaccine Month-End Stock Report</h1>
                <div className="relative">
                  <button
                    onMouseEnter={() => setShowInfoTooltip(true)}
                    onMouseLeave={() => setShowInfoTooltip(false)}
                    onClick={() => setShowInfoTooltip(!showInfoTooltip)}
                    className="text-slate-400 hover:text-hpv-purple transition-colors"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  {showInfoTooltip && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-slate-800 text-white text-[10px] font-medium rounded-xl px-3 py-2 shadow-xl z-50 leading-relaxed">
                      The Facility (Reporting) Manager should collect the month-end HPV vaccine stock balance from all listed Cold Chain Points and submit the consolidated report by the 5th of every month. Stock balance should reflect the physical stock available as on the last date of the reporting month.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-amber-600 font-semibold mt-1">Please submit this report by the 5th of every month.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          {!selectedCcp ? (
            <div className="space-y-5">
              <div>
                <h3 className="font-bold text-slate-800 text-base mb-1">Select Month</h3>
                <p className="text-slate-500 text-sm mb-4">Choose a month to view and submit CCP stock balances</p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <input 
                    type="month" 
                    value={reportMonth} 
                    onChange={e => {
                      setReportMonth(e.target.value);
                      if (e.target.value) fetchBlockMonthlyReport(e.target.value);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 font-medium bg-slate-50" 
                  />
                  <button 
                    onClick={() => fetchBlockMonthlyReport(reportMonth)}
                    disabled={!reportMonth || fetchingCcpStatus}
                    className="px-6 py-2.5 gradient-header text-white rounded-xl text-sm font-bold hover:shadow-md transition-all disabled:opacity-50 shadow-sm"
                  >
                    {fetchingCcpStatus ? 'Loading...' : 'Fetch Facilities'}
                  </button>
                </div>
              </div>

              {stockMsg && (
                <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center gap-2 ${stockMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                  {stockMsg.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  {stockMsg.text}
                </div>
              )}

              {reportMonth && ccpStatusList.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
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
                              }}
                              className="px-4 py-1.5 text-xs font-bold text-hpv-purple bg-hpv-purple-soft/50 hover:bg-hpv-purple-soft rounded-lg transition-colors border border-hpv-purple/20"
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
                  No CCPs found for this block. Please check your data upload.
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-xl mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button onClick={() => setSelectedCcp(null)} className="text-sm font-bold text-hpv-purple hover:text-hpv-purple-dark flex items-center gap-1.5 mb-2 bg-hpv-purple-soft/30 px-3 py-1.5 rounded-lg w-fit transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to List
              </button>
              
              <div className="bg-hpv-purple-soft/30 p-4 rounded-xl border border-hpv-purple/20">
                <h4 className="font-extrabold text-lg text-slate-800">{selectedCcp.facility_name}</h4>
                <p className="text-sm font-bold text-hpv-purple mt-1">
                  Report Month: {new Date(reportMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-slate-500 mt-1">Cold Chain Handler Info fetched from past records</p>
              </div>

              {/* CCP Handler Info (auto-fetched) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">CCP Handler Name</p>
                  <p className="text-sm font-bold text-slate-800">{selectedCcp.name_of_unit_incharge || '—'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">CCP Handler Mobile</p>
                  <p className="text-sm font-bold text-slate-800">{selectedCcp.contact_number || '—'}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wide">
                  Physical Vaccine Doses Available *
                </label>
                <p className="text-[10px] text-slate-400 mb-2">Enter physical vaccine doses available on the last day of the month (evening count).</p>
                <input 
                  type="number" 
                  min="0" 
                  value={monthlyReportQty} 
                  onChange={e => setMonthlyReportQty(e.target.value)} 
                  placeholder="Enter dose count"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base font-bold text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-hpv-purple/50 bg-slate-50 hover:bg-white transition-colors" 
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 uppercase tracking-wide">Remarks</label>
                <textarea 
                  value={monthlyReportRemarks} 
                  onChange={e => setMonthlyReportRemarks(e.target.value)} 
                  rows={3}
                  placeholder="Any discrepancies or notes..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-hpv-purple/50 bg-slate-50 resize-none" 
                />
              </div>

              <button 
                disabled={stockLoading || !monthlyReportQty}
                onClick={async () => {
                  setStockLoading(true); setStockMsg(null);
                  try {
                    const res = await fetch('/api/vaccine/monthly-report/submit', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        month: reportMonth, blockId, facility_id: selectedCcp.id, facility_name: selectedCcp.facility_name,
                        quantity: Number(monthlyReportQty), 
                        handler_name: selectedCcp.name_of_unit_incharge, 
                        handler_mobile: selectedCcp.contact_number, 
                        remarks: monthlyReportRemarks
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
                className="w-full py-4 gradient-header text-white rounded-xl text-base font-extrabold hover:shadow-lg transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
              >
                {stockLoading ? (
                  <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Submitting...</>
                ) : 'Submit Month End Balance'}
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="max-w-3xl mx-auto w-full text-center py-4 text-xs text-slate-400 px-4 space-y-2">
        <div className="font-medium text-[11px]">HPV Vaccination Monitoring Portal • Version: 1.0 • UK 2026</div>
        <div className="flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
          <span className="text-[11px] font-semibold text-slate-400">Powered by:</span>
          <img src="/impactcode.png" alt="ImpactCode" className="h-4 object-contain" />
        </div>
      </footer>
    </div>
  );
};
