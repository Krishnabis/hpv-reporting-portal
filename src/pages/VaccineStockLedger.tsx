import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Download, AlertCircle, Info, Building2, MapPin, Filter, Calendar, Clock, 
  FileText, RefreshCw, Maximize2, Minimize2, Search, ChevronDown, ChevronUp,
  Package, ArrowDownRight, ArrowUpRight, Percent, Trash2, Box, Layers,
  SlidersHorizontal, CheckCircle2, ArrowUpDown, Target, BarChart3, PieChart, Activity
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface LedgerTransactionRow {
  id: string | number;
  ccl_name: string;
  ccl_key?: string;
  transaction_date: string;
  raw_date?: string;
  transaction_type: 'Receive' | 'Issue' | 'Month-end Reconciliation' | 'Adjustment' | string;
  batch_no: string;
  manufacturer_name: string;
  expiry_date: string;
  transaction_quantity: number | null;
  facility_name: string;
  physical_stock_count: number | null;
  wastage_adjustment: number | null;
  closing_balance: number; // this is the running balance after this transaction
  remarks: string;
  ccl_level?: 'L1' | 'L2' | 'L3' | string;
  unit_type?: 'SVS' | 'RVS' | 'DVS' | 'CCP-B' | 'CCL' | string;
  district_name?: string;
}

export interface CclSummaryRow {
  cclKey: string;
  cclName: string;
  levelLabel: string;
  unitType: string;
  finalBalance: number;
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

const DEFAULT_TRANSACTIONS: LedgerTransactionRow[] = [
  {
    id: 1,
    ccl_name: 'District Vaccine Store Lucknow (L2)',
    transaction_date: '01/05/2025',
    transaction_type: 'Receive',
    batch_no: 'HPV250401',
    manufacturer_name: 'Merck/MSD',
    expiry_date: '31/03/2027',
    transaction_quantity: 1000,
    facility_name: 'State Vaccine Store Lucknow (L1)',
    physical_stock_count: null,
    wastage_adjustment: null,
    closing_balance: 2250,
    remarks: 'Initial receipt',
    ccl_level: 'L2',
    unit_type: 'DVS'
  },
  {
    id: 2,
    ccl_name: 'District Vaccine Store Lucknow (L2)',
    transaction_date: '05/05/2025',
    transaction_type: 'Issue',
    batch_no: 'HPV250401',
    manufacturer_name: 'Merck/MSD',
    expiry_date: '31/03/2027',
    transaction_quantity: -600,
    facility_name: 'CHC Alambagh (L3)',
    physical_stock_count: null,
    wastage_adjustment: null,
    closing_balance: 1650,
    remarks: 'Routine issue',
    ccl_level: 'L2',
    unit_type: 'DVS'
  },
  {
    id: 3,
    ccl_name: 'District Vaccine Store Lucknow (L2)',
    transaction_date: '10/05/2025',
    transaction_type: 'Receive',
    batch_no: 'HPV250410',
    manufacturer_name: 'Merck/MSD',
    expiry_date: '30/04/2027',
    transaction_quantity: 1000,
    facility_name: 'State Vaccine Store Lucknow (L1)',
    physical_stock_count: null,
    wastage_adjustment: null,
    closing_balance: 2650,
    remarks: 'Additional receipt',
    ccl_level: 'L2',
    unit_type: 'DVS'
  },
  {
    id: 4,
    ccl_name: 'District Vaccine Store Lucknow (L2)',
    transaction_date: '15/05/2025',
    transaction_type: 'Issue',
    batch_no: 'HPV250401',
    manufacturer_name: 'Merck/MSD',
    expiry_date: '31/03/2027',
    transaction_quantity: -800,
    facility_name: 'PHC Mohan Road (L3)',
    physical_stock_count: null,
    wastage_adjustment: null,
    closing_balance: 1850,
    remarks: 'Routine issue',
    ccl_level: 'L2',
    unit_type: 'DVS'
  },
  {
    id: 5,
    ccl_name: 'District Vaccine Store Lucknow (L2)',
    transaction_date: '20/05/2025',
    transaction_type: 'Issue',
    batch_no: 'HPV250410',
    manufacturer_name: 'Merck/MSD',
    expiry_date: '30/04/2027',
    transaction_quantity: -600,
    facility_name: 'PHC Kakori (L3)',
    physical_stock_count: null,
    wastage_adjustment: null,
    closing_balance: 1250,
    remarks: 'Routine issue',
    ccl_level: 'L2',
    unit_type: 'DVS'
  },
  {
    id: 6,
    ccl_name: 'District Vaccine Store Lucknow (L2)',
    transaction_date: '31/05/2025',
    transaction_type: 'Month-end Reconciliation',
    batch_no: '-',
    manufacturer_name: '-',
    expiry_date: '-',
    transaction_quantity: null,
    facility_name: 'District Vaccine Store Lucknow (L2)',
    physical_stock_count: 1175,
    wastage_adjustment: 75,
    closing_balance: 1175,
    remarks: 'Physical verification at month end',
    ccl_level: 'L2',
    unit_type: 'DVS'
  },
  {
    id: 7,
    ccl_name: 'District Vaccine Store Dehradun (L2)',
    transaction_date: '02/06/2025',
    transaction_type: 'Receive',
    batch_no: 'HPV250412',
    manufacturer_name: 'Merck/MSD',
    expiry_date: '15/05/2027',
    transaction_quantity: 1500,
    facility_name: 'State Vaccine Store Dehradun (L1)',
    physical_stock_count: null,
    wastage_adjustment: null,
    closing_balance: 2750,
    remarks: 'Initial receipt',
    ccl_level: 'L2',
    unit_type: 'DVS'
  },
  {
    id: 8,
    ccl_name: 'District Vaccine Store Haridwar (L2)',
    transaction_date: '12/06/2025',
    transaction_type: 'Issue',
    batch_no: 'HPV250412',
    manufacturer_name: 'Merck/MSD',
    expiry_date: '15/05/2027',
    transaction_quantity: -750,
    facility_name: 'CHC Roorkee (L3)',
    physical_stock_count: null,
    wastage_adjustment: null,
    closing_balance: 2000,
    remarks: 'Routine issue',
    ccl_level: 'L2',
    unit_type: 'DVS'
  }
];

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-IN');
}

