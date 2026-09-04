import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Download, AlertCircle, Info, Building2, MapPin, Filter, Calendar, Clock, 
  FileText, RefreshCw, Maximize2, Minimize2, Search, ChevronDown, ChevronUp,
  Package, ArrowDownRight, ArrowUpRight, Percent, Trash2, Box, Layers,
  SlidersHorizontal, CheckCircle2, ArrowUpDown, Target, BarChart3, PieChart, Activity,
  Columns, ChevronLeft, ChevronRight, ArrowUp, ArrowDown
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
  const [currentPage, setCurrentPage] = useState(1);
  
  const [showAdvanceSearch, setShowAdvanceSearch] = useState(false);
  const [showCclSummary, setShowCclSummary] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const [showManufacturer, setShowManufacturer] = useState(true);
  const [showExpiry, setShowExpiry] = useState(true);
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'transaction_date', direction: 'desc' });

  // Filters
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [selectedState, setSelectedState] = useState(adminUser?.state_id ? String(adminUser.state_id) : 'All States');
  const [selectedDistrict, setSelectedDistrict] = useState(adminUser?.district_id ? (adminUser.district_name || String(initialDistricts.find(d => String(d.id) === String(adminUser.district_id))?.name || '')) : 'All Districts');
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

  // Sort chronologically (oldest first) and compute Running Balance for the perspective store
  const transactionsWithBalance = useMemo(() => {
    // 1. Sort chronological (oldest first)
    const sorted = [...filteredTransactions].sort((a, b) => 
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );

    // 2. We need to track the balance for every CCL ID dynamically.
    const storeBalances: Record<string, number> = {};

    return sorted.map(t => {
      // First, update both stores' balances independently
      if (t.to_ccl_id) {
         storeBalances[t.to_ccl_id] = (storeBalances[t.to_ccl_id] || 0) + t.transaction_quantity;
      }
      if (t.from_ccl_id) {
         storeBalances[t.from_ccl_id] = (storeBalances[t.from_ccl_id] || 0) - t.transaction_quantity;
      }
      
      // Determine which store's perspective this row is showing
      let primaryCclId;
      if (matchedCcl) {
         primaryCclId = matchedCcl.ccl_id;
      } else {
         if (t.transaction_type === 'Receive' || !t.from_ccl_id) {
             primaryCclId = t.to_ccl_id;
         } else {
             primaryCclId = t.from_ccl_id;
         }
      }
      
      // Return the row with the balance of the primary store AFTER this transaction
      return { 
        ...t, 
        computed_balance: storeBalances[primaryCclId] || 0
      };
    });
  }, [filteredTransactions, matchedCcl]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const renderSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="inline w-3 h-3 ml-1 text-white/30" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1 text-white" /> : <ArrowDown className="inline w-3 h-3 ml-1 text-white" />;
  };

  const sortedTransactions = useMemo(() => {
    let sorted = [...transactionsWithBalance];
    sorted.sort((a, b) => {
      let valA = (a as any)[sortConfig.key];
      let valB = (b as any)[sortConfig.key];
      
      // Fallback handlers
      if (sortConfig.key === 'ccl_name') {
        valA = a.transaction_type === 'Receive' ? a.to_ccl : a.from_ccl;
        valB = b.transaction_type === 'Receive' ? b.to_ccl : b.from_ccl;
      } else if (sortConfig.key === 'ccl_id') {
        valA = a.transaction_type === 'Receive' ? a.to_ccl_id : a.from_ccl_id;
        valB = b.transaction_type === 'Receive' ? b.to_ccl_id : b.from_ccl_id;
      } else if (sortConfig.key === 'facility_name') {
        valA = a.transaction_type === 'Receive' ? a.from_ccl : a.to_ccl;
        valB = b.transaction_type === 'Receive' ? b.from_ccl : b.to_ccl;
      }
      
      if (valA == null) valA = '';
      if (valB == null) valB = '';
      
      let comparison = 0;
      if (typeof valA === 'number' || typeof valB === 'number') {
         comparison = (Number(valA) || 0) - (Number(valB) || 0);
      } else {
         comparison = String(valA).localeCompare(String(valB));
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [transactionsWithBalance, sortConfig]);

  const ITEMS_PER_PAGE = 15;
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedTransactions, currentPage]);

  const totalPages = Math.ceil(sortedTransactions.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortedTransactions]);

  return (
    <div className={`flex flex-col h-full gap-3 ${isExpanded ? 'fixed inset-0 z-50 bg-slate-50 overflow-y-auto p-4' : ''}`}>
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-hpv-purple" />
            Vaccine Stock Ledger
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">End-to-end trace of HPV vaccine movements and inventory balances.</p>
        </div>
        <div className="flex items-center gap-2">
          {!isLive && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold shadow-sm">
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

      {/* ── Filter Toolbar ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 shrink-0">
        <div className="flex flex-wrap gap-2.5 items-end">
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
              className="appearance-none h-9 pl-3 pr-8 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-hpv-purple shadow-sm disabled:opacity-60">
              <option value="All States">All States</option>
              <option value="Uttarakhand">Uttarakhand</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)} disabled={!!adminUser?.district_id}
              className="appearance-none h-9 pl-3 pr-8 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-hpv-purple shadow-sm disabled:opacity-60">
              <option value="All Districts">All Districts</option>
              {initialDistricts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <button onClick={fetchLedgerData} disabled={loading}
            style={{ height: 36, borderRadius: 8, minWidth: 160 }}
            className="ml-auto flex items-center justify-center gap-2 px-5 font-bold text-xs text-white bg-gradient-to-r from-[#3A0088] to-[#3A0088] hover:from-[#3A0088] hover:to-[#3A0088] rounded-lg transition-all shadow-md shadow-hpv-purple/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            {loading ? 'Generating...' : 'Generate Ledger'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 gap-3 pb-2 bg-slate-50 rounded-xl">
        
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">
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
            icon={<ArrowUpRight />} iconBg="bg-hpv-purple-soft text-hpv-purple" label="Dispatched to Blocks" 
            value={fmt(kpis.totalIssuedToBlocks)} valueColor="text-hpv-purple" subLabel="Total sent to L3" loading={loading}
          />
        </div>



        {/* Transaction History Log */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-hpv-purple" />
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
                  className="pl-9 pr-4 py-1.5 h-9 w-64 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hpv-purple focus:border-hpv-purple transition-all shadow-sm"
                />
              </div>

              {matchedCcl && (
                <div className="px-3 py-1.5 h-9 bg-hpv-purple-soft border border-hpv-purple-soft text-hpv-purple rounded-lg text-xs font-bold flex items-center shadow-sm">
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
                      <input type="checkbox" checked={showManufacturer} onChange={e => setShowManufacturer(e.target.checked)} className="rounded border-slate-300 text-hpv-purple" />
                      Manufacturer
                    </label>
                    <label className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer text-sm font-semibold text-slate-700">
                      <input type="checkbox" checked={showExpiry} onChange={e => setShowExpiry(e.target.checked)} className="rounded border-slate-300 text-hpv-purple" />
                      Expiry Date
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-x-hidden bg-white rounded-t-xl border-t border-slate-200">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="sticky top-0 z-10">
                <tr className="gradient-header text-white shadow-sm">
                  <th className="px-3 py-2 text-left font-bold uppercase text-[9px] tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('ccl_name')}>CCL Name{renderSortIcon('ccl_name')}</th>
                  <th className="px-3 py-2 text-left font-bold uppercase text-[9px] tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('ccl_id')}>CCL ID{renderSortIcon('ccl_id')}</th>
                  <th className="px-3 py-2 text-left font-bold uppercase text-[9px] tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('transaction_date')}>Transaction Date{renderSortIcon('transaction_date')}</th>
                  <th className="px-3 py-2 text-left font-bold uppercase text-[9px] tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('transaction_type')}>Transaction Type{renderSortIcon('transaction_type')}</th>
                  <th className="px-3 py-2 text-left font-bold uppercase text-[9px] tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('batch_no')}>Batch/Lot Number{renderSortIcon('batch_no')}</th>
                  {showManufacturer && <th className="px-3 py-2 text-left font-bold uppercase text-[9px] tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('manufacturer')}>Manufacturer Name{renderSortIcon('manufacturer')}</th>}
                  {showExpiry && (
                    <th className="px-3 py-2 text-left font-bold uppercase text-[9px] tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('expiry_date')}>Expiry{renderSortIcon('expiry_date')}</th>
                  )}
                  <th className="px-3 py-2 text-right font-bold uppercase text-[9px] tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('transaction_quantity')}>Transaction Quantity (Doses){renderSortIcon('transaction_quantity')}</th>
                  <th className="px-3 py-2 text-left font-bold uppercase text-[9px] tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('facility_name')}>Transaction Facility Name{renderSortIcon('facility_name')}</th>
                  <th className="px-3 py-2 text-right font-bold uppercase text-[9px] tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('physical_stock_count')}>Physical Stock Count (Doses){renderSortIcon('physical_stock_count')}</th>
                  <th className="px-3 py-2 text-right font-bold uppercase text-[9px] tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('wastage_quantity')}>Wastage / Adjustment (Doses){renderSortIcon('wastage_quantity')}</th>
                  <th className="px-3 py-2 text-right font-bold uppercase text-[9px] tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('computed_balance')}>Closing Stock Balance (Doses){renderSortIcon('computed_balance')}</th>
                  <th className="px-3 py-2 text-left font-bold uppercase text-[9px] tracking-wide border-b border-hpv-purple/40">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-12 text-center text-slate-500 border-x border-b border-slate-200">
                      <div className="flex flex-col items-center justify-center">
                        <FileText className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="text-base font-bold text-slate-700">No transactions found</p>
                        <p className="text-sm mt-1">Try adjusting your filters or search terms.</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedTransactions.map((row: any) => {
                  const formatName = (dist: string, name: string) => dist && dist !== '—' && dist !== '-' ? `${dist} - ${name || 'Unknown'}` : name || 'Unknown';
                  
                  let rawCclName = row.from_ccl;
                  let rawFacilityName = row.to_ccl;
                  let cclId = row.from_ccl_id || '—';
                  let cclDistrict = row.from_district || '—';
                  let facilityDistrict = row.to_district || '—';
                  let txType = row.transaction_type;
                  
                  if (matchedCcl) {
                    if (row.to_ccl_id === matchedCcl.ccl_id) {
                        rawCclName = row.to_ccl;
                        cclId = row.to_ccl_id || '—';
                        cclDistrict = row.to_district || '—';
                        rawFacilityName = row.from_ccl;
                        facilityDistrict = row.from_district || '—';
                        txType = 'Receive';
                    } else if (row.from_ccl_id === matchedCcl.ccl_id) {
                        rawCclName = row.from_ccl;
                        cclId = row.from_ccl_id || '—';
                        cclDistrict = row.from_district || '—';
                        rawFacilityName = row.to_ccl;
                        facilityDistrict = row.to_district || '—';
                        txType = 'Issue';
                    }
                  } else {
                    if (row.transaction_type === 'Receive' || !row.from_ccl_id) {
                        rawCclName = row.to_ccl;
                        cclId = row.to_ccl_id || '—';
                        cclDistrict = row.to_district || '—';
                        rawFacilityName = row.from_ccl;
                        facilityDistrict = row.from_district || '—';
                    } else {
                        rawCclName = row.from_ccl;
                        cclId = row.from_ccl_id || '—';
                        cclDistrict = row.from_district || '—';
                        rawFacilityName = row.to_ccl;
                        facilityDistrict = row.to_district || '—';
                    }
                  }

                  const cclName = formatName(cclDistrict, rawCclName);
                  const facilityName = formatName(facilityDistrict, rawFacilityName);

                  return (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-3 py-2.5 text-[11px] font-bold text-slate-700 border-x border-slate-200 break-words">
                        {cclName}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] font-medium text-slate-500 border-r border-slate-200 break-words">
                        {cclId}
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
                      <td className="px-3 py-2.5 text-[11px] font-bold text-hpv-purple border-r border-slate-200 whitespace-nowrap">
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
                      <td className="px-3 py-2.5 text-[11px] font-semibold text-slate-600 border-r border-slate-200 break-words">
                        {facilityName}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-right font-medium text-slate-400 border-r border-slate-200">
                        —
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-right font-medium text-slate-400 border-r border-slate-200">
                        —
                      </td>
                      <td className={`px-3 py-2.5 text-[11px] text-right border-r border-slate-200 ${matchedCcl ? 'bg-hpv-purple-soft/30' : ''}`}>
                        <span className={`font-extrabold ${
                          row.computed_balance > 0 ? 'text-emerald-700' : row.computed_balance < 0 ? 'text-rose-700' : 'text-slate-500'
                        }`}>
                          {fmt(row.computed_balance)}
                        </span>
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
          
          {/* Pagination */}
          {transactionsWithBalance.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-slate-200 rounded-b-xl">
              <div className="text-sm text-slate-500 font-medium">
                Showing <span className="font-bold text-slate-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * ITEMS_PER_PAGE, transactionsWithBalance.length)}</span> of <span className="font-bold text-slate-900">{transactionsWithBalance.length}</span> results
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 text-slate-500 hover:text-hpv-purple hover:bg-hpv-purple-soft rounded transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Show a sliding window of pages
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = currentPage - 2 + i;
                      if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                    }
                    return (
                      <button 
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors ${
                          currentPage === pageNum 
                            ? 'bg-hpv-purple text-white shadow-sm' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 text-slate-500 hover:text-hpv-purple hover:bg-hpv-purple-soft rounded transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
