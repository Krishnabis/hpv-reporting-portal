import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2, Download, Search, ChevronLeft, ChevronRight,
  Filter, MapPin, Clock, FileText, Layers, ShieldCheck, Tag
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

export const ColdChainLocations: React.FC<{
  states: any[];
  allDistricts: any[];
  masterBlocks: any[];
  divisions: any[];
  adminUser: any;
}> = ({ states, allDistricts, masterBlocks, adminUser }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    return new Date().toLocaleDateString('en-US', {
      day: 'numeric',
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

  // Client-side Filtered Records
  const filteredRecords = useMemo(() => {
    let list = ccpList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r =>
        (r.facility_name && r.facility_name.toLowerCase().includes(q)) ||
        (r.ccl_id && r.ccl_id.toLowerCase().includes(q)) ||
        (r.name_of_unit_incharge && r.name_of_unit_incharge.toLowerCase().includes(q)) ||
        (r.contact_number && r.contact_number.includes(q))
      );
    }

    return list;
  }, [ccpList, searchQuery]);

  // Paginated Rows
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page, pageSize]);

  // CSV Export Handler
  const downloadCSV = () => {
    const headers = [
      'S.No',
      'CCL ID',
      'Name of Facility',
      'Unit Type',
      'Block',
      'District',
      'CCL Block HQ (Yes)',
      'Incharge Name',
      'Contact Number',
      'Level',
      'Health Facility Type',
      'Setting'
    ];

    const csvRows = filteredRecords.map((r, i) => [
      i + 1,
      `"${r.ccl_id || '—'}"`,
      `"${r.facility_name || '—'}"`,
      `"${r.unit_type || '—'}"`,
      `"${r.blocks?.health_block_name || r.blocks?.name || '—'}"`,
      `"${r.districts?.name || '—'}"`,
      `"${(r.ccl_block_hq_yes === 'Yes' || r.ccl_block_hq_yes === true || r.ccl_block_hq_yes === 1 || String(r.ccl_block_hq_yes).toLowerCase() === 'yes') ? 'Yes' : 'No'}"`,
      `"${r.name_of_unit_incharge || '—'}"`,
      `"${r.contact_number || '—'}"`,
      `"Level ${r.unit_level || '—'}"`,
      `"${r.health_facility_type || '—'}"`,
      `"${r.setting || '—'}"`
    ]);

    const csvContent = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Cold_Chain_Locations_${selectedStateName.replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  // PDF Export Handler
  const downloadPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(49, 16, 84);
    doc.text(`Cold Chain Point Locations Report - ${selectedStateName}`, 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Locations: ${filteredRecords.length}  |  Generated Date: ${currentDateFormatted}`, 14, 22);

    const pdfHeaders = [[
      'S.No',
      'CCL ID',
      'Name of Facility',
      'Unit Type',
      'Block / District',
      'Block HQ',
      'Incharge & Contact',
      'Level',
      'Facility Type',
      'Setting'
    ]];

    const pdfRows = filteredRecords.map((r, i) => [
      i + 1,
      r.ccl_id || '—',
      r.facility_name || '—',
      r.unit_type || '—',
      `${r.blocks?.health_block_name || r.blocks?.name || '—'}\n(${r.districts?.name || '—'})`,
      (r.ccl_block_hq_yes === 'Yes' || r.ccl_block_hq_yes === true || r.ccl_block_hq_yes === 1 || String(r.ccl_block_hq_yes).toLowerCase() === 'yes') ? 'Yes' : 'No',
      `${r.name_of_unit_incharge || '—'}${r.contact_number ? `\nPh: ${r.contact_number}` : ''}`,
      `Level ${r.unit_level || '—'}`,
      r.health_facility_type || '—',
      r.setting || '—'
    ]);

    autoTable(doc, {
      head: pdfHeaders,
      body: pdfRows,
      startY: 26,
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        2: { fontStyle: 'bold' },
        3: { halign: 'center' },
        5: { halign: 'center' },
        7: { halign: 'center', fontStyle: 'bold' }
      },
      headStyles: { fillColor: [49, 16, 84], textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: 'grid'
    });

    doc.save(`Cold_Chain_Locations_${selectedStateName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200 shadow-xs z-20 shrink-0">
        <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600 shrink-0" />
              <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                Cold Chain Locations
              </h1>
              {/* CURRENT DATE DISPLAY */}
              <div className="ml-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-bold border border-slate-300">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Current Date: <strong className="text-slate-900">{currentDateFormatted}</strong></span>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Comprehensive inventory of vaccine cold chain storage points (SVS, RVS, DVS & Block CCPs)
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* EXPORT PDF BUTTON */}
            <button
              onClick={downloadPDF}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-red-600" />
              Export PDF
            </button>

            {/* EXPORT CSV BUTTON */}
            <button
              onClick={downloadCSV}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* TOP FILTER BAR */}
        <div className="px-5 py-2.5 bg-slate-100/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* 1. State Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3 h-3 text-indigo-600" /> State:
              </span>
              <select
                value={selectedStateId}
                onChange={(e) => setSelectedStateId(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1 shadow-xs focus:ring-2 focus:ring-indigo-500"
              >
                {(states || []).map(s => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* 2. Report Level Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3 text-indigo-600" /> Level:
              </span>
              <select
                value={reportLevel}
                onChange={(e) => setReportLevel(e.target.value as any)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1 shadow-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="District">District</option>
                <option value="Block Units">Block Units</option>
              </select>
            </div>

            {/* 3. District Filter (includes All, Kumaon, Garhwal, and individual districts) */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3 text-indigo-600" /> District:
              </span>
              <select
                value={selectedDistrictId}
                disabled={isDistrictUser}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-xs focus:ring-2 focus:ring-indigo-500 disabled:opacity-75"
              >
                <option value="ALL">All Districts</option>
                <option value="KUMAON">Kumaon Division</option>
                <option value="GARHWAL">Garhwal Division</option>
                {(allDistricts || []).map(d => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* 4. CCL Level Filter (L1, L2, L3) */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-indigo-600" /> CCL Level:
              </span>
              <select
                value={cclLevel}
                onChange={(e) => setCclLevel(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Levels</option>
                <option value="1">Level 1 (SVS / RVS)</option>
                <option value="2">Level 2 (DVS)</option>
                <option value="3">Level 3 (CCP-B / Block CCP)</option>
              </select>
            </div>

            {/* 5. CCL Unit Type Filter (SVS, RVS, DVS, CCP-B) */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3 text-indigo-600" /> Unit Type:
              </span>
              <select
                value={cclUnitType}
                onChange={(e) => setCclUnitType(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Unit Types</option>
                <option value="SVS">SVS (State Vaccine Store)</option>
                <option value="RVS">RVS (Regional Store)</option>
                <option value="DVS">DVS (District Store)</option>
                <option value="CCP-B">CCP-B (Block Cold Chain)</option>
              </select>
            </div>

          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search CCL ID or facility..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-3 sm:p-4 bg-slate-100 flex flex-col min-h-0 overflow-auto">
        
        {/* KPI SUMMARY CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3 shrink-0">
          {/* Card 1: Total Locations */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Cold Chain Points</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">{kpis.total.toLocaleString('en-IN')}</h3>
              <p className="text-[10px] font-semibold text-indigo-600 mt-0.5">Active facilities</p>
            </div>
            <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
          </div>

          {/* Card 2: Level 1 (SVS / RVS) */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Level 1 (SVS / RVS)</p>
              <h3 className="text-xl font-black text-purple-700 mt-0.5">{kpis.l1.toLocaleString('en-IN')}</h3>
              <p className="text-[10px] font-semibold text-purple-600 mt-0.5">State & Regional Stores</p>
            </div>
            <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-100">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
            </div>
          </div>

          {/* Card 3: Level 2 (DVS) */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Level 2 (DVS)</p>
              <h3 className="text-xl font-black text-blue-700 mt-0.5">{kpis.l2.toLocaleString('en-IN')}</h3>
              <p className="text-[10px] font-semibold text-blue-600 mt-0.5">District Vaccine Stores</p>
            </div>
            <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
          </div>

          {/* Card 4: Level 3 (CCP-B) */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Level 3 (CCP-B)</p>
              <h3 className="text-xl font-black text-emerald-700 mt-0.5">{kpis.l3.toLocaleString('en-IN')}</h3>
              <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">Block Cold Chain Points</p>
            </div>
            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
              <Layers className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>

        {/* TABLE CONTAINER */}
        <div className="flex-1 bg-white rounded-xl shadow-xs border border-slate-200 flex flex-col min-h-0 overflow-hidden">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1 p-12 text-slate-500">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
              <p className="font-bold text-slate-700 text-sm">Loading Cold Chain Locations...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center flex-1 p-12 text-red-500">
              <p className="font-bold text-sm">{error}</p>
              <button
                onClick={fetchLocations}
                className="mt-3 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold border border-red-200 hover:bg-red-100"
              >
                Retry Loading
              </button>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 p-12 text-slate-500">
              <Building2 className="w-10 h-10 mb-2 text-slate-300" />
              <p className="font-bold text-slate-700 text-sm">No cold chain points match your selected filters</p>
              <p className="text-xs text-slate-400 mt-0.5">Try adjusting the search query or level filters</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between overflow-x-auto overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[950px]">
                <thead className="bg-[#311054] text-white sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-[11px] font-bold text-center w-12 border-b border-purple-900/40">S.No</th>
                    <th className="px-3 py-3 text-[11px] font-bold border-b border-purple-900/40">CCL ID</th>
                    <th className="px-3 py-3 text-[11px] font-bold border-b border-purple-900/40">Name of Facility</th>
                    <th className="px-3 py-3 text-[11px] font-bold text-center border-b border-purple-900/40">Unit Type</th>
                    <th className="px-3 py-3 text-[11px] font-bold border-b border-purple-900/40">Block / District</th>
                    <th className="px-3 py-3 text-[11px] font-bold text-center border-b border-purple-900/40">CCL Block HQ</th>
                    <th className="px-3 py-3 text-[11px] font-bold border-b border-purple-900/40">Incharge</th>
                    <th className="px-3 py-3 text-[11px] font-bold text-center border-b border-purple-900/40">Level</th>
                    <th className="px-3 py-3 text-[11px] font-bold border-b border-purple-900/40">Health Facility Type</th>
                    <th className="px-3 py-3 text-[11px] font-bold border-b border-purple-900/40">Setting</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {paginatedRows.map((row, idx) => {
                    const serialNo = (page - 1) * pageSize + idx + 1;
                    const blockName = row.blocks?.health_block_name || row.blocks?.name || '—';
                    const districtName = row.districts?.name || '—';
                    const isHq = row.ccl_block_hq_yes === 'Yes' || row.ccl_block_hq_yes === true || row.ccl_block_hq_yes === 1 || String(row.ccl_block_hq_yes).toLowerCase() === 'yes';

                    return (
                      <tr key={row.id || idx} className="hover:bg-indigo-50/40 transition-colors">
                        {/* 1. S.No */}
                        <td className="px-3 py-2.5 text-center font-bold text-slate-500 text-[11px]">
                          {serialNo}
                        </td>

                        {/* 2. CCL ID */}
                        <td className="px-3 py-2.5 font-bold text-indigo-900 whitespace-nowrap text-[11px]">
                          <span className="bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200 font-mono">
                            {row.ccl_id || '—'}
                          </span>
                        </td>

                        {/* 3. Name of Facility */}
                        <td className="px-3 py-2.5 font-black text-slate-900 text-xs">
                          {row.facility_name || '—'}
                        </td>

                        {/* 4. Unit Type */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {row.unit_type === 'SVS' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300">
                              SVS
                            </span>
                          ) : row.unit_type === 'RVS' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                              RVS
                            </span>
                          ) : row.unit_type === 'DVS' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-300">
                              DVS
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {row.unit_type || 'CCP-B'}
                            </span>
                          )}
                        </td>

                        {/* 5. Block (District name below the block) */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-[11px]">{blockName}</div>
                          <div className="text-[10px] font-semibold text-slate-400">{districtName}</div>
                        </td>

                        {/* 6. CCL Block HQ (Yes/No) */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          {isHq ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-300">
                              No
                            </span>
                          )}
                        </td>

                        {/* 7. Incharge */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-bold text-slate-800 text-[11px]">{row.name_of_unit_incharge || '—'}</div>
                          {row.contact_number && (
                            <div className="text-[10px] font-medium text-slate-500">Ph: {row.contact_number}</div>
                          )}
                        </td>

                        {/* 8. Level */}
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-300">
                            Level {row.unit_level || '—'}
                          </span>
                        </td>

                        {/* 9. Health Facility Type */}
                        <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap text-[11px]">
                          {row.health_facility_type || '—'}
                        </td>

                        {/* 10. Setting */}
                        <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap text-[11px]">
                          {row.setting || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION FOOTER */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="text-xs font-semibold text-slate-600">
              Showing <span className="font-bold text-slate-900">{filteredRecords.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
              <span className="font-bold text-slate-900">{Math.min(page * pageSize, filteredRecords.length)}</span> of{' '}
              <span className="font-bold text-slate-900">{filteredRecords.length}</span> facilities
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 mr-3">
                <span className="text-xs text-slate-500 font-medium">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded px-2 py-1"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 bg-white border border-slate-300 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-800 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 bg-white border border-slate-300 rounded-md text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ColdChainLocations;
