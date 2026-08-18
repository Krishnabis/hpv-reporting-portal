import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, MapPin, Users, Settings as SettingsIcon,
  ShieldCheck, LogOut, Menu, X, Download, Filter, Search, Calendar,
  TrendingUp, CheckCircle, BarChart3, ChevronRight, Hash, Eye, RefreshCw, Save
} from 'lucide-react';
import { Logo } from '../components/Logo';

interface KPIState {
  total_blocks: number;
  reporting_today: number;
  total_line_list: number;
  total_vaccinated: number;
  total_target_pop: number;
  overall_coverage_pct: number;
  district_chart_data: Array<{
    district: string;
    vaccinated: number;
    lineList: number;
    target: number;
    coveragePct: number;
  }>;
}

interface ReportRow {
  id: number;
  name: string;
  lgd_code: number;
  district_name?: string;
  district_lgd_code?: number;
  state_name?: string;
  state_lgd_code?: number;
  population: number | null;
  hpv_target: number | null;
  last_reporting_date: string;
  line_list_received: number | null;
  beneficiaries_vaccinated: number | null;
  line_list_received_pct: number | null;
  vaccination_coverage_pct: number | null;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'locations' | 'users' | 'settings' | 'audit'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);

  // KPIs State
  const [kpis, setKpis] = useState<KPIState | null>(null);
  const [loadingKpis, setLoadingKpis] = useState(true);

  // Report Generator Filter State
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterLevel, setFilterLevel] = useState<'State' | 'District' | 'Block'>('District');
  const [filterStateId, setFilterStateId] = useState<string>('5');
  const [filterDistrictId, setFilterDistrictId] = useState<string>('ALL');
  const [filterBlockId, setFilterBlockId] = useState<string>('ALL');

  const [districtsList, setDistrictsList] = useState<any[]>([]);
  const [blocksList, setBlocksList] = useState<any[]>([]);

  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportViewMode, setReportViewMode] = useState<'table' | 'card'>('table');

  // Master Locations state
  const [masterBlocks, setMasterBlocks] = useState<any[]>([]);
  const [locationSearch, setLocationSearch] = useState('');

  // Settings state
  const [settingsList, setSettingsList] = useState<any[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Token Auth Verification
  useEffect(() => {
    const token = localStorage.getItem('hpv_admin_token');
    const userStr = localStorage.getItem('hpv_admin_user');
    if (!token || !userStr) {
      navigate('/admin/login');
      return;
    }
    setAdminUser(JSON.parse(userStr));
    fetchKpis();
    fetchDistricts();
    fetchReport();
    fetchSettings();
  }, []);

  const fetchKpis = () => {
    setLoadingKpis(true);
    fetch('/api/admin/kpis')
      .then(res => res.json())
      .then(data => {
        setKpis(data);
        setLoadingKpis(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingKpis(false);
      });
  };

  const fetchDistricts = () => {
    fetch('/api/locations/districts')
      .then(res => res.json())
      .then(data => setDistrictsList(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  };

  // Fetch blocks when district filter changes
  useEffect(() => {
    if (filterDistrictId && filterDistrictId !== 'ALL') {
      fetch(`/api/locations/blocks?districtId=${filterDistrictId}`)
        .then(res => res.json())
        .then(data => setBlocksList(Array.isArray(data) ? data : []))
        .catch(err => console.error(err));
    } else {
      setBlocksList([]);
      setFilterBlockId('ALL');
    }
  }, [filterDistrictId]);

  const fetchReport = () => {
    setLoadingReport(true);
    const params = new URLSearchParams({
      date: filterDate,
      level: filterLevel,
      districtId: filterDistrictId,
      blockId: filterBlockId
    });

    fetch(`/api/admin/reports/generate?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setReportRows(data.rows || []);
        setLoadingReport(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingReport(false);
      });
  };

  const fetchMasterLocations = () => {
    fetch('/api/locations/blocks')
      .then(res => res.json())
      .then(data => setMasterBlocks(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  };

  const fetchSettings = () => {
    fetch('/api/admin/settings')
      .then(res => res.json())
      .then(data => setSettingsList(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  };

  const fetchAuditLogs = () => {
    const token = localStorage.getItem('hpv_admin_token');
    fetch('/api/admin/audit-logs', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setAuditLogs(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  };

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    if (tab === 'locations') fetchMasterLocations();
    if (tab === 'settings') fetchSettings();
    if (tab === 'audit') fetchAuditLogs();
  };

  const handleLogout = () => {
    localStorage.removeItem('hpv_admin_token');
    localStorage.removeItem('hpv_admin_user');
    navigate('/admin/login');
  };

  // CSV Exporter
  const exportCSV = () => {
    if (!reportRows.length) return;
    const headers = [
      'Name',
      'LGD Code',
      'Level',
      'Population',
      'HPV Target',
      'Last Reporting Date',
      'Line List Received',
      'Beneficiaries Vaccinated',
      '% Line List Received',
      '% Vaccination Coverage'
    ];

    const csvData = reportRows.map(r => [
      `"${r.name}"`,
      r.lgd_code,
      filterLevel,
      r.population ?? '',
      r.hpv_target ?? '',
      `"${r.last_reporting_date}"`,
      r.line_list_received ?? '',
      r.beneficiaries_vaccinated ?? '',
      r.line_list_received_pct !== null ? `${r.line_list_received_pct}%` : '',
      r.vaccination_coverage_pct !== null ? `${r.vaccination_coverage_pct}%` : ''
    ]);

    const content = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `HPV_Report_${filterLevel}_${filterDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Settings Save
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    const token = localStorage.getItem('hpv_admin_token');

    fetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ settings: settingsList })
    })
      .then(res => res.json())
      .then(data => {
        setSavingSettings(false);
        alert('Settings updated successfully!');
      })
      .catch(err => {
        console.error(err);
        setSavingSettings(false);
        alert('Failed to update settings');
      });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row font-sans">
      {/* Mobile Topbar */}
      <div className="lg:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-40">
        <Logo size="sm" variant="light" />
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div>
          {/* Logo Branding */}
          <div className="p-6 border-b border-slate-800">
            <Logo size="md" variant="light" />
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1 text-sm font-semibold">
            <button
              onClick={() => handleTabChange('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-hpv-purple text-white font-bold'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-5 h-5 text-hpv-teal-light" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => handleTabChange('reports')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === 'reports'
                  ? 'bg-hpv-purple text-white font-bold'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileText className="w-5 h-5 text-hpv-pink" />
              <span>Reports</span>
            </button>

            <button
              onClick={() => handleTabChange('locations')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === 'locations'
                  ? 'bg-hpv-purple text-white font-bold'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <MapPin className="w-5 h-5 text-hpv-teal" />
              <span>Locations (LGD)</span>
            </button>

            <button
              onClick={() => handleTabChange('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === 'users'
                  ? 'bg-hpv-purple text-white font-bold'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Users className="w-5 h-5 text-indigo-400" />
              <span>Users</span>
            </button>

            <button
              onClick={() => handleTabChange('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === 'settings'
                  ? 'bg-hpv-purple text-white font-bold'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <SettingsIcon className="w-5 h-5 text-slate-400" />
              <span>Settings</span>
            </button>

            <button
              onClick={() => handleTabChange('audit')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === 'audit'
                  ? 'bg-hpv-purple text-white font-bold'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Audit Logs</span>
            </button>
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white">{adminUser?.name || 'Administrator'}</span>
              <span className="text-[11px] text-hpv-teal font-mono">@{adminUser?.username || 'UKHPV2026'}</span>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  HPV Executive Dashboard
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Statewide due list tracking & block reporting summary (Uttarakhand)
                </p>
              </div>

              <button
                onClick={fetchKpis}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 self-start sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh KPIs
              </button>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Blocks */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  TOTAL BLOCKS
                </span>
                <div className="my-2">
                  <span className="text-3xl font-extrabold font-mono text-slate-900">
                    {kpis ? kpis.total_blocks : '—'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">13 Districts in Uttarakhand</span>
              </div>

              {/* Card 2: Reporting Today */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  REPORTING TODAY
                </span>
                <div className="my-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold font-mono text-hpv-purple">
                    {kpis ? kpis.reporting_today : '—'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    / {kpis ? kpis.total_blocks : '—'}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-hpv-purple h-full transition-all"
                    style={{
                      width: `${kpis ? (kpis.reporting_today / (kpis.total_blocks || 1)) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Card 3: Total Line List */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  LINE LIST RECEIVED
                </span>
                <div className="my-2">
                  <span className="text-3xl font-extrabold font-mono text-hpv-teal">
                    {kpis ? kpis.total_line_list.toLocaleString() : '—'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">Cumulative line list entries</span>
              </div>

              {/* Card 4: Total Vaccinated */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  BENEFICIARIES VACCINATED
                </span>
                <div className="my-2">
                  <span className="text-3xl font-extrabold font-mono text-hpv-pink">
                    {kpis ? kpis.total_vaccinated.toLocaleString() : '—'}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold">
                  Coverage: {kpis ? kpis.overall_coverage_pct : 0}% of Target
                </span>
              </div>
            </div>

            {/* District Vaccination Coverage Breakdown */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-hpv-purple" /> District Vaccination Coverage Ranking
              </h3>

              {kpis?.district_chart_data && kpis.district_chart_data.length > 0 ? (
                <div className="space-y-4">
                  {kpis.district_chart_data.map(d => (
                    <div key={d.district} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-800 font-bold">{d.district}</span>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-slate-500">
                            Vaccinated: <strong className="text-slate-900">{d.vaccinated.toLocaleString()}</strong> / {d.target.toLocaleString()}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-hpv-purple-soft text-hpv-purple font-bold">
                            {d.coveragePct}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                        <div
                          className="gradient-header h-full transition-all duration-300"
                          style={{ width: `${Math.min(d.coveragePct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  No district report data calculated yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: REPORTS GENERATOR */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Admin Report Generator
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Generate State, District, or Block level cumulative reporting analytics
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={exportCSV}
                  disabled={!reportRows.length}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
            </div>

            {/* Filter Form Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">
                <Filter className="w-4 h-4 text-hpv-purple" /> Report Filters
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Field 1: Date */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Date</label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                {/* Field 2: Level */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Level</label>
                  <select
                    value={filterLevel}
                    onChange={e => setFilterLevel(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    <option value="State">State</option>
                    <option value="District">District</option>
                    <option value="Block">Block</option>
                  </select>
                </div>

                {/* Field 3: State */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">State</label>
                  <select
                    value={filterStateId}
                    onChange={e => setFilterStateId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    <option value="5">Uttarakhand (LGD: 5)</option>
                  </select>
                </div>

                {/* Field 4: District */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">District</label>
                  <select
                    value={filterDistrictId}
                    onChange={e => setFilterDistrictId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    <option value="ALL">All Districts</option>
                    {districtsList.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} (LGD: {d.lgd_code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Field 5: Block */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Block</label>
                  <select
                    value={filterBlockId}
                    onChange={e => setFilterBlockId(e.target.value)}
                    disabled={filterDistrictId === 'ALL'}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    <option value="ALL">All Blocks</option>
                    {blocksList.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} (LGD: {b.lgd_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={fetchReport}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white gradient-header shadow hover:shadow-md transition-all flex items-center gap-2"
                >
                  <Search className="w-4 h-4 text-hpv-teal-light" />
                  <span>GENERATE REPORT</span>
                </button>
              </div>
            </div>

            {/* Generated Report Output Table / Cards */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Report Result ({reportRows.length} Rows)
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-hpv-purple-soft text-hpv-purple font-mono font-bold">
                    Date: {filterDate}
                  </span>
                </div>

                {/* Mobile View Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setReportViewMode('table')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      reportViewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Table View
                  </button>
                  <button
                    onClick={() => setReportViewMode('card')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      reportViewMode === 'card' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Mobile Cards View
                  </button>
                </div>
              </div>

              {loadingReport ? (
                <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-3 border-hpv-purple border-t-transparent rounded-full animate-spin" />
                  <span>Generating aggregated report...</span>
                </div>
              ) : reportRows.length > 0 ? (
                reportViewMode === 'table' ? (
                  /* DESKTOP/TABLET TABLE VIEW */
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-white font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="p-3">District / Block</th>
                          <th className="p-3 font-mono">LGD Code</th>
                          <th className="p-3 text-right">Population</th>
                          <th className="p-3 text-right">HPV Target</th>
                          <th className="p-3 text-center">Last Report Date</th>
                          <th className="p-3 text-right">Line List Received</th>
                          <th className="p-3 text-right">Beneficiaries Vaccinated</th>
                          <th className="p-3 text-right">% Line List</th>
                          <th className="p-3 text-right">% Coverage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono">
                        {reportRows.map(row => (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="p-3 font-sans font-bold text-slate-900">
                              {row.name}
                              {row.district_name && (
                                <span className="block text-[11px] text-slate-400 font-normal">
                                  {row.district_name} District
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-500 font-bold">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {row.lgd_code}
                              </span>
                            </td>
                            <td className="p-3 text-right font-medium text-slate-700">
                              {row.population !== null ? row.population.toLocaleString() : '—'}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-900">
                              {row.hpv_target !== null ? row.hpv_target.toLocaleString() : '—'}
                            </td>
                            <td className="p-3 text-center text-slate-500 font-sans text-[11px]">
                              {row.last_reporting_date}
                            </td>
                            <td className="p-3 text-right font-semibold text-hpv-teal-dark">
                              {row.line_list_received !== null ? row.line_list_received.toLocaleString() : '—'}
                            </td>
                            <td className="p-3 text-right font-extrabold text-hpv-purple">
                              {row.beneficiaries_vaccinated !== null ? row.beneficiaries_vaccinated.toLocaleString() : '—'}
                            </td>
                            <td className="p-3 text-right">
                              {row.line_list_received_pct !== null ? (
                                <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-bold">
                                  {row.line_list_received_pct}%
                                </span>
                              ) : '—'}
                            </td>
                            <td className="p-3 text-right">
                              {row.vaccination_coverage_pct !== null ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                                  {row.vaccination_coverage_pct}%
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* MOBILE CARD VIEW */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {reportRows.map(row => (
                      <div key={row.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="font-extrabold text-slate-900 text-sm">{row.name}</span>
                          <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                            LGD: {row.lgd_code}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div>
                            <span className="text-slate-400 block font-sans">Population</span>
                            <span className="font-bold text-slate-800">{row.population?.toLocaleString() ?? '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-sans">HPV Target</span>
                            <span className="font-bold text-slate-800">{row.hpv_target?.toLocaleString() ?? '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-sans">Line List</span>
                            <span className="font-bold text-hpv-teal">{row.line_list_received?.toLocaleString() ?? '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-sans">Vaccinated</span>
                            <span className="font-bold text-hpv-purple">{row.beneficiaries_vaccinated?.toLocaleString() ?? '—'}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-bold">
                          <span className="text-sky-700 bg-sky-50 px-2 py-1 rounded">
                            Line List: {row.line_list_received_pct ?? 0}%
                          </span>
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                            Coverage: {row.vaccination_coverage_pct ?? 0}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  No records match selected filter criteria.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: LOCATIONS MASTER */}
        {activeTab === 'locations' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Master Location Registry (LGD Codes)
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Official Local Government Directory (LGD) Codes for States, Districts & Blocks
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <Search className="w-5 h-5 text-slate-400 ml-1" />
              <input
                type="text"
                value={locationSearch}
                onChange={e => setLocationSearch(e.target.value)}
                placeholder="Search block name, district, or LGD code..."
                className="w-full bg-transparent text-xs text-slate-900 focus:outline-none"
              />
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white font-semibold uppercase sticky top-0">
                    <tr>
                      <th className="p-3">State</th>
                      <th className="p-3">State LGD</th>
                      <th className="p-3">District</th>
                      <th className="p-3">District LGD</th>
                      <th className="p-3">Block Name</th>
                      <th className="p-3">Block LGD Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {masterBlocks
                      .filter(b => {
                        const q = locationSearch.toLowerCase();
                        if (!q) return true;
                        return (
                          b.name.toLowerCase().includes(q) ||
                          b.district_name.toLowerCase().includes(q) ||
                          String(b.lgd_code).includes(q) ||
                          String(b.district_lgd_code).includes(q)
                        );
                      })
                      .map(b => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="p-3 font-sans font-medium text-slate-700">{b.state_name}</td>
                          <td className="p-3 font-bold text-slate-500">{b.state_lgd_code}</td>
                          <td className="p-3 font-sans font-bold text-slate-900">{b.district_name}</td>
                          <td className="p-3 font-bold text-hpv-purple">{b.district_lgd_code}</td>
                          <td className="p-3 font-sans font-bold text-hpv-teal-dark">{b.name}</td>
                          <td className="p-3 font-extrabold text-slate-900">
                            <span className="px-2 py-0.5 rounded bg-hpv-purple-soft text-hpv-purple border border-hpv-purple/20">
                              {b.lgd_code}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: USERS MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Admin User Management
            </h1>
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-700">Authorized System Administrators</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                  Active
                </span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900 text-sm">State HPV Administrator (UKHPV2026)</p>
                  <p className="text-slate-500 mt-0.5">Role: SUPER_ADMIN • State of Uttarakhand</p>
                </div>
                <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">
                  Authenticated
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PROGRAM & SYSTEM SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Program & System Settings
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Configure growth formulas, target percentages, and reporting permissions
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {settingsList.map((item, idx) => (
                  <div key={item.key} className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      {item.key.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="text"
                      value={item.value}
                      onChange={e => {
                        const updated = [...settingsList];
                        updated[idx].value = e.target.value;
                        setSettingsList(updated);
                      }}
                      className="px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-hpv-purple"
                    />
                    <span className="text-[11px] text-slate-400">{item.description}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-6 py-3 rounded-xl font-bold text-xs text-white gradient-header shadow hover:shadow-md transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingSettings ? 'Saving Settings...' : 'Save Settings'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 6: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                System Audit Logs
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Complete audit trail of block reporting entries, baseline updates, and administrative actions
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white font-semibold uppercase sticky top-0">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">User</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Entity</th>
                      <th className="p-3">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="p-3 font-bold text-hpv-purple">{log.user_id}</td>
                        <td className="p-3 font-bold text-slate-900">{log.action}</td>
                        <td className="p-3 text-slate-600">{log.entity_type}</td>
                        <td className="p-3 text-slate-400">{log.ip_address || '127.0.0.1'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
