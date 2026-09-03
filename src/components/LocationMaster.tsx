import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Layers, Filter, Building2, Download, FileText, Clock } from 'lucide-react';
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
    } else if (states.length > 0) {
      const uk = states.find(s => s.name.toLowerCase().includes('uttarakhand'));
      setSelectedStateId(String(uk ? uk.id : states[0].id));
    }
  }, [states, adminUser, selectedStateId]);

  useEffect(() => {
    if (isDistrictUser && adminUser?.district_id) {
      setSelectedDistrictId(String(adminUser.district_id));
    }
  }, [adminUser, isDistrictUser]);

  const selectedStateName = useMemo(() => {
    const found = states.find(s => String(s.id) === String(selectedStateId));
    return found ? found.name : 'Uttarakhand';
  }, [states, selectedStateId]);

  const currentDateFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      day: 'numeric',
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
    if (reportLevel === 'Block Units') {
      return filteredLocations.map(l => {
        const pop = l.population || 0;
        const annualTarget = Math.round(pop * 0.01);
        const hpvTarget = l.hpv_target || 0;
        return {
          id: l.id,
          name: l.name,
          subtext: `${l.district_name || '—'} • ${l.division_name || 'No Division'} • ${l.state_name || selectedStateName}`,
          population: pop,
          annualTarget,
          hpvTarget,
          sessions: l.sessions || 0,
          linelisted: l.linelisted || 0,
          vaccinated: l.vaccinated || 0,
          reportsCount: l.reports_count || 0,
          lastReportDate: l.last_reported_date || 'N/A'
        };
      });
    }

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

    return Object.values(districtMap);
  }, [filteredLocations, reportLevel, selectedStateName]);

  // CSV Export
  const downloadCSV = () => {
    const headers = [
      'S.No',
      'Location Unit',
      'Population',
      'Annual Target (Calculated 1%)',
      'HPV Target (Reported)',
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
      'HPV Target (Reported)',
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
      headStyles: { fillColor: [49, 16, 84], textColor: 255, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      theme: 'grid'
    });

    doc.save(`Block_Units_Report_${selectedStateName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 shadow-xs z-20 shrink-0">
        <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600 shrink-0" />
              <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                Block Units Master Registry
              </h1>
              <div className="ml-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-bold border border-slate-300">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Current Date: <strong className="text-slate-900">{currentDateFormatted}</strong></span>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Comprehensive block unit populations, sessions, targets, and cumulative vaccination metrics
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={downloadPDF}
              disabled={displayRows.length === 0}
              className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-red-600" />
              Export PDF
            </button>

            <button
              onClick={downloadCSV}
              disabled={displayRows.length === 0}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* TOP FILTER BAR: STATE, REPORT LEVEL, DISTRICTS */}
        <div className="px-5 py-2.5 bg-slate-100/80 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* 1. State Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" /> State:
              </span>
              <select
                value={selectedStateId}
                onChange={(e) => setSelectedStateId(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-xs focus:ring-2 focus:ring-indigo-500"
              >
                {(statesList || []).map(s => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* 2. Report Level Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" /> Report Level:
              </span>
              <select
                value={reportLevel}
                onChange={(e) => setReportLevel(e.target.value as any)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="District">District</option>
                <option value="Block Units">Block Units</option>
              </select>
            </div>

            {/* 3. District Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-indigo-600" /> Districts:
              </span>
              <select
                value={selectedDistrictId}
                disabled={isDistrictUser}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-xs focus:ring-2 focus:ring-indigo-500 disabled:opacity-75"
              >
                <option value="ALL">All Districts</option>
                <option value="KUMAON">Kumaon Division</option>
                <option value="GARHWAL">Garhwal Division</option>
                {(districtsList || []).map(d => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 p-3 sm:p-4 bg-slate-100 flex flex-col min-h-0 overflow-hidden">
        <div className="h-full bg-white rounded-xl shadow-xs border border-slate-200 flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1 p-12 text-slate-500">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
              <p className="font-bold text-slate-700 text-sm">Loading Location Registry Data...</p>
            </div>
          ) : displayRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 p-12 text-slate-500">
              <Building2 className="w-10 h-10 mb-2 text-slate-300" />
              <p className="font-bold text-slate-700 text-sm">No locations match your selected filters</p>
              <p className="text-xs text-slate-400 mt-0.5">Try selecting another district or state filter</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between overflow-x-auto overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[1000px]">
                <thead className="bg-[#311054] text-white sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 text-[11px] font-bold text-center w-12 border-b border-purple-900/40">S.No</th>
                    <th className="px-3 py-3 text-[11px] font-bold border-b border-purple-900/40">Location Hierarchy</th>
                    <th className="px-3 py-3 text-[11px] font-bold text-right border-b border-purple-900/40">Population</th>
                    <th className="px-3 py-3 text-[11px] font-bold text-right border-b border-purple-900/40">Annual Target (1%)</th>
                    <th className="px-3 py-3 text-[11px] font-bold text-right border-b border-purple-900/40">HPV Target (Reported)</th>
                    <th className="px-3 py-3 text-[11px] font-bold text-center border-b border-purple-900/40">Sessions</th>
                    <th className="px-3 py-3 text-[11px] font-bold text-right border-b border-purple-900/40">Line Listed</th>
                    <th className="px-3 py-3 text-[11px] font-bold text-right border-b border-purple-900/40">Vaccinated</th>
                    <th className="px-3 py-3 text-[11px] font-bold text-center border-b border-purple-900/40">Reports</th>
                    <th className="px-3 py-3 text-[11px] font-bold border-b border-purple-900/40">Last Report</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {displayRows.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-indigo-50/40 transition-colors">
                      {/* S.No */}
                      <td className="px-3 py-2.5 text-center font-bold text-slate-500 text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Location Hierarchy */}
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900 text-xs">{row.name}</div>
                        <div className="text-[10px] font-semibold text-slate-400">{row.subtext}</div>
                      </td>

                      {/* Population */}
                      <td className="px-3 py-2.5 text-right font-bold text-slate-800 text-[11px]">
                        {row.population > 0 ? row.population.toLocaleString('en-IN') : '—'}
                      </td>

                      {/* Annual Target (Calculated 1%) */}
                      <td className="px-3 py-2.5 text-right font-black text-indigo-900 bg-indigo-50/40 text-[11px]">
                        {row.annualTarget > 0 ? row.annualTarget.toLocaleString('en-IN') : '—'}
                      </td>

                      {/* HPV Target (Reported) */}
                      <td className="px-3 py-2.5 text-right font-black text-purple-900 bg-purple-50/40 text-[11px]">
                        {row.hpvTarget > 0 ? row.hpvTarget.toLocaleString('en-IN') : '—'}
                      </td>

                      {/* Sessions */}
                      <td className="px-3 py-2.5 text-center font-bold text-slate-700 text-[11px]">
                        {row.sessions}
                      </td>

                      {/* Line Listed */}
                      <td className="px-3 py-2.5 text-right font-bold text-amber-600 text-[11px]">
                        {row.linelisted > 0 ? row.linelisted.toLocaleString('en-IN') : '0'}
                      </td>

                      {/* Vaccinated */}
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-600 text-[11px]">
                        {row.vaccinated > 0 ? row.vaccinated.toLocaleString('en-IN') : '0'}
                      </td>

                      {/* Reports */}
                      <td className="px-3 py-2.5 text-center font-bold text-slate-600 text-[11px]">
                        {row.reportsCount}
                      </td>

                      {/* Last Report */}
                      <td className="px-3 py-2.5 font-medium text-slate-500 whitespace-nowrap text-[11px]">
                        {row.lastReportDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationMaster;
