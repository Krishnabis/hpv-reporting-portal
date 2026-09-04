import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2, Download, Search, ChevronLeft, ChevronRight,
  Filter, MapPin, Clock, FileText, Layers, ShieldCheck, Tag,
  Maximize2, Minimize2, ChevronDown, BarChart3, RefreshCw, Upload, FileUp, Database, ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CCLRecord {
  id: string | number;
  ccl_id: string;
  facility_name: string;
  unit_type: string;
  unit_level: string | number;
  ccl_block_hq_yes: string | number | boolean;
  name_of_unit_incharge: string;
  contact_number: string;
  health_facility_type: string;
  setting: string;
  district_id?: string | number;
  block_id?: string | number;
  districts?: { id: string | number; name: string };
  blocks?: { id: string | number; name: string; health_block_name?: string };
  states?: { id: string | number; name: string };
}

interface CCLKPIs {
  total: number;
  l1: number;
  l2: number;
  l3: number;
}

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

export const ColdChainLocations: React.FC<{
  states: any[];
  allDistricts: any[];
  masterBlocks: any[];
  divisions: any[];
  adminUser: any;
}> = ({ states, allDistricts, masterBlocks, adminUser }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'facility_name', direction: 'asc' });

  // Filters
  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [reportLevel, setReportLevel] = useState<'District' | 'Block Units'>('District');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cclLevel, setCclLevel] = useState<string>('ALL');
  const [cclUnitType, setCclUnitType] = useState<string>('ALL');

  // Data & KPIs
  const [ccpList, setCcpList] = useState<CCLRecord[]>([]);
  const [kpis, setKpis] = useState<CCLKPIs>({ total: 0, l1: 0, l2: 0, l3: 0 });

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // District scoping for District users / DVS
  const isDistrictUser = adminUser?.district_id || adminUser?.role === 'DISTRICT_ADMIN' || String(adminUser?.ccl_unit_level) === '2';

  // Set default state
  useEffect(() => {
    if (selectedStateId) return;
    if (adminUser?.state_id) {
      setSelectedStateId(String(adminUser.state_id));
    } else if (states && states.length > 0) {
      const uk = states.find(s => s.name.toLowerCase().includes('uttarakhand'));
      setSelectedStateId(String(uk ? uk.id : states[0].id));
    }
  }, [states, adminUser, selectedStateId]);

  // Set default district for District users
  useEffect(() => {
    if (isDistrictUser && adminUser?.district_id) {
      setSelectedDistrictId(String(adminUser.district_id));
    }
  }, [adminUser, isDistrictUser]);

  const selectedStateName = useMemo(() => {
    const found = (states || []).find(s => String(s.id) === String(selectedStateId));
    return found ? found.name : 'Uttarakhand';
  }, [states, selectedStateId]);

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  // Fetch data from API
  const fetchLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const params = new URLSearchParams({
        state_id: selectedStateId || '1',
        level: reportLevel,
        districtId: selectedDistrictId,
        unit_level: cclLevel,
        unit_type: cclUnitType,
        search: searchQuery
      });

      const res = await fetch(`/api/admin/ccl-locations?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) throw new Error('Failed to fetch Cold Chain Locations');
      const json = await res.json();
      setCcpList(json.ccps || []);
      setKpis(json.kpis || { total: 0, l1: 0, l2: 0, l3: 0 });
      setPage(1);
    } catch (err: any) {
      setError(err.message || 'Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  const hasFetched = useRef(false);
  useEffect(() => {
    if (!hasFetched.current && selectedStateId) {
      fetchLocations();
      hasFetched.current = true;
    } else if (hasFetched.current) {
      fetchLocations();
    }
  }, [selectedStateId, reportLevel, selectedDistrictId, cclLevel, cclUnitType]);

  // Handle Search submit / debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasFetched.current) fetchLocations();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  // Client-side Filtered Records
  const filteredRecords = useMemo(() => {
    let list = ccpList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r =>
        (r.facility_name && r.facility_name.toLowerCase().includes(q)) ||
        (r.ccl_id && r.ccl_id.toLowerCase().includes(q)) ||
        (r.districts?.name && r.districts.name.toLowerCase().includes(q)) ||
        (r.blocks?.name && r.blocks.name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [ccpList, searchQuery]);

  const sortedRecords = useMemo(() => {
    let sorted = [...filteredRecords];
    sorted.sort((a, b) => {
      let valA = (a as any)[sortConfig.key];
      let valB = (b as any)[sortConfig.key];
      
      // Handle nested values for districts and blocks
      if (sortConfig.key === 'districts') valA = a.districts?.name;
      if (sortConfig.key === 'districts') valB = b.districts?.name;
      if (sortConfig.key === 'blocks') valA = a.blocks?.name;
      if (sortConfig.key === 'blocks') valB = b.blocks?.name;
      
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
  }, [filteredRecords, sortConfig]);

  // Paginated Rows
  const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRecords.slice(start, start + pageSize);
  }, [sortedRecords, page, pageSize]);

  // Download CSV Handler
  const downloadCSV = () => {
    const headers = [
      'S.No', 'CCL ID', 'Name of Facility', 'Unit Type', 'District', 'Block', 'CCL Block HQ', 'Incharge', 'Contact', 'Level', 'Health Facility Type', 'Setting'
    ];

    const rows = sortedRecords.map((r, i) => [
      i + 1,
      `"${r.ccl_id || ''}"`,
      `"${r.facility_name || ''}"`,
      `"${r.unit_type || ''}"`,
      `"${r.districts?.name || ''}"`,
      `"${r.blocks?.name || ''}"`,
      `"${r.ccl_block_hq_yes === 'Yes' || r.ccl_block_hq_yes === true || r.ccl_block_hq_yes === 1 ? 'Yes' : 'No'}"`,
      `"${r.name_of_unit_incharge || ''}"`,
      `"${r.contact_number || ''}"`,
      `"Level ${r.unit_level || ''}"`,
      `"${r.health_facility_type || ''}"`,
      `"${r.setting || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Cold_Chain_Locations_${selectedStateName.replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  // Download PDF Handler
  const downloadPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(49, 16, 84);
    doc.text(`Cold Chain Locations Registry - ${selectedStateName}`, 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Total CCPs: ${filteredRecords.length}  |  Report Level: ${reportLevel}  |  Generated: ${currentDateFormatted}`, 14, 22);

    const pdfHeaders = [[
      'S.No', 'CCL ID', 'Name of Facility', 'Unit Type', 'Block / District', 'Block HQ', 'Incharge', 'Level', 'Facility Type'
    ]];

    const pdfRows = filteredRecords.map((r, i) => [
      i + 1,
      r.ccl_id || '—',
      r.facility_name || '—',
      r.unit_type || '—',
      `${r.blocks?.name || '—'}\n(${r.districts?.name || '—'})`,
      r.ccl_block_hq_yes === 'Yes' || r.ccl_block_hq_yes === true || r.ccl_block_hq_yes === 1 ? 'Yes' : 'No',
      `${r.name_of_unit_incharge || '—'}${r.contact_number ? `\nPh: ${r.contact_number}` : ''}`,
      `Level ${r.unit_level || '—'}`,
      r.health_facility_type || '—'
    ]);

    autoTable(doc, {
      head: pdfHeaders,
      body: pdfRows,
      startY: 26,
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        1: { fontStyle: 'bold', halign: 'center' },
        2: { fontStyle: 'bold' },
        3: { halign: 'center' },
        5: { halign: 'center' },
        7: { halign: 'center' }
      },
      headStyles: { fillColor: [44, 24, 76], textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: 'grid'
    });

    doc.save(`Cold_Chain_Locations_${selectedStateName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
            HPV Vaccination — Cold Chain Locations Registry
          </h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Comprehensive inventory of vaccine cold chain storage points (SVS, RVS, DVS &amp; Block CCPs)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadPDF}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Download PDF
          </button>
          <button
            onClick={downloadCSV}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Download CSV
          </button>
        </div>
      </div>

      {/* ── Filter Toolbar ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 shrink-0">
        <div className="flex flex-wrap gap-2.5 items-end">
          {/* State */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">State</label>
            <div className="relative">
              <select
                value={selectedStateId}
                onChange={(e) => setSelectedStateId(e.target.value)}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 appearance-none cursor-pointer"
                style={{ minWidth: 150 }}
              >
                {(states || []).map(s => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Level */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Level</label>
            <div className="relative">
              <select
                value={reportLevel}
                onChange={(e) => setReportLevel(e.target.value as any)}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 appearance-none cursor-pointer"
                style={{ minWidth: 120 }}
              >
                <option value="District">District</option>
                <option value="Block Units">Block Units</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* District */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">District</label>
            <div className="relative">
              <select
                value={selectedDistrictId}
                disabled={isDistrictUser}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 appearance-none cursor-pointer disabled:opacity-75"
                style={{ minWidth: 150 }}
              >
                <option value="ALL">All Districts</option>
                <option value="KUMAON">Kumaon Division</option>
                <option value="GARHWAL">Garhwal Division</option>
                {(allDistricts || []).map(d => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* CCL Level */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">CCL Level</label>
            <div className="relative">
              <select
                value={cclLevel}
                onChange={(e) => setCclLevel(e.target.value)}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 appearance-none cursor-pointer"
                style={{ minWidth: 140 }}
              >
                <option value="ALL">All Levels</option>
                <option value="1">Level 1 (SVS / RVS)</option>
                <option value="2">Level 2 (DVS)</option>
                <option value="3">Level 3 (CCP-B / Block CCP)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Unit Type */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Unit Type</label>
            <div className="relative">
              <select
                value={cclUnitType}
                onChange={(e) => setCclUnitType(e.target.value)}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 appearance-none cursor-pointer"
                style={{ minWidth: 140 }}
              >
                <option value="ALL">All Unit Types</option>
                <option value="SVS">SVS (State Store)</option>
                <option value="RVS">RVS (Regional Store)</option>
                <option value="DVS">DVS (District Store)</option>
                <option value="CCP-B">CCP-B (Block CCP)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Filter Action */}
          <button
            onClick={fetchLocations}
            disabled={loading}
            style={{ height: 36, borderRadius: 8, minWidth: 150 }}
            className="flex items-center justify-center gap-2 px-5 font-bold text-xs text-white bg-gradient-to-r from-[#3A0088] to-[#3A0088] hover:from-[#3A0088] hover:to-[#3A0088] rounded-lg transition-all shadow-md shadow-hpv-purple/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            {loading ? 'Loading...' : 'Filter Facilities'}
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      {!isExpanded && (
        <div className="shrink-0 p-1">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-hpv-purple" />
              <span className="text-xs font-bold text-slate-700">{selectedStateName}</span>
              <span className="text-[10px] text-slate-400">— Cold Chain Storage Network</span>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-hpv-purple-soft text-hpv-purple border border-hpv-purple-soft">
              Current Date: {currentDateFormatted}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
            <KpiCard loading={loading} icon={<Building2 className="w-4 h-4 text-hpv-purple" />} iconBg="bg-hpv-purple-soft"
              label="Total Cold Chain Points" value={kpis.total.toLocaleString('en-IN')} valueColor="text-hpv-purple"
              subLabel="Active facilities" />
            <KpiCard loading={loading} icon={<ShieldCheck className="w-4 h-4 text-hpv-purple" />} iconBg="bg-hpv-purple-soft"
              label="Level 1 (SVS / RVS)" value={kpis.l1.toLocaleString('en-IN')} valueColor="text-hpv-purple"
              subLabel="State & Regional Stores" />
            <KpiCard loading={loading} icon={<MapPin className="w-4 h-4 text-blue-600" />} iconBg="bg-blue-50"
              label="Level 2 (DVS)" value={kpis.l2.toLocaleString('en-IN')} valueColor="text-blue-700"
              subLabel="District Vaccine Stores" />
            <KpiCard loading={loading} icon={<Layers className="w-4 h-4 text-emerald-600" />} iconBg="bg-emerald-50"
              label="Level 3 (CCP-B)" value={kpis.l3.toLocaleString('en-IN')} valueColor="text-emerald-700"
              subLabel="Block Cold Chain Points" />
          </div>
        </div>
      )}

      {/* ── Data Table Container ───────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Table toolbar */}
        <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">
              {sortedRecords.length} Cold Chain Facility{sortedRecords.length !== 1 ? 'ies' : ''}
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
              placeholder="Search CCL ID or facility..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-hpv-purple/30 focus:border-hpv-purple"
              style={{ width: 220 }}
            />
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full" style={{ fontSize: '11px' }}>
            <thead className="sticky top-0 z-10">
              <tr className="gradient-header text-white shadow-sm">
                <th className="px-2.5 py-2 text-center font-bold uppercase tracking-wide w-12 border-b border-hpv-purple/40">S.No</th>
                <th className="px-3 py-2 text-left font-bold uppercase tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('ccl_id')}>CCL ID{renderSortIcon('ccl_id')}</th>
                <th className="px-3 py-2 text-left font-bold uppercase tracking-wide sticky left-0 gradient-header z-20 border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" style={{ minWidth: 180 }} onClick={() => handleSort('facility_name')}>Name of Facility{renderSortIcon('facility_name')}</th>
                <th className="px-3 py-2 text-center font-bold uppercase tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('unit_type')}>Unit Type{renderSortIcon('unit_type')}</th>
                <th className="px-3 py-2 text-left font-bold uppercase tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('blocks')}>Block / District{renderSortIcon('blocks')}</th>
                <th className="px-3 py-2 text-center font-bold uppercase tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('ccl_block_hq_yes')}>CCL Block HQ{renderSortIcon('ccl_block_hq_yes')}</th>
                <th className="px-3 py-2 text-left font-bold uppercase tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('name_of_unit_incharge')}>Incharge{renderSortIcon('name_of_unit_incharge')}</th>
                <th className="px-3 py-2 text-center font-bold uppercase tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('level')}>Level{renderSortIcon('level')}</th>
                <th className="px-3 py-2 text-left font-bold uppercase tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('health_facility_type')}>Health Facility Type{renderSortIcon('health_facility_type')}</th>
                <th className="px-3 py-2 text-left font-bold uppercase tracking-wide border-b border-hpv-purple/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('setting')}>Setting{renderSortIcon('setting')}</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-slate-100">
                    <td colSpan={10} className="px-3 py-2.5"><div className="h-4 bg-slate-200 rounded w-full" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-red-500 font-bold">
                    {error}
                  </td>
                </tr>
              ) : sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="w-10 h-10 text-slate-300" />
                      <p className="text-slate-400 font-semibold text-sm">No cold chain points match your selected filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const serialNo = (page - 1) * pageSize + idx + 1;
                  const blockName = row.blocks?.health_block_name || row.blocks?.name || '—';
                  const districtName = row.districts?.name || '—';
                  const isHq = row.ccl_block_hq_yes === 'Yes' || row.ccl_block_hq_yes === true || row.ccl_block_hq_yes === 1 || String(row.ccl_block_hq_yes).toLowerCase() === 'yes';
                  const isEven = idx % 2 === 0;
                  const rowBg = isEven ? 'bg-white' : 'bg-slate-50/60';

                  return (
                    <tr key={row.id || idx} className={`border-b border-slate-100 hover:bg-hpv-purple-soft/30 transition-colors group ${rowBg}`}>
                      <td className="px-2.5 py-2 text-center font-bold text-slate-400">{serialNo}</td>
                      <td className="px-3 py-2 font-bold text-hpv-purple whitespace-nowrap">
                        <span className="bg-hpv-purple-soft text-hpv-purple px-2 py-0.5 rounded border border-hpv-purple-soft font-mono text-[10px]">
                          {row.ccl_id || '—'}
                        </span>
                      </td>
                      <td className={`px-3 py-2 font-bold text-slate-900 text-xs sticky left-0 z-[5] border-r border-slate-100 ${rowBg} group-hover:bg-hpv-purple-soft/30`}>
                        {row.facility_name || '—'}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {row.unit_type === 'SVS' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-hpv-purple-soft text-hpv-purple border border-hpv-purple-soft">SVS</span>
                        ) : row.unit_type === 'RVS' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-300">RVS</span>
                        ) : row.unit_type === 'DVS' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-hpv-purple-soft text-hpv-purple border border-hpv-purple-soft">DVS</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">{row.unit_type || 'CCP-B'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-xs">{blockName}</div>
                        <div className="text-[10px] font-semibold text-slate-400">{districtName}</div>
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {isHq ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">Yes</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-300">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{row.name_of_unit_incharge || '—'}</div>
                        {row.contact_number && <div className="text-[10px] font-medium text-slate-400">Ph: {row.contact_number}</div>}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold bg-slate-100 text-slate-800 border border-slate-300">
                          Level {row.unit_level || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{row.health_facility_type || '—'}</td>
                      <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{row.setting || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-[10px] text-slate-500 font-medium">
              Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, filteredRecords.length)} of {filteredRecords.length}
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                </button>
                <span className="text-xs font-extrabold text-slate-800 px-1.5">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ColdChainLocations;
