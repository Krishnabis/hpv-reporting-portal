import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, MapPin, Layers, Filter, Building2, Download, FileText, Clock,
  Maximize2, Minimize2, ChevronDown, BarChart3, RefreshCw, ArrowUp, ArrowDown
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LocationRecord {
  id: string | number;
  name: string;
  district_name?: string;
  district_id?: string | number;
  division_name?: string;
  state_name?: string;
  population?: number;
  annual_target?: number;
  hpv_target?: number;
  sessions?: number;
  linelisted?: number;
  vaccinated?: number;
  reports_count?: number;
  last_reported_date?: string;
  is_urban?: boolean;
}

export const LocationMaster: React.FC<{
  states?: any[];
  allDistricts?: any[];
  masterBlocks?: any[];
  divisions?: any[];
  adminUser?: any;
}> = ({ states: initialStates = [], allDistricts: initialDistricts = [], adminUser }) => {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const [statesList, setStatesList] = useState<any[]>(initialStates);
  const [districtsList, setDistrictsList] = useState<any[]>(initialDistricts);

  // Top Filters
  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [reportLevel, setReportLevel] = useState<'District' | 'Block Units'>('Block Units');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('ALL');

  const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');

  // District scoping for District users
  const isDistrictUser = adminUser?.district_id || adminUser?.role === 'DISTRICT_ADMIN' || String(adminUser?.ccl_unit_level) === '2';

  // Fallback fetch states if empty
  useEffect(() => {
    if (initialStates && initialStates.length > 0) {
      setStatesList(initialStates);
      return;
    }
    fetch('/api/locations/states', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then(data => setStatesList(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [initialStates]);

  // Fallback fetch districts if empty
  useEffect(() => {
    if (initialDistricts && initialDistricts.length > 0) {
      setDistrictsList(initialDistricts);
      return;
    }
    fetch('/api/locations/districts', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then(data => setDistrictsList(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [initialDistricts]);

  useEffect(() => {
    if (selectedStateId) return;
    if (adminUser?.state_id) {
      setSelectedStateId(String(adminUser.state_id));
    } else if (statesList.length > 0) {
      const uk = statesList.find(s => s.name.toLowerCase().includes('uttarakhand'));
      setSelectedStateId(String(uk ? uk.id : statesList[0].id));
    }
  }, [statesList, adminUser, selectedStateId]);

  useEffect(() => {
    if (isDistrictUser && adminUser?.district_id) {
      setSelectedDistrictId(String(adminUser.district_id));
    }
  }, [adminUser, isDistrictUser]);

  const selectedStateName = useMemo(() => {
    const found = statesList.find(s => String(s.id) === String(selectedStateId));
    return found ? found.name : 'Uttarakhand';
  }, [statesList, selectedStateId]);

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/locations-master-data', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching location master data:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  // Filter Locations based on top filters + search
  const filteredLocations = useMemo(() => {
    let list = locations;

    // District / Division filter
    if (isDistrictUser && adminUser?.district_id) {
      list = list.filter(l => String(l.district_id) === String(adminUser.district_id));
    } else if (selectedDistrictId && selectedDistrictId !== 'ALL') {
      if (selectedDistrictId.toUpperCase() === 'KUMAON') {
        const kumaonDists = ['almora', 'bageshwar', 'champawat', 'nainital', 'pithoragarh', 'udham singh nagar'];
        list = list.filter(l => kumaonDists.includes((l.district_name || '').toLowerCase()));
      } else if (selectedDistrictId.toUpperCase() === 'GARHWAL') {
        const garhwalDists = ['chamoli', 'dehradun', 'haridwar', 'pauri garhwal', 'rudraprayag', 'tehri garhwal', 'uttarkashi'];
        list = list.filter(l => garhwalDists.includes((l.district_name || '').toLowerCase()));
      } else {
        list = list.filter(l => String(l.district_id) === String(selectedDistrictId));
      }
    }

    // Search query filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(l =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.district_name && l.district_name.toLowerCase().includes(q)) ||
        (l.division_name && l.division_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [locations, selectedDistrictId, isDistrictUser, adminUser, search]);

  // Aggregate stats for district mode if level === 'District'
  const displayRows = useMemo(() => {
    let rows: any[] = [];
    if (reportLevel === 'Block Units') {
      rows = filteredLocations.map(l => {
        const pop = l.population || 0;
        const annualTarget = Math.round(pop * 0.01);
        const hpvTarget = l.hpv_target || 0;
        return {
          id: l.id,
          name: l.name,
          subtext: `${l.district_name || '—'} • ${l.division_name || 'No Division'}`,
          population: pop,
          annualTarget,
          hpvTarget,
          sessions: l.sessions || 0,
          linelisted: l.linelisted || 0,
          vaccinated: l.vaccinated || 0,
          reportsCount: l.reports_count || 0,
          lastReportDate: l.last_reported_date || 'N/A',
          is_urban: l.is_urban
        };
      });
    } else {

    // Aggregated District View
    const districtMap: { [key: string]: any } = {};
    filteredLocations.forEach(l => {
      const dName = l.district_name || 'Unknown';
      if (!districtMap[dName]) {
        districtMap[dName] = {
          id: dName,
          name: dName,
          subtext: `District Unit • ${l.state_name || selectedStateName}`,
          population: 0,
          annualTarget: 0,
          hpvTarget: 0,
          sessions: 0,
          linelisted: 0,
          vaccinated: 0,
          reportsCount: 0,
          lastReportDate: 'N/A'
        };
      }
      const pop = l.population || 0;
      districtMap[dName].population += pop;
      districtMap[dName].annualTarget += Math.round(pop * 0.01);
      districtMap[dName].hpvTarget += (l.hpv_target || 0);
      districtMap[dName].sessions += (l.sessions || 0);
      districtMap[dName].linelisted += (l.linelisted || 0);
      districtMap[dName].vaccinated += (l.vaccinated || 0);
      districtMap[dName].reportsCount += (l.reports_count || 0);
      if (l.last_reported_date && l.last_reported_date !== 'N/A') {
        districtMap[dName].lastReportDate = l.last_reported_date;
      }
    });

    rows = Object.values(districtMap);
    }
    
    if (sortConfig) {
      rows.sort((a: any, b: any) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return rows;
  }, [filteredLocations, reportLevel, selectedStateName, sortConfig]);

  const kpis = useMemo(() => {
    const totalUnits = displayRows.length;
    const totalPop = displayRows.reduce((s, r) => s + (r.population || 0), 0);
    const totalAnnualTarget = displayRows.reduce((s, r) => s + (r.annualTarget || 0), 0);
    const totalHpvTarget = displayRows.reduce((s, r) => s + (r.hpvTarget || 0), 0);
    const totalSessions = displayRows.reduce((s, r) => s + (r.sessions || 0), 0);
    const totalLineListed = displayRows.reduce((s, r) => s + (r.linelisted || 0), 0);
    const totalVaccinated = displayRows.reduce((s, r) => s + (r.vaccinated || 0), 0);
    const totalReports = displayRows.reduce((s, r) => s + (r.reportsCount || 0), 0);
    return { totalUnits, totalPop, totalAnnualTarget, totalHpvTarget, totalSessions, totalLineListed, totalVaccinated, totalReports };
  }, [displayRows]);

  // CSV Export
  const downloadCSV = () => {
    const headers = [
      'S.No',
      'Location Unit',
      'Population',
      'Annual Target (Calculated 1%)',
      'HPV Goal',
      'Sessions',
      'Line Listed',
      'Vaccinated',
      'Reports',
      'Last Report'
    ];

    const csvRows = displayRows.map((r, i) => [
      i + 1,
      `"${r.name} (${r.subtext})"`,
      r.population,
      r.annualTarget,
      r.hpvTarget,
      r.sessions,
      r.linelisted,
      r.vaccinated,
      r.reportsCount,
      `"${r.lastReportDate}"`
    ]);

    const csvContent = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Block_Units_Report_${selectedStateName.replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  // PDF Export
  const downloadPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(49, 16, 84);
    doc.text(`Block Units Location Master - ${selectedStateName}`, 14, 15);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Report Level: ${reportLevel}  |  Total Units: ${displayRows.length}  |  Generated: ${currentDateFormatted}`, 14, 22);

    const pdfHeaders = [[
      'S.No',
      'Location Unit',
      'Population',
      'Annual Target (1%)',
      'HPV Goal',
      'Sessions',
      'Line Listed',
      'Vaccinated',
      'Reports',
      'Last Report'
    ]];

    const pdfRows = displayRows.map((r, i) => [
      i + 1,
      `${r.name}\n(${r.subtext})`,
      r.population.toLocaleString('en-IN'),
      r.annualTarget.toLocaleString('en-IN'),
      r.hpvTarget.toLocaleString('en-IN'),
      r.sessions.toLocaleString('en-IN'),
      r.linelisted.toLocaleString('en-IN'),
      r.vaccinated.toLocaleString('en-IN'),
      r.reportsCount,
      r.lastReportDate
    ]);

    autoTable(doc, {
      head: pdfHeaders,
      body: pdfRows,
      startY: 26,
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        1: { fontStyle: 'bold' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'center' },
        6: { halign: 'right' },
        7: { halign: 'right', fontStyle: 'bold' },
        8: { halign: 'center' },
        9: { halign: 'center' }
      },
      headStyles: { fillColor: [44, 24, 76], textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: 'grid'
    });

    doc.save(`Block_Units_Report_${selectedStateName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortArrow = (key: string) => {
    if (sortConfig?.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1" /> : <ArrowDown className="inline w-3 h-3 ml-1" />;
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
            HPV Vaccination — Block Units Registry
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadPDF}
            disabled={displayRows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export PDF
          </button>
          <button
            onClick={downloadCSV}
            disabled={displayRows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Filter Toolbar ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 shrink-0">
        <div className="flex flex-wrap gap-2.5 items-end">
          {/* State Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">State</label>
            <div className="relative">
              <select
                value={selectedStateId}
                onChange={(e) => setSelectedStateId(e.target.value)}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer"
                style={{ minWidth: 160 }}
              >
                {(statesList || []).map(s => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Report Level Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Report Level</label>
            <div className="relative">
              <select
                value={reportLevel}
                onChange={(e) => setReportLevel(e.target.value as any)}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer"
                style={{ minWidth: 130 }}
              >
                <option value="District">District</option>
                <option value="Block Units">Block Units</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* District Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">District</label>
            <div className="relative">
              <select
                value={selectedDistrictId}
                disabled={isDistrictUser}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="pl-2.5 pr-8 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 appearance-none cursor-pointer disabled:opacity-75"
                style={{ minWidth: 160 }}
              >
                <option value="ALL">All Districts</option>
                <option value="KUMAON">Kumaon Division</option>
                <option value="GARHWAL">Garhwal Division</option>
                {(districtsList || []).map(d => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Filter Units Action */}
          <button
            onClick={fetchLocations}
            disabled={loading}
            style={{ height: 36, borderRadius: 8, minWidth: 160 }}
            className="flex items-center justify-center gap-2 px-5 font-bold text-xs text-white bg-gradient-to-r from-[#3A0088] to-[#3A0088] hover:from-[#3A0088] hover:to-[#3A0088] rounded-lg transition-all shadow-md shadow-purple-900/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            {loading ? 'Loading...' : 'Filter Units'}
          </button>
        </div>
      </div>

      {/* ── Data Table Container ───────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Table toolbar */}
        <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-700">
              {displayRows.length} {reportLevel === 'Block Units' ? 'Block Unit' : 'District'}{displayRows.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
              style={{ width: 200 }}
            />
          </div>
        </div>

        {/* Scrollable table */}
        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full" style={{ fontSize: '11px' }}>
            <thead className="sticky top-0 z-10">
              <tr className="gradient-header text-white">
                <th className="px-2.5 py-2 text-center font-bold uppercase tracking-wide w-12 border-b border-purple-900/40">S.No</th>
                <th className="px-3 py-2 text-left font-bold uppercase tracking-wide sticky left-0 gradient-header z-20 border-b border-purple-900/40 cursor-pointer hover:bg-white/10" style={{ minWidth: 180 }} onClick={() => handleSort('name')}>Location Hierarchy{renderSortArrow('name')}</th>
                <th className="px-3 py-2 text-center font-bold uppercase tracking-wide border-b border-purple-900/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('population')}>Population{renderSortArrow('population')}</th>
                <th className="px-3 py-2 text-center font-bold uppercase tracking-wide border-b border-purple-900/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('annualTarget')}>Annual Target (1%){renderSortArrow('annualTarget')}</th>
                <th className="px-3 py-2 text-center font-bold uppercase tracking-wide border-b border-purple-900/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('hpvTarget')}>HPV Goal{renderSortArrow('hpvTarget')}</th>
                <th className="px-3 py-2 text-center font-bold uppercase tracking-wide border-b border-purple-900/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('sessions')}>Sessions{renderSortArrow('sessions')}</th>
                <th className="px-3 py-2 text-center font-bold uppercase tracking-wide border-b border-purple-900/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('linelisted')}>Line Listed{renderSortArrow('linelisted')}</th>
                <th className="px-3 py-2 text-center font-bold uppercase tracking-wide border-b border-purple-900/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('vaccinated')}>Vaccinated{renderSortArrow('vaccinated')}</th>
                <th className="px-3 py-2 text-center font-bold uppercase tracking-wide border-b border-purple-900/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('reportsCount')}>Reports{renderSortArrow('reportsCount')}</th>
                <th className="px-3 py-2 text-center font-bold uppercase tracking-wide border-b border-purple-900/40 cursor-pointer hover:bg-white/10" onClick={() => handleSort('lastReportDate')}>Last Report{renderSortArrow('lastReportDate')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-slate-100">
                    <td colSpan={10} className="px-3 py-2.5"><div className="h-4 bg-slate-200 rounded w-full" /></td>
                  </tr>
                ))
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 className="w-10 h-10 text-slate-300" />
                      <p className="text-slate-400 font-semibold text-sm">No matching locations found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayRows.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  const rowBg = isEven ? 'bg-white' : 'bg-slate-50/60';
                  return (
                    <tr key={row.id || idx} className={`border-b border-slate-100 hover:bg-purple-50/30 transition-colors group ${rowBg}`}>
                      <td className="px-2.5 py-2 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className={`px-3 py-2 font-bold text-slate-800 sticky left-0 z-[5] border-r border-slate-100 ${rowBg} group-hover:bg-purple-50/30`}>
                        <div className="text-slate-900 text-xs font-bold flex items-center gap-1.5">
                          <span>{row.name}</span>
                          {(row.is_urban || (row.name && row.name.toLowerCase().includes('urban'))) && (
                            <span className="text-[8px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded uppercase tracking-wider border border-purple-200">
                              Urban
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400">{row.subtext}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-semibold text-slate-700">{row.population > 0 ? row.population.toLocaleString('en-IN') : '—'}</td>
                      <td className="px-3 py-2 text-center font-bold text-indigo-900 bg-indigo-50/40">{row.annualTarget > 0 ? row.annualTarget.toLocaleString('en-IN') : '—'}</td>
                      <td className="px-3 py-2 text-center font-bold text-purple-900 bg-purple-50/40">{row.hpvTarget > 0 ? row.hpvTarget.toLocaleString('en-IN') : '—'}</td>
                      <td className="px-3 py-2 text-center font-bold text-slate-700">{row.sessions}</td>
                      <td className="px-3 py-2 text-center font-bold text-amber-600">{row.linelisted > 0 ? row.linelisted.toLocaleString('en-IN') : '0'}</td>
                      <td className="px-3 py-2 text-center font-bold text-emerald-600">{row.vaccinated > 0 ? row.vaccinated.toLocaleString('en-IN') : '0'}</td>
                      <td className="px-3 py-2 text-center font-semibold text-slate-600">{row.reportsCount}</td>
                      <td className="px-3 py-2 text-center font-medium text-slate-500 whitespace-nowrap">{row.lastReportDate}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && displayRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#3A0088]/20 font-bold text-slate-800" style={{ background: 'rgba(58,0,136,0.04)', fontSize: '11px' }}>
                  <td className="px-2.5 py-2 text-center text-slate-400">—</td>
                  <td className="px-3 py-2 font-extrabold sticky left-0 border-r border-slate-200" style={{ background: 'rgba(58,0,136,0.04)' }}>
                    TOTAL ({displayRows.length} Units)
                  </td>
                  <td className="px-3 py-2 text-center">{kpis.totalPop.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-center text-indigo-900">{kpis.totalAnnualTarget.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-center text-purple-900">{kpis.totalHpvTarget.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-center text-slate-700">{kpis.totalSessions.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-center text-amber-600">{kpis.totalLineListed.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-center text-emerald-600">{kpis.totalVaccinated.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-center text-slate-600">{kpis.totalReports.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-center text-slate-400">—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default LocationMaster;
