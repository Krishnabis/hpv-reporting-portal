import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Download, AlertCircle, Info, Building2, MapPin, Filter, Calendar, Clock, 
  FileText, RefreshCw, Maximize2, Minimize2, Search, ChevronDown, ChevronUp,
  Package, ArrowDownRight, ArrowUpRight, Percent, Trash2, Box, Layers,
  SlidersHorizontal, CheckCircle2, ArrowUpDown, Target, BarChart3, PieChart, Activity,
  Columns
} from 'lucide-react';

export interface LedgerTransactionRow {
  id: string | number;
  transaction_date: string;
  transaction_type: string;
  batch_no: string;
  manufacturer_name: string;
  expiry_date: string;
  transaction_quantity: number;
  from_ccl: string;
  to_ccl: string;
  from_ccl_id: string | null;
  to_ccl_id: string | null;
  remarks: string;
}

export interface CclSummaryRow {
  ccl_id: string;
  ccl_name: string;
  level: string;
  level_label: string;
  unit_type: string;
  total_in: number;
  total_out: number;
  balance: number;
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

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-IN');
}

const KpiCard: React.FC<{
  icon: React.ReactNode; label: string; value: string;
  subLabel?: string; subValue?: string; iconBg: string; valueColor?: string; loading?: boolean;
}> = ({ icon, label, value, subLabel, subValue, iconBg, valueColor = 'text-slate-900', loading }) => (
  <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-200 flex items-center gap-3 hover:shadow-md transition-shadow">
    {loading ? (
      <div className="animate-pulse flex items-center gap-3 w-full">
        <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
        <div className="flex flex-col gap-1.5 w-full">
          <div className="h-3 bg-slate-200 rounded w-1/2" />
          <div className="h-4 bg-slate-200 rounded w-3/4" />
        </div>
      </div>
    ) : (
      <>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg} shrink-0 [&>svg]:w-5 [&>svg]:h-5`}>
          {icon}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-600 truncate leading-tight">{label}</div>
          <div className={`text-lg font-extrabold leading-none mt-1 ${valueColor} truncate`}>{value}</div>
          {(subValue || subLabel) && (
            <>
              <div className="w-full h-px bg-slate-100 my-1.5" />
              <div className="text-[10px] font-bold leading-none truncate">
                {subValue && <span className="text-emerald-600">{subValue}</span>}
                {subValue && subLabel && <span className="text-slate-500 ml-1">{subLabel}</span>}
                {!subValue && subLabel && <span className="text-slate-400">{subLabel}</span>}
              </div>
            </>
          )}
        </div>
      </>
    )}
  </div>
);

export const VaccineStockLedger: React.FC<{
  adminUser?: any;
  districts?: DistrictItem[];
  states?: StateItem[];
}> = ({ adminUser, districts: initialDistricts = [], states: initialStates = [] }) => {
  const [transactions, setTransactions] = useState<LedgerTransactionRow[]>([]);
  const [cclSummary, setCclSummary] = useState<CclSummaryRow[]>([]);
  const [kpis, setKpis] = useState<any>({ totalExternalReceived: 0, totalStateBalance: 0, totalDistrictBalance: 0, totalIssuedToBlocks: 0 });
  const [isLive, setIsLive] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [searchCCL, setSearchCCL] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  
  const [showAdvanceSearch, setShowAdvanceSearch] = useState(false);
  const [showCclSummary, setShowCclSummary] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [showManufacturer, setShowManufacturer] = useState(true);
  const [showExpiry, setShowExpiry] = useState(true);
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [selectedState, setSelectedState] = useState(adminUser?.state_id ? String(adminUser.state_id) : 'All States');
  const [selectedDistrict, setSelectedDistrict] = useState(adminUser?.district_id ? String(initialDistricts.find(d => String(d.id) === String(adminUser.district_id))?.name || '') : 'All Districts');
  const [reportLevel, setReportLevel] = useState('District');
  const [transactionType, setTransactionType] = useState('All');

  useEffect(() => {
    fetchLedgerData();
  }, []);

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        state: selectedState,
        district: selectedDistrict,
        cclName: searchCCL,
        transactionType
      });

      const res = await fetch(`/api/admin/reports/stock-ledger?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.ok) {
        const json = await res.json();
        setTransactions(json.rows || []);
        setCclSummary(json.cclSummary || []);
        if (json.kpis) setKpis(json.kpis);
        setIsLive(true);
      }
    } catch (err) {
      console.error('Failed to fetch stock ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  // Quick Filter for the transaction table
  const filteredTransactions = useMemo(() => {
    if (!quickSearch) return transactions;
    const q = quickSearch.toLowerCase();
    return transactions.filter(t => 
      t.batch_no.toLowerCase().includes(q) || 
      t.from_ccl.toLowerCase().includes(q) || 
      t.to_ccl.toLowerCase().includes(q)
    );
  }, [transactions, quickSearch]);

  // Determine if we should show a running balance
  // (Only if the user explicitly searches for an exact CCL name)
  const matchedCcl = useMemo(() => {
    if (!quickSearch) return null;
    return cclSummary.find(c => c.ccl_name.toLowerCase() === quickSearch.toLowerCase().trim());
  }, [quickSearch, cclSummary]);

  // Compute Running Balance for the matched CCL
  const transactionsWithBalance = useMemo(() => {
    if (!matchedCcl) return filteredTransactions;
    let runningBal = 0;
    return filteredTransactions.map(t => {
       if (t.to_ccl_id === matchedCcl.ccl_id) runningBal += t.transaction_quantity;
       if (t.from_ccl_id === matchedCcl.ccl_id) runningBal -= t.transaction_quantity;
       return { ...t, computed_balance: runningBal };
    });
  }, [filteredTransactions, matchedCcl]);

  return (
    <div className={`flex flex-col h-full bg-slate-50/50 ${isExpanded ? 'fixed inset-0 z-50 bg-slate-50 overflow-y-auto' : ''}`}>
      <div className="flex-none bg-white border-b border-slate-200">
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-indigo-600" />
              Vaccine Stock Ledger
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              End-to-end trace of HPV vaccine movements and inventory balances.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isLive && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold">
                <AlertCircle className="w-3.5 h-3.5" /> Demo Data
              </div>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title={isExpanded ? "Exit Fullscreen" : "Fullscreen View"}
            >
              {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Global Filters */}
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm h-9">
              <div className="px-3 bg-slate-50 border-r border-slate-200 text-slate-500"><Calendar className="w-4 h-4" /></div>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-1.5 text-sm focus:outline-none" />
            </div>
            <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm h-9">
              <div className="px-3 bg-slate-50 border-r border-slate-200 text-slate-500"><Calendar className="w-4 h-4" /></div>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-1.5 text-sm focus:outline-none" />
            </div>
            
            <div className="relative">
              <select value={selectedState} onChange={e => setSelectedState(e.target.value)} disabled={!!adminUser?.state_id}
                className="appearance-none h-9 pl-3 pr-8 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm disabled:opacity-60">
                <option value="All States">All States</option>
                <option value="Uttarakhand">Uttarakhand</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)} disabled={!!adminUser?.district_id}
                className="appearance-none h-9 pl-3 pr-8 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm disabled:opacity-60">
                <option value="All Districts">All Districts</option>
                {initialDistricts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <button onClick={fetchLedgerData} disabled={loading}
              className="ml-auto flex items-center gap-2 px-4 h-9 bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold rounded-lg shadow-sm transition-colors disabled:opacity-70">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              Generate Ledger
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard 
            icon={<ArrowDownRight />} iconBg="bg-blue-100 text-blue-700" label="External Doses Received" 
            value={fmt(kpis.totalExternalReceived)} valueColor="text-blue-700" subLabel="Total entered the State" loading={loading}
          />
          <KpiCard 
            icon={<Building2 />} iconBg="bg-emerald-100 text-emerald-700" label="Doses at State Stores" 
            value={fmt(kpis.totalStateBalance)} valueColor="text-emerald-700" subLabel="Current L1 Balance" loading={loading}
          />
          <KpiCard 
            icon={<MapPin />} iconBg="bg-amber-100 text-amber-700" label="Doses at District Stores" 
            value={fmt(kpis.totalDistrictBalance)} valueColor="text-amber-700" subLabel="Current L2 Balance" loading={loading}
          />
          <KpiCard 
            icon={<ArrowUpRight />} iconBg="bg-purple-100 text-purple-700" label="Dispatched to Blocks" 
            value={fmt(kpis.totalIssuedToBlocks)} valueColor="text-purple-700" subLabel="Total sent to L3" loading={loading}
          />
        </div>



        {/* Transaction History Log */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-indigo-600" />
              <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">Transaction History Log</h2>
              <span className="text-xs text-slate-500 font-medium ml-2">({filteredTransactions.length} Records)</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search Batch, Source, Dest..."
                  value={quickSearch}
                  onChange={e => setQuickSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 h-9 w-64 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
                />
              </div>

              {matchedCcl && (
                <div className="px-3 py-1.5 h-9 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold flex items-center shadow-sm">
                  Showing Running Balance for: {matchedCcl.ccl_name}
                </div>
              )}

              <div className="relative" ref={colMenuRef}>
                <button 
                  onClick={() => setShowColMenu(!showColMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 h-9 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 shadow-sm"
                >
                  <Columns className="w-4 h-4" /> Columns
                </button>
                {showColMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50">
                    <label className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer text-sm font-semibold text-slate-700">
                      <input type="checkbox" checked={showManufacturer} onChange={e => setShowManufacturer(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                      Manufacturer
                    </label>
                    <label className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer text-sm font-semibold text-slate-700">
                      <input type="checkbox" checked={showExpiry} onChange={e => setShowExpiry(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                      Expiry Date
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-white rounded-b-xl border-t border-slate-200">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead className="bg-[#1e3a8a] text-white sticky top-0 z-10">
                <tr className="text-left text-[11px] font-medium tracking-wide">
                  <th className="px-3 py-3 border-r border-blue-800/50">CCL Name</th>
                  <th className="px-3 py-3 border-r border-blue-800/50">
                    <div className="flex items-center justify-between">Transaction Date <ArrowUpDown className="w-3 h-3 text-blue-300 ml-1" /></div>
                  </th>
                  <th className="px-3 py-3 border-r border-blue-800/50">
                    <div className="flex items-center justify-between">Transaction Type <ArrowUpDown className="w-3 h-3 text-blue-300 ml-1" /></div>
                  </th>
                  <th className="px-3 py-3 border-r border-blue-800/50">Batch/Lot Number</th>
                  {showManufacturer && <th className="px-3 py-3 border-r border-blue-800/50">Manufacturer Name</th>}
                  {showExpiry && (
                    <th className="px-3 py-3 border-r border-blue-800/50">
                      <div className="flex items-center justify-between">Expiry <ArrowUpDown className="w-3 h-3 text-blue-300 ml-1" /></div>
                    </th>
                  )}
                  <th className="px-3 py-3 border-r border-blue-800/50 text-right">Transaction Quantity (Doses)</th>
                  <th className="px-3 py-3 border-r border-blue-800/50">
                    <div className="flex items-center justify-between">Transaction Facility Name <ArrowUpDown className="w-3 h-3 text-blue-300 ml-1" /></div>
                  </th>
                  <th className="px-3 py-3 border-r border-blue-800/50 text-right">Physical Stock Count (Doses)</th>
                  <th className="px-3 py-3 border-r border-blue-800/50 text-right">
                    <div className="flex items-center justify-end">Wastage / Adjustment (Doses) <ArrowUpDown className="w-3 h-3 text-blue-300 ml-1" /></div>
                  </th>
                  <th className="px-3 py-3 border-r border-blue-800/50 text-right">
                    <div className="flex items-center justify-end">Closing Stock Balance (Doses) <ArrowUpDown className="w-3 h-3 text-blue-300 ml-1" /></div>
                  </th>
                  <th className="px-3 py-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {transactionsWithBalance.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-12 text-center text-slate-500 border-x border-b border-slate-200">
                      <div className="flex flex-col items-center justify-center">
                        <FileText className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="text-base font-bold text-slate-700">No transactions found</p>
                        <p className="text-sm mt-1">Try adjusting your filters or search terms.</p>
                      </div>
                    </td>
                  </tr>
                ) : transactionsWithBalance.map((row: any) => {
                  let cclName = row.from_ccl;
                  let facilityName = row.to_ccl;
                  let txType = row.transaction_type;
                  
                  if (matchedCcl) {
                    if (row.to_ccl_id === matchedCcl.ccl_id) {
                        cclName = row.to_ccl;
                        facilityName = row.from_ccl;
                        txType = 'Receive';
                    } else if (row.from_ccl_id === matchedCcl.ccl_id) {
                        cclName = row.from_ccl;
                        facilityName = row.to_ccl;
                        txType = 'Issue';
                    }
                  } else {
                    if (row.transaction_type === 'Receive' || !row.from_ccl_id) {
                        cclName = row.to_ccl;
                        facilityName = row.from_ccl;
                    } else {
                        cclName = row.from_ccl;
                        facilityName = row.to_ccl;
                    }
                  }

                  return (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-3 py-2.5 text-[11px] font-bold text-slate-700 border-x border-slate-200 whitespace-nowrap">
                        {cclName}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-semibold text-slate-600 border-r border-slate-200 whitespace-nowrap">
                        {new Date(row.transaction_date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-200">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide ${
                          txType === 'Receive' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {txType}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-bold text-indigo-700 border-r border-slate-200 whitespace-nowrap">
                        {row.batch_no}
                      </td>
                      {showManufacturer && (
                        <td className="px-3 py-2.5 text-[11px] font-medium text-slate-500 border-r border-slate-200">
                          {row.manufacturer_name}
                        </td>
                      )}
                      {showExpiry && (
                        <td className="px-3 py-2.5 text-[11px] font-medium text-slate-500 border-r border-slate-200 whitespace-nowrap">
                          {row.expiry_date && row.expiry_date !== '—' ? new Date(row.expiry_date).toLocaleDateString('en-GB') : '—'}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-[11px] text-right border-r border-slate-200">
                        <span className={`font-bold ${
                          txType === 'Receive' ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {txType === 'Receive' ? '+' : ''}{fmt(row.transaction_quantity)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-semibold text-slate-600 border-r border-slate-200 whitespace-nowrap">
                        {facilityName}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-right font-medium text-slate-400 border-r border-slate-200">
                        —
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-right font-medium text-slate-400 border-r border-slate-200">
                        —
                      </td>
                      <td className={`px-3 py-2.5 text-[11px] text-right border-r border-slate-200 ${matchedCcl ? 'bg-indigo-50/30' : ''}`}>
                        {matchedCcl ? (
                          <span className={`font-extrabold ${
                            row.computed_balance > 0 ? 'text-emerald-700' : row.computed_balance < 0 ? 'text-rose-700' : 'text-slate-500'
                          }`}>
                            {fmt(row.computed_balance)}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-medium">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] font-medium text-slate-500 italic max-w-[150px] truncate border-r border-slate-200" title={row.remarks}>
                        {row.remarks}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