// ─── KPI Card Component (Matching DailyProgressReport / VaccineStockMonitoringReport) ───
const KpiCard: React.FC<{
  icon: React.ReactNode; label: string; value: string;
  subLabel?: string; subValue?: string; iconBg: string; valueColor?: string; loading?: boolean;
}> = ({ icon, label, value, subLabel, subValue, iconBg, valueColor = 'text-slate-900', loading }) => (
  <div className="bg-white rounded-xl px-2.5 py-2 shadow-sm border border-slate-200 flex items-center gap-2 hover:shadow-md transition-shadow">
    {loading ? (
      <div className="animate-pulse flex items-center gap-2 w-full">
        <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
        <div className="flex flex-col gap-1 w-full">
          <div className="h-2 bg-slate-200 rounded w-1/2" />
          <div className="h-3 bg-slate-200 rounded w-3/4" />
        </div>
      </div>
    ) : (
      <>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg} shrink-0 [&>svg]:w-4 [&>svg]:h-4`}>
          {icon}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="text-[9px] font-semibold text-slate-600 truncate leading-tight">{label}</div>
          <div className={`text-[13px] font-extrabold leading-none mt-0.5 ${valueColor} truncate`}>{value}</div>
          {(subValue || subLabel) && (
            <>
              <div className="w-full h-px bg-slate-100 my-1" />
              <div className="text-[8px] font-bold leading-none truncate">
                {subValue && <span className="text-emerald-600">{subValue}</span>}
                {subValue && subLabel && <span className="text-slate-500 ml-0.5">{subLabel}</span>}
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
  const [data, setData] = useState<LedgerTransactionRow[]>(DEFAULT_TRANSACTIONS);
  const [cclSummary, setCclSummary] = useState<CclSummaryRow[]>([]);
  const [apiKpis, setApiKpis] = useState<any>(null); // kpis returned from the live API
  const [isLiveData, setIsLiveData] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchCCL, setSearchCCL] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [showAdvanceSearch, setShowAdvanceSearch] = useState(false);
  const [showCclSummary, setShowCclSummary] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showManufacturer, setShowManufacturer] = useState(true);
  const [showExpiry, setShowExpiry] = useState(true);
  const [showColMenu, setShowColMenu] = useState(false);

  // Filters State
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-09-02');
  const [selectedState, setSelectedState] = useState('Uttarakhand');
  const [reportLevel, setReportLevel] = useState('District');
  const [selectedDistrict, setSelectedDistrict] = useState('All Districts');
  
  // Advanced Filters State
  const [cclLevel, setCclLevel] = useState('All');
  const [cclUnitType, setCclUnitType] = useState('All');
  const [transactionType, setTransactionType] = useState('All');
  const [manufacturerName, setManufacturerName] = useState('All');
  const [batchNo, setBatchNo] = useState('');

  // Pagination & Sorting State
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<keyof LedgerTransactionRow>('transaction_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // States & Districts
  const [statesList, setStatesList] = useState<StateItem[]>(initialStates);
  const [districtsList, setDistrictsList] = useState<DistrictItem[]>(initialDistricts);

  useEffect(() => {
    if (initialStates && initialStates.length > 0) setStatesList(initialStates);
    if (initialDistricts && initialDistricts.length > 0) setDistrictsList(initialDistricts);
  }, [initialStates, initialDistricts]);

  // Fetch Ledger data from Backend API
  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        state: selectedState,
        reportLevel,
        district: selectedDistrict,
        cclName: searchCCL,
        cclLevel,
        cclUnitType,
        transactionType,
        manufacturer: manufacturerName,
        batchNo
      });

      const res = await fetch(`/api/admin/reports/stock-ledger?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.ok) {
        const json = await res.json();
        if (json && json.rows && Array.isArray(json.rows) && json.rows.length > 0) {
          setData(json.rows);
          setIsLiveData(!!json.isLive);
          if (json.cclSummary) setCclSummary(json.cclSummary);
          if (json.kpis) setApiKpis(json.kpis);
        } else {
          setData(DEFAULT_TRANSACTIONS);
          setIsLiveData(false);
          setCclSummary([]);
          setApiKpis(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch stock ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgerData();
  }, []);

  // Filtered & Sorted Data
  const filteredData = useMemo(() => {
    let result = [...data];

    const query = (quickSearch || searchCCL).trim().toLowerCase();
    if (query) {
      result = result.filter(r => 
        r.ccl_name.toLowerCase().includes(query) ||
        r.facility_name.toLowerCase().includes(query) ||
        r.batch_no.toLowerCase().includes(query)
      );
    }

    if (selectedDistrict && selectedDistrict !== 'All Districts') {
      result = result.filter(r => 
        r.ccl_name.toLowerCase().includes(selectedDistrict.toLowerCase()) ||
        r.facility_name.toLowerCase().includes(selectedDistrict.toLowerCase())
      );
    }

    if (cclLevel !== 'All') {
      result = result.filter(r => r.ccl_level === cclLevel || r.ccl_name.includes(`(${cclLevel})`));
    }
    if (cclUnitType !== 'All') {
      result = result.filter(r => r.unit_type === cclUnitType);
    }
    if (transactionType !== 'All') {
      result = result.filter(r => r.transaction_type.toLowerCase() === transactionType.toLowerCase());
    }
    if (manufacturerName !== 'All') {
      result = result.filter(r => r.manufacturer_name.toLowerCase() === manufacturerName.toLowerCase());
    }
    if (batchNo.trim()) {
      result = result.filter(r => r.batch_no.toLowerCase().includes(batchNo.trim().toLowerCase()));
    }

    if (sortField) {
      result.sort((a, b) => {
        let valA = a[sortField] ?? '';
        let valB = b[sortField] ?? '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchCCL, quickSearch, selectedDistrict, cclLevel, cclUnitType, transactionType, manufacturerName, batchNo, sortField, sortOrder]);

  // Compute KPI Summaries — use API-returned values when live to avoid any client-side double-counting
  const kpis = useMemo(() => {
    // If we have live API kpis, use them directly (they are correctly computed server-side)
    if (isLiveData && apiKpis) {
      return {
        openingStock: apiKpis.openingStock ?? 0,
        totalReceived: apiKpis.totalReceived ?? 0,
        totalIssued: apiKpis.totalIssued ?? 0,
        totalAdjustment: apiKpis.totalAdjustment ?? 0,
        closingStock: apiKpis.closingStock ?? 0,
        wastagePct: apiKpis.wastagePct ?? '0.00'
      };
    }

    // Fallback: compute client-side from the displayed data (for demo/default rows)
    let totalReceived = 0;
    let totalIssued = 0;
    let totalAdjustment = 0;

    filteredData.forEach(row => {
      if (row.transaction_type === 'Receive' && row.transaction_quantity && row.transaction_quantity > 0) {
        totalReceived += row.transaction_quantity;
      } else if (row.transaction_type === 'Issue' && row.transaction_quantity) {
        totalIssued += Math.abs(row.transaction_quantity);
      }
      if (row.wastage_adjustment) {
        totalAdjustment += row.wastage_adjustment;
      }
    });

    const closingStock = Math.max(0, totalReceived - totalIssued - totalAdjustment);
    const wastagePct = totalIssued > 0 ? ((totalAdjustment / totalIssued) * 100).toFixed(2) : '0.00';

    return {
      openingStock: 0,
      totalReceived,
      totalIssued,
      totalAdjustment,
      closingStock,
      wastagePct
    };
  }, [filteredData, isLiveData, apiKpis]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleSort = (field: keyof LedgerTransactionRow) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // CSV Export
  const handleDownloadCSV = () => {
    const headers = [
      'CCL Name',
      'Transaction Date',
      'Transaction Type',
      'Batch/Lot Number',
      'Manufacturer Name',
      'Expiry',
      'Transaction Quantity (Doses)',
      'Transaction Facility Name',
      'Physical Stock Count (Doses)',
      'Wastage / Adjustment (Doses)',
      'Closing Stock Balance (Doses)',
      'Remarks'
    ];

    const rows = filteredData.map(r => [
      `"${r.ccl_name}"`,
      `"${r.transaction_date}"`,
      `"${r.transaction_type}"`,
      `"${r.batch_no}"`,
      `"${r.manufacturer_name}"`,
      `"${r.expiry_date}"`,
      r.transaction_quantity !== null ? r.transaction_quantity : '-',
      `"${r.facility_name}"`,
      r.physical_stock_count !== null ? r.physical_stock_count : '-',
      r.wastage_adjustment !== null ? r.wastage_adjustment : '-',
      r.closing_balance,
      `"${r.remarks}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HPV_Vaccine_Stock_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Export
  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(16);
    doc.setTextColor(30, 58, 138);
    doc.text('HPV Vaccine Stock Ledger', 14, 15);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Location: ${selectedState} - ${selectedDistrict} | Period: ${dateFrom} to ${dateTo}`, 14, 21);

    doc.setFontSize(9);
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 25, 269, 12, 'F');
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Opening Stock: ${fmt(kpis.openingStock)} | Received: ${fmt(kpis.totalReceived)} | Issued: ${fmt(kpis.totalIssued)} | Adjustment: ${fmt(kpis.totalAdjustment)} | Closing Stock: ${fmt(kpis.closingStock)} | Wastage: ${kpis.wastagePct}%`,
      18, 32
    );

    const headers = [[
      'CCL Name',
      'Date',
      'Type',
      'Batch No',
      'Manufacturer',
      'Expiry',
      'Qty (Doses)',
      'Facility Name',
      'Physical',
      'Adjustment',
      'Closing Stock',
      'Remarks'
    ]];

    const bodyData = filteredData.map(r => [
      r.ccl_name,
      r.transaction_date,
      r.transaction_type,
      r.batch_no,
      r.manufacturer_name,
      r.expiry_date,
      r.transaction_quantity !== null ? (r.transaction_quantity > 0 ? `+${r.transaction_quantity}` : `${r.transaction_quantity}`) : '-',
      r.facility_name,
      r.physical_stock_count !== null ? r.physical_stock_count : '-',
      r.wastage_adjustment !== null ? r.wastage_adjustment : '-',
      r.closing_balance,
      r.remarks
    ]);

    autoTable(doc, {
      head: headers,
      body: bodyData,
      startY: 42,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [44, 24, 76], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 }
    });

    doc.save(`HPV_Vaccine_Stock_Ledger_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className={`flex flex-col h-full gap-3 ${isExpanded ? 'fixed inset-0 z-50 overflow-auto bg-slate-50 p-4' : ''}`}>
      
      {/* ─── 1. PAGE HEADER (Matching Daily Progress / Stock Monitoring) ─── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
            HPV Vaccination — HPV Vaccine Stock Ledger
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Tracks detailed vaccine transaction history, physical verification balances, and closing stock metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Download PDF</span>
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* ─── 2. FILTER TOOLBAR (Matching Daily Progress select boxes & button styling) ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 shrink-0 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          
          {/* Date From */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="pl-2.5 pr-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 cursor-pointer"
              style={{ minWidth: 140 }}
            />
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="pl-2.5 pr-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 cursor-pointer"
              style={{ minWidth: 140 }}
            />
          </div>

          {/* State */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">State</label>
            <div className="relative">
              <select
                value={selectedState}
                onChange={e => setSelectedState(e.target.value)}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer"
                style={{ minWidth: 130 }}
              >
                <option value="Uttarakhand">Uttarakhand</option>
                <option value="Uttar Pradesh">Uttar Pradesh</option>
                <option value="All States">All States</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Report Level */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Report Level</label>
            <div className="relative">
              <select
                value={reportLevel}
                onChange={e => setReportLevel(e.target.value)}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer"
                style={{ minWidth: 130 }}
              >
                <option value="District">District</option>
                <option value="Block Units">Block Units</option>
                <option value="CCL Level">CCL Level</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Districts */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Districts</label>
            <div className="relative">
              <select
                value={selectedDistrict}
                onChange={e => setSelectedDistrict(e.target.value)}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer"
                style={{ minWidth: 150 }}
              >
                <option value="All Districts">All Districts</option>
                <option value="Kumaon">Kumaon</option>
                <option value="Garhwal">Garhwal</option>
                <option value="Lucknow">Lucknow</option>
                <option value="Dehradun">Dehradun</option>
                <option value="Haridwar">Haridwar</option>
                <option value="Nainital">Nainital</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* CCL Name Search */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">CCL Search</label>
            <input
              type="text"
              placeholder="Search CCL..."
              value={searchCCL}
              onChange={e => setSearchCCL(e.target.value)}
              className="pl-2.5 pr-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 cursor-pointer"
              style={{ minWidth: 140 }}
            />
          </div>

          {/* Generate Report Button */}
          <button
            onClick={fetchLedgerData}
            disabled={loading}
            style={{ height: 36, minWidth: 150 }}
            className="flex items-center justify-center gap-2 px-5 font-bold text-xs text-white bg-gradient-to-r from-[#3B1C63] to-[#522B85] hover:from-[#522B85] hover:to-[#6d3aad] rounded-lg transition-all shadow-md shadow-purple-900/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            <span>{loading ? 'Generating...' : 'Generate Report'}</span>
          </button>

        </div>

        {/* Advanced Search Toggle */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
          <button
            onClick={() => setShowAdvanceSearch(prev => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Advance Search Options</span>
            {showAdvanceSearch ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <span className="text-[10px] font-semibold text-slate-400 italic">Search Filter Expands</span>
        </div>

        {/* Collapsible Advanced Search Fields */}
        {showAdvanceSearch && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase">CCL Level (L1, L2, L3)</label>
              <select
                value={cclLevel}
                onChange={e => setCclLevel(e.target.value)}
                className="w-full px-2 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500/30"
              >
                <option value="All">All Levels</option>
                <option value="L1">L1 - State Store</option>
                <option value="L2">L2 - District Store</option>
                <option value="L3">L3 - Block Store</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase">CCL - Unit Type</label>
              <select
                value={cclUnitType}
                onChange={e => setCclUnitType(e.target.value)}
                className="w-full px-2 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500/30"
              >
                <option value="All">All Unit Types</option>
                <option value="SVS">SVS (State Vaccine Store)</option>
                <option value="RVS">RVS (Regional Vaccine Store)</option>
                <option value="DVS">DVS (District Vaccine Store)</option>
                <option value="CCP-B">CCP-B (Cold Chain Point Block)</option>
                <option value="CCL">CCL (Cold Chain Location)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase">Transaction Type</label>
              <select
                value={transactionType}
                onChange={e => setTransactionType(e.target.value)}
                className="w-full px-2 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500/30"
              >
                <option value="All">All Types</option>
                <option value="Receive">Receive</option>
                <option value="Issue">Issue</option>
                <option value="Month-end Reconciliation">Month-end Reconciliation</option>
                <option value="Adjustment">Adjustment</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase">Manufacturer Name</label>
              <select
                value={manufacturerName}
                onChange={e => setManufacturerName(e.target.value)}
                className="w-full px-2 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500/30"
              >
                <option value="All">All Manufacturers</option>
                <option value="Merck/MSD">Merck/MSD</option>
                <option value="Bharat Biotech">Bharat Biotech</option>
                <option value="GlaxoSmithKline">GlaxoSmithKline</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase">Batch/Lot Number</label>
              <input
                type="text"
                placeholder="e.g. HPV250401"
                value={batchNo}
                onChange={e => setBatchNo(e.target.value)}
                className="w-full px-2 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-purple-500/30"
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── 3. KPI CARDS (Matching Daily Progress / Stock Monitoring Grid) ─── */}
      {!isExpanded && (
        <div className="shrink-0 p-1">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-xs font-bold text-slate-700">{selectedState} — {selectedDistrict}</span>
              <span className="text-[10px] text-slate-400">— Report Period: ({dateFrom} to {dateTo})</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-1.5">
            <KpiCard loading={loading} icon={<Box className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50"
              label="Opening Stock" value={fmt(kpis.openingStock)} valueColor="text-blue-700" subLabel="Start Date doses" />
            <KpiCard loading={loading} icon={<ArrowDownRight className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50"
              label="Total Received" value={fmt(kpis.totalReceived)} valueColor="text-emerald-700" subLabel="Doses" />
            <KpiCard loading={loading} icon={<ArrowUpRight className="w-4 h-4 text-amber-600" />} iconBg="bg-amber-50"
              label="Total Issued" value={fmt(kpis.totalIssued)} valueColor="text-amber-700" subLabel="Doses" />
            <KpiCard loading={loading} icon={<Trash2 className="w-4 h-4 text-rose-600" />} iconBg="bg-rose-50"
              label="Total Adjustment" value={fmt(kpis.totalAdjustment)} valueColor="text-rose-700" subLabel="Wastage doses" />
            <KpiCard loading={loading} icon={<Layers className="w-4 h-4 text-indigo-600" />} iconBg="bg-indigo-50"
              label="Closing Stock" value={fmt(kpis.closingStock)} valueColor="text-indigo-700" subLabel="End Date doses" />
            <KpiCard loading={loading} icon={<Percent className="w-4 h-4 text-teal-600" />} iconBg="bg-teal-50"
              label="% Adjustments" value={`${kpis.wastagePct}%`} valueColor="text-teal-700" subLabel="vs Total Issued" />
          </div>
        </div>
      )}

      {/* ─── 4. CCL FINAL BALANCE SUMMARY PANEL ─── */}
      {cclSummary.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 shrink-0">
          <button
            onClick={() => setShowCclSummary(prev => !prev)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors rounded-xl cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span className="uppercase tracking-wider">CCL Stock Summary — Final Balances ({cclSummary.length} CCLs)</span>
              <span className="text-[10px] font-normal text-slate-400">Running balance after all transactions</span>
            </div>
            {showCclSummary ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {showCclSummary && (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-left" style={{ fontSize: '11px' }}>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 font-bold text-slate-500 uppercase tracking-wide">CCL Name</th>
                    <th className="px-3 py-2 font-bold text-slate-500 uppercase tracking-wide text-center">Level</th>
                    <th className="px-3 py-2 font-bold text-slate-500 uppercase tracking-wide text-center">Unit Type</th>
                    <th className="px-3 py-2 font-bold text-slate-500 uppercase tracking-wide text-right">Final Stock Balance</th>
                    <th className="px-3 py-2 font-bold text-slate-500 uppercase tracking-wide text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cclSummary.map((ccl, i) => {
                    const isPositive = ccl.finalBalance > 0;
                    const isNegative = ccl.finalBalance < 0;
                    const isZero = ccl.finalBalance === 0;
                    return (
                      <tr key={ccl.cclKey || i} className="hover:bg-purple-50/20 transition-colors">
                        <td className="px-3 py-2 font-semibold text-slate-800">{ccl.cclName}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700">{ccl.levelLabel}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">{ccl.unitType}</span>
                        </td>
                        <td className={`px-3 py-2 text-right font-black text-sm ${
                          isPositive ? 'text-emerald-700' : isNegative ? 'text-rose-600' : 'text-slate-500'
                        }`}>
                          {isPositive && '+'}{fmt(ccl.finalBalance)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isPositive && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Stock Available
                            </span>
                          )}
                          {isNegative && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-2.5 h-2.5" /> Stock Deficit
                            </span>
                          )}
                          {isZero && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Balanced
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── 5. DATA TABLE CONTAINER ─── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-0 overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">
              {filteredData.length} CCL Transaction{filteredData.length !== 1 ? 's' : ''}
            </span>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider transition-colors mx-auto cursor-pointer"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {isExpanded ? 'Collapse Table' : 'Expand Table'}
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search by CCL name..."
              value={quickSearch}
              onChange={e => { setQuickSearch(e.target.value); setCurrentPage(1); }}
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
              style={{ width: 220 }}
            />
          </div>

          {/* Column Visibility Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowColMenu(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer border border-slate-200"
            >
              <SlidersHorizontal className="w-3 h-3" />
              Columns
            </button>
            {showColMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-3 min-w-[160px]">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Show / Hide Columns</p>
                <label className="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-50 rounded px-1">
                  <input
                    type="checkbox"
                    checked={showManufacturer}
                    onChange={e => setShowManufacturer(e.target.checked)}
                    className="accent-purple-600 w-3.5 h-3.5"
                  />
                  <span className="text-xs font-semibold text-slate-700">Manufacturer</span>
                </label>
                <label className="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-50 rounded px-1">
                  <input
                    type="checkbox"
                    checked={showExpiry}
                    onChange={e => setShowExpiry(e.target.checked)}
                    className="accent-purple-600 w-3.5 h-3.5"
                  />
                  <span className="text-xs font-semibold text-slate-700">Expiry Date</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Table with .gradient-header */}
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full text-left border-collapse" style={{ fontSize: '11px' }}>
            <thead className="sticky top-0 z-10">
              <tr className="gradient-header text-white">
                <th className="px-3 py-2 text-left font-bold uppercase tracking-wide border-b border-purple-900/40">CCL Name</th>
                <th 
                  onClick={() => handleSort('transaction_date')}
                  className="px-3 py-2 border-b border-purple-900/40 cursor-pointer hover:bg-purple-900/50 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3 text-purple-200" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('transaction_type')}
                  className="px-3 py-2 border-b border-purple-900/40 cursor-pointer hover:bg-purple-900/50 select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Transaction Type</span>
                    <ArrowUpDown className="w-3 h-3 text-purple-200" />
                  </div>
                </th>
                <th className="px-3 py-2 border-b border-purple-900/40">Batch/Lot No</th>
                {showManufacturer && <th className="px-3 py-2 border-b border-purple-900/40">Manufacturer</th>}
                {showExpiry && (
                  <th 
                    onClick={() => handleSort('expiry_date')}
                    className="px-3 py-2 border-b border-purple-900/40 cursor-pointer hover:bg-purple-900/50 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Expiry</span>
                      <ArrowUpDown className="w-3 h-3 text-purple-200" />
                    </div>
                  </th>
                )}
                <th className="px-3 py-2 border-b border-purple-900/40 text-right">Qty (Doses)</th>
                <th className="px-3 py-2 border-b border-purple-900/40">From</th>
                <th className="px-3 py-2 border-b border-purple-900/40">To</th>
                <th className="px-3 py-2 border-b border-purple-900/40 text-right">Physical Count</th>
                <th 
                  onClick={() => handleSort('wastage_adjustment')}
                  className="px-3 py-2 border-b border-purple-900/40 text-right cursor-pointer hover:bg-purple-900/50 select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Wastage/Adjustment</span>
                    <ArrowUpDown className="w-3 h-3 text-purple-200" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('closing_balance')}
                  className="px-3 py-2 border-b border-purple-900/40 text-right cursor-pointer hover:bg-purple-900/50 select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Running Balance</span>
                    <ArrowUpDown className="w-3 h-3 text-purple-200" />
                  </div>
                </th>
                <th className="px-3 py-2 border-b border-purple-900/40">Remarks</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-[11px] font-medium text-slate-800 bg-white">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <span>No stock ledger transaction records match the selected criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  const rowBg = isEven ? 'bg-white' : 'bg-slate-50/60';
                  return (
                    <tr key={row.id || idx} className={`border-b border-slate-100 hover:bg-purple-50/30 transition-colors group ${rowBg}`}>
                      <td className="px-3 py-2 font-bold text-slate-900">{row.ccl_name}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">{row.transaction_date}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.transaction_type === 'Receive' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            Receive
                          </span>
                        )}
                        {row.transaction_type === 'Issue' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                            Issue
                          </span>
                        )}
                        {(row.transaction_type === 'Month-end Reconciliation' || row.transaction_type === 'Adjustment') && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                            Month-end Reconciliation
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] font-semibold text-purple-900">{row.batch_no}</td>
                      {showManufacturer && <td className="px-3 py-2 text-slate-700">{row.manufacturer_name}</td>}
                      {showExpiry && <td className="px-3 py-2 whitespace-nowrap text-slate-600">{row.expiry_date}</td>}
                      
                      <td className="px-3 py-2 text-right font-extrabold whitespace-nowrap">
                        {row.transaction_quantity !== null ? (
                          row.transaction_quantity > 0 ? (
                            <span className="text-emerald-600">+{fmt(row.transaction_quantity)}</span>
                          ) : (
                            <span className="text-rose-600">{fmt(row.transaction_quantity)}</span>
                          )
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2 text-slate-600 font-medium text-[10px]">
                        {(row as any).from_ccl || row.facility_name || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600 font-medium text-[10px]">
                        {(row as any).to_ccl || row.ccl_name || '—'}
                      </td>

                      <td className="px-3 py-2 text-right text-slate-800 font-bold">
                        {row.physical_stock_count !== null ? fmt(row.physical_stock_count) : <span className="text-slate-400 font-normal">—</span>}
                      </td>

                      <td className="px-3 py-2 text-right font-extrabold">
                        {row.wastage_adjustment !== null ? (
                          <span className="text-rose-600">{fmt(row.wastage_adjustment)}</span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>

                      <td className={`px-3 py-2 text-right font-black bg-slate-50/50 ${
                        row.closing_balance > 0
                          ? 'text-emerald-700'
                          : row.closing_balance < 0
                          ? 'text-rose-600'
                          : 'text-slate-500'
                      }`}>
                        {row.closing_balance > 0 && '+'}{fmt(row.closing_balance)}
                      </td>

                      <td className="px-3 py-2 text-slate-500 italic text-[10px]">{row.remarks}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Stock Alerts & Footer Notes */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-2 shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-blue-50 border border-blue-200 text-blue-900 px-3 py-2 rounded-lg text-[11px] font-medium">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Note: Closing Stock Balance is updated after each transaction. Physical Stock Count and Wastage/Adjustment are applicable only for Month-end Reconciliation.</span>
            </div>
            <div className="flex items-center gap-1 text-blue-700 font-semibold shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>Data as on: {new Date().toLocaleDateString('en-GB')} 06:15 PM</span>
            </div>
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <span>View per Page</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="text-slate-500 font-semibold">
            Showing {filteredData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} records
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
            >
              Previous
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                  currentPage === page
                    ? 'bg-purple-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {page}
              </button>
            ))}

            {totalPages > 5 && <span className="px-1 text-slate-400 font-bold">...</span>}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
