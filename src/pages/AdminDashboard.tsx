import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, MapPin, Users, Settings as SettingsIcon,
  ShieldCheck, LogOut, Menu, X, Download, Filter, Search, Calendar,
  TrendingUp, CheckCircle, BarChart3, ChevronRight, ChevronLeft, ChevronDown, Hash, Eye, RefreshCw, Save,
  Building2, ClipboardList, FileSpreadsheet, Target, Bell
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { SearchableSelect, OptionItem } from '../components/SearchableSelect';
import { AdminTrend } from '../components/AdminTrend';
import { UttarakhandMap, getTier } from '../components/UttarakhandMap';
import { AdminPopulation } from '../components/AdminPopulation';

interface KPIState {
  total_blocks: number;
  reporting_today: number;
  total_line_list: number;
  total_vaccinated: number;
  total_target: number;
  overall_coverage_pct: number;
  overall_linelist_pct: number;
  district_chart_data: Array<{
    district: string;
    vaccinated: number;
    lineList: number;
    target: number;
    coveragePct: number;
    lineListPct: number;
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'trend' | 'locations' | 'users' | 'settings' | 'audit' | 'population'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
  const [reportSortOrder, setReportSortOrder] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportViewMode, setReportViewMode] = useState<'table' | 'card'>('table');

  // Master Locations state
  const [masterBlocks, setMasterBlocks] = useState<any[]>([]);
  const [locationSearch, setLocationSearch] = useState('');
  const [statesList, setStatesList] = useState<any[]>([]);
  const [allDistrictsList, setAllDistrictsList] = useState<any[]>([]);
  // Location add form
  const [addLocType, setAddLocType] = useState<'state' | 'district' | 'block' | 'urban'>('block');
  const [addLocName, setAddLocName] = useState('');
  const [addLocLgd, setAddLocLgd] = useState('');
  const [addLocStateId, setAddLocStateId] = useState('');
  const [addLocDistrictId, setAddLocDistrictId] = useState('');
  const [addLocMsg, setAddLocMsg] = useState('');
  const [addLocLoading, setAddLocLoading] = useState(false);

  // Settings state — password change only
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Users state
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('ADMIN');
  const [addAdminMsg, setAddAdminMsg] = useState('');
  const [addAdminLoading, setAddAdminLoading] = useState(false);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Dashboard KPI selector
  const [selectedKpi, setSelectedKpi] = useState<'coverage' | 'linelist' | 'both'>('coverage');

  // Alerts Count
  const [alertCount, setAlertCount] = useState(0);

  // Token Auth Verification
  useEffect(() => {
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    const userStr = (localStorage.getItem('hpv_admin_user') || sessionStorage.getItem('hpv_admin_user'));
    if (!token || !userStr) {
      navigate('/admin/login');
      return;
    }
    setAdminUser(JSON.parse(userStr));
    fetchKpis();
    fetchDistricts();
    fetchMasterLocations();
    fetchReport();
    fetchAlertCount();
  }, []);

  const fetchAlertCount = () => {
    fetch('/api/admin/population-setup', {
      headers: { 'Authorization': `Bearer ${(localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'))}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAlertCount(data.filter(item => item.profile?.unlock_requested).length);
        }
      })
      .catch(err => console.error(err));
  };

  const fetchKpis = () => {
    setLoadingKpis(true);
    fetch(`/api/admin/kpis?date=${filterDate}`, {
      headers: { 'Authorization': `Bearer ${(localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'))}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch KPIs');
        return res.json();
      })
      .then(data => {
        setKpis(data);
        setLoadingKpis(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingKpis(false);
      });
  };

  // Re-fetch when date changes
  useEffect(() => {
    if (adminUser) {
      fetchKpis();
      fetchReport();
    }
  }, [filterDate]);

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

    fetch(`/api/admin/reports/generate?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${(localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'))}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch reports');
        return res.json();
      })
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
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    Promise.all([
      fetch('/api/locations/blocks').then(r => r.json()),
      fetch('/api/locations/states').then(r => r.json()),
      fetch('/api/locations/districts').then(r => r.json()),
    ]).then(([blocks, states, districts]) => {
      setMasterBlocks(Array.isArray(blocks) ? blocks : []);
      setStatesList(Array.isArray(states) ? states : []);
      setAllDistrictsList(Array.isArray(districts) ? districts : []);
    }).catch(err => console.error(err));
  };

  const fetchAdminUsers = () => {
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setAdminUsers(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  };

  const fetchAuditLogs = () => {
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    fetch('/api/admin/audit-logs', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setAuditLogs(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwNew !== pwConfirm) { setPwMsg('❌ New passwords do not match'); return; }
    if (pwNew.length < 6) { setPwMsg('❌ Password must be at least 6 characters'); return; }
    setPwLoading(true); setPwMsg('');
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew })
      });
      const data = await res.json();
      if (!res.ok) { setPwMsg(`❌ ${data.error}`); } else {
        setPwMsg('✅ Password changed successfully!');
        setPwCurrent(''); setPwNew(''); setPwConfirm('');
      }
    } catch { setPwMsg('❌ Request failed'); }
    setPwLoading(false);
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddAdminLoading(true); setAddAdminMsg('');
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newAdminName, username: newAdminUsername, password: newAdminPassword, role: newAdminRole })
      });
      const data = await res.json();
      if (!res.ok) { setAddAdminMsg(`❌ ${data.error}`); } else {
        setAddAdminMsg('✅ Admin created successfully!');
        setNewAdminName(''); setNewAdminUsername(''); setNewAdminPassword('');
        fetchAdminUsers();
      }
    } catch { setAddAdminMsg('❌ Request failed'); }
    setAddAdminLoading(false);
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLocLoading(true); setAddLocMsg('');
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    try {
      let url = ''; let body: any = {};
      if (addLocType === 'state') {
        url = '/api/admin/locations/state'; body = { name: addLocName, lgd_code: addLocLgd };
      } else if (addLocType === 'district') {
        url = '/api/admin/locations/district'; body = { name: addLocName, lgd_code: addLocLgd, state_id: addLocStateId };
      } else {
        url = '/api/admin/locations/block'; body = { name: addLocName, lgd_code: addLocLgd, district_id: addLocDistrictId, is_urban: addLocType === 'urban' };
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) { setAddLocMsg(`❌ ${data.error}`); } else {
        setAddLocMsg(`✅ ${data.message}`);
        setAddLocName(''); setAddLocLgd(''); setAddLocStateId(''); setAddLocDistrictId('');
        fetchMasterLocations();
      }
    } catch { setAddLocMsg('❌ Request failed'); }
    setAddLocLoading(false);
  };

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    if (tab === 'locations') fetchMasterLocations();
    if (tab === 'users') fetchAdminUsers();
    if (tab === 'audit') fetchAuditLogs();
  };

  const handleLogout = () => {
    localStorage.removeItem('hpv_admin_token');
    localStorage.removeItem('hpv_admin_user');
    sessionStorage.removeItem('hpv_admin_token');
    sessionStorage.removeItem('hpv_admin_user');
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




  const sortedReportRows = useMemo(() => {
    let sorted = [...reportRows];
    sorted.sort((a, b) => {
      if (reportSortOrder === 'coverage_desc') return (b.vaccination_coverage_pct || 0) - (a.vaccination_coverage_pct || 0);
      if (reportSortOrder === 'coverage_asc') return (a.vaccination_coverage_pct || 0) - (b.vaccination_coverage_pct || 0);
      if (reportSortOrder === 'linelist_desc') return (b.line_list_received_pct || 0) - (a.line_list_received_pct || 0);
      if (reportSortOrder === 'linelist_asc') return (a.line_list_received_pct || 0) - (b.line_list_received_pct || 0);
      return 0;
    });
    return sorted;
  }, [reportRows, reportSortOrder]);

  const totalRows = reportRows.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  
  const paginatedReportRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedReportRows.slice(start, start + rowsPerPage);
  }, [sortedReportRows, currentPage, rowsPerPage]);

  const totalTarget = reportRows.reduce((sum, r) => sum + (r.hpv_target || 0), 0);
  const totalLL = reportRows.reduce((sum, r) => sum + (r.line_list_received || 0), 0);
  const totalVacc = reportRows.reduce((sum, r) => sum + (r.beneficiaries_vaccinated || 0), 0);

  return (
    <div className="h-[100dvh] w-full bg-slate-100 flex flex-col lg:flex-row font-sans overflow-hidden">
      {/* Mobile Topbar */}
      <div className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="bg-white rounded-[2rem] px-3 py-1 flex items-center justify-center shadow-sm shrink-0 border border-slate-200">
          <img src="/loginlogo.png" alt="HPV Kavach Login Logo" className="h-10 w-auto object-contain" />
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 text-slate-600 flex flex-col justify-between transition-all duration-300 lg:sticky lg:top-0 lg:h-[100dvh] lg:shrink-0 ${
        mobileMenuOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full w-64'
      } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} lg:translate-x-0`}>
        <div>
          {/* Logo Branding */}
          <div className={`p-4 border-b border-slate-200 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className={`${sidebarCollapsed ? 'lg:hidden' : 'block flex-1 min-w-0 mr-2'}`}>
              <div className="bg-white rounded-[2rem] px-3 py-1.5 flex items-center justify-center shadow-sm shrink-0 border border-slate-200">
                <img src="/headinglogo.png" alt="HPV Kavach Logo" className="h-12 w-auto object-contain" />
              </div>
            </div>
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 shrink-0"
              title="Toggle Sidebar"
            >
              {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
            <button
              onClick={() => { handleTabChange('dashboard'); setMobileMenuOpen(false); }}
              title="Dashboard"
              className={`w-full flex items-center ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-50 text-emerald-600 font-bold shadow-sm shadow-emerald-600/10'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className={`w-5 h-5 shrink-0 ${activeTab === 'dashboard' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Dashboard</span>
            </button>

            <button
              onClick={() => { handleTabChange('reports'); setMobileMenuOpen(false); }}
              title="Reports & Analytics"
              className={`w-full flex items-center ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'reports'
                  ? 'bg-emerald-50 text-emerald-600 font-bold shadow-sm shadow-emerald-600/10'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileText className={`w-5 h-5 shrink-0 ${activeTab === 'reports' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Reports</span>
            </button>

            <button
              onClick={() => handleTabChange('population')}
              title="Alerts"
              className={`w-full flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                activeTab === 'population'
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-600'
              }`}
            >
              <div className="relative">
                <Bell className={`w-5 h-5 shrink-0 ${activeTab === 'population' ? 'text-emerald-600' : 'text-slate-400'}`} />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                )}
              </div>
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Alerts</span>
              {alertCount > 0 && !sidebarCollapsed && (
                <span className="ml-auto bg-rose-100 text-rose-600 py-0.5 px-2 rounded-full text-[10px] font-bold">
                  {alertCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleTabChange('trend')}
              title="Trend"
              className={`w-full flex items-center ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'trend'
                  ? 'bg-emerald-50 text-emerald-600 font-bold shadow-sm shadow-emerald-600/10'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <TrendingUp className={`w-5 h-5 shrink-0 ${activeTab === 'trend' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Trend</span>
            </button>

            <button
              onClick={() => { handleTabChange('settings'); setMobileMenuOpen(false); }}
              title="Settings"
              className={`w-full flex items-center ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'settings'
                  ? 'bg-emerald-50 text-emerald-600 font-bold shadow-sm shadow-emerald-600/10'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <SettingsIcon className={`w-5 h-5 shrink-0 ${activeTab === 'settings' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Settings</span>
            </button>

          </nav>
        </div>

        {/* User Info & Logout */}
        <div className={`mx-3 mt-auto mb-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer group flex items-center ${sidebarCollapsed ? 'p-2 justify-center lg:mx-2 lg:mb-2' : 'p-4 justify-between'}`} onClick={() => { setMobileMenuOpen(false); handleLogout(); }} title="Logout">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-hpv-teal-soft flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-hpv-teal-dark" />
            </div>
            <div className={`flex flex-col ${sidebarCollapsed ? 'hidden' : 'flex'}`}>
              <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-800 transition-colors line-clamp-1">{adminUser?.name || 'State HPV Administrator'}</span>
              <span className="text-[10px] text-slate-500 font-mono">@{adminUser?.username || 'UKHPV2026'}</span>
            </div>
          </div>
          <LogOut className={`w-4 h-4 text-slate-400 group-hover:text-rose-500 transition-colors shrink-0 ${sidebarCollapsed ? 'hidden' : 'block'}`} />
        </div>

        {/* Footer Branding */}
        <div className={`mx-3 mb-4 flex flex-col gap-2 ${sidebarCollapsed ? 'items-center' : ''}`}>
          {!sidebarCollapsed && (
            <div className="text-center font-medium text-[10px] text-slate-400 px-1 leading-snug">
              HPV Vaccination Program<br/>Version: 1.0 • UK 2026
            </div>
          )}
          <div className="flex items-center justify-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
            {!sidebarCollapsed && <span className="text-[10px] font-bold text-slate-400">Powered by:</span>}
            <img src="/impactcode.png" alt="ImpactCode" className="h-3 object-contain" />
          </div>
        </div>
      </aside>


      {/* Main Area — flex column, fills remaining height */}
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden p-3 sm:p-4 w-full max-w-full">
        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col min-h-full lg:h-full gap-2 lg:min-h-0 max-w-7xl mx-auto w-full pb-10 lg:pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Monitoring Dashboard: Uttarakhand
                </h1>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium italic">
                  (Track progress and performance for timely action.)
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchKpis}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-blue-600 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh KPIs
                </button>
                <div className="relative">
                  <input
                    type="date"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    className="px-3 py-1.5 pl-8 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors w-[140px]"
                  />
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                </div>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {/* Card 1: Total Population */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden border-t-4 border-t-blue-500 flex flex-col justify-between">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shrink-0 shadow-inner shadow-white/20">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate">
                      TOTAL POPULATION
                    </span>
                    <span className="text-2xl font-extrabold font-mono text-slate-900 leading-none mt-1">
                      {kpis?.total_target ? (kpis.total_target * 100).toLocaleString() : '—'}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between z-10 relative">
                  <span className="text-[9px] text-slate-400">HPV Target population (1%)</span>
                  <span className="text-[10px] font-bold font-mono text-slate-700">{kpis?.total_target?.toLocaleString() || '—'}</span>
                </div>
              </div>

              {/* Card 2: Reporting Today */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden border-t-4 border-t-purple-500 flex flex-col justify-between">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center shrink-0 shadow-inner shadow-white/20">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate">
                      TOTAL REPORTING SITES
                    </span>
                    <span className="text-2xl font-extrabold font-mono text-slate-900 leading-none mt-1">
                      {kpis ? kpis.total_blocks : '—'}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[9px] text-slate-400">Reporting today</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded font-mono">
                      {kpis ? ((kpis.reporting_today / (kpis.total_blocks || 1)) * 100).toFixed(1) : '0'}%
                    </span>
                    <span className="text-[10px] font-bold font-mono text-slate-700">{kpis ? kpis.reporting_today : '0'}</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Total Line List */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden border-t-4 border-t-emerald-500 flex flex-col justify-between">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 shadow-inner shadow-white/20">
                    <FileSpreadsheet className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate">
                      ELIGIBLE GIRLS LINE LISTED
                    </span>
                    <span className="text-2xl font-extrabold font-mono text-emerald-600 leading-none mt-1">
                      {kpis ? kpis.overall_linelist_pct : 0}%
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[9px] text-slate-400">Count:</span>
                  <span className="text-[10px] font-bold font-mono text-slate-700">{kpis?.total_line_list?.toLocaleString() || '—'}</span>
                </div>
              </div>

              {/* Card 4: Total Vaccinated */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden border-t-4 border-t-rose-500 flex flex-col justify-between">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center shrink-0 shadow-inner shadow-white/20">
                    <ShieldCheck className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate">
                      ELIGIBLE GIRLS VACCINATED
                    </span>
                    <span className="text-2xl font-extrabold font-mono text-rose-500 leading-none mt-1">
                      {kpis ? kpis.overall_coverage_pct : 0}%
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[9px] text-slate-400">Count:</span>
                  <span className="text-[10px] font-bold font-mono text-slate-700">{kpis?.total_vaccinated?.toLocaleString() || '—'}</span>
                </div>
              </div>
            </div>

            {/* Split Layout: Ranking & Map — flex-1 fills remaining height */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-2 flex-none lg:flex-1 lg:min-h-0">
              {/* Left Column: District Ranking + Banner */}
              <div className="lg:col-span-2 flex flex-col gap-2 lg:min-h-0">
                {/* District Ranking */}
                <div className="bg-white p-2 lg:p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 lg:overflow-hidden min-h-[400px] lg:min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-blue-500" /> District Ranking
                  </h3>
                  <select
                    value={selectedKpi}
                    onChange={e => setSelectedKpi(e.target.value as 'coverage' | 'linelist' | 'both')}
                    className="px-2 py-1 rounded-md border border-slate-200 text-[10px] font-semibold text-slate-700 focus:outline-none focus:border-blue-500 bg-white cursor-pointer"
                  >
                    <option value="coverage">% Vaccination Coverage</option>
                    <option value="linelist">% Line List</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                {/* Tier Legend */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {[{l:'Aspirational',b:'bg-red-100',t:'text-red-700',v:'<30%'},{l:'Progressing',b:'bg-yellow-100',t:'text-yellow-700',v:'30–70%'},{l:'High Performing',b:'bg-blue-100',t:'text-blue-700',v:'70–90%'},{l:'Champions',b:'bg-emerald-100',t:'text-emerald-700',v:'>90%'}].map(tier => (
                    <span key={tier.l} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${tier.b} ${tier.t}`}>{tier.l} {tier.v}</span>
                  ))}
                </div>

                {kpis?.district_chart_data && kpis.district_chart_data.length > 0 ? (
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 lg:content-between h-full min-h-max">
                    {[...kpis.district_chart_data]
                       .sort((a, b) => {
                        const pa = selectedKpi === 'linelist' ? a.lineListPct : a.coveragePct;
                        const pb = selectedKpi === 'linelist' ? b.lineListPct : b.coveragePct;
                        return pb - pa;
                      })
                      .map((d, idx) => {
                        const covPct = d.coveragePct;
                        const llPct = d.lineListPct ?? 0;
                        const primaryPct = selectedKpi === 'linelist' ? llPct : covPct;
                        const primaryVal = selectedKpi === 'linelist' ? d.lineList : d.vaccinated;
                        const tier = getTier(primaryPct);
                        return (
                          <div key={d.district} className={`flex items-center py-1 sm:py-1.5 rounded hover:bg-slate-50 transition-colors border-b border-slate-100 gap-1.5`}>
                            <span className="text-[10px] font-bold text-slate-400 w-4 shrink-0 text-center">{idx + 1}</span>
                            <div className="flex-1 min-w-0 flex items-baseline gap-1 truncate">
                              <span className="text-[11px] font-bold text-slate-800">{d.district}</span>
                              <span className="text-[9px] font-semibold text-slate-400">({primaryVal.toLocaleString()}/{d.target.toLocaleString()})</span>
                            </div>
                            {selectedKpi === 'both' ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${getTier(llPct).bg} ${getTier(llPct).text}`}>
                                  LL: {llPct}%
                                </span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${getTier(covPct).bg} ${getTier(covPct).text}`}>
                                  Vacc: {covPct}%
                                </span>
                              </div>
                            ) : (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tier.bg} ${tier.text} shrink-0`}>
                                {primaryPct}%
                              </span>
                            )}
                          </div>
                        );
                    })}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-[10px] text-slate-400">
                    No district data — blocks need population setup.
                  </div>
                )}
              </div>

              {/* Bottom Banner */}
              <div className="bg-gradient-to-r from-blue-50 via-white to-blue-50 border border-blue-100 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm overflow-hidden relative shrink-0">
                <div className="flex items-center gap-4 z-10">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0 border border-blue-200">
                    <ShieldCheck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-blue-900 tracking-tight">HPV KAVACH Progress</h3>
                    <p className="text-xs text-slate-600 mt-0.5">Track progress across Uttarakhand's districts and ensure no one is left behind.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 z-10 bg-white/50 px-3 py-1.5 rounded-xl border border-blue-100/50 shrink-0">
                  <div className="text-right hidden sm:block">
                    <span className="text-xs font-semibold text-slate-500 block">Together, we can build</span>
                    <span className="text-sm font-bold text-blue-600 block">a healthier Uttarakhand</span>
                  </div>
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0 border border-blue-200 shadow-sm">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </div>
            </div>

              {/* Right: Uttarakhand Interactive Map */}
              <div className="lg:col-span-3 bg-white p-2 lg:p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:overflow-hidden lg:min-h-0 min-h-[400px]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-500" /> Uttarakhand Overview
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">13 Districts</span>
                </div>

                <div className="text-[10px] text-left text-slate-500 mb-2 mt-1">
                  <span className="font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded mr-1">Showing:</span>
                  {selectedKpi === 'coverage' || selectedKpi === 'both' ? (
                    <span>
                      <span className="text-blue-600 font-semibold">Vaccination Coverage (%)</span>
                      <span className="text-slate-800 italic font-semibold"> = (Vaccinated / HPV Target) x 100</span>
                    </span>
                  ) : (
                    <span>
                      <span className="text-blue-600 font-semibold">Line Listed (%)</span>
                      <span className="text-slate-800 italic font-semibold"> = (Line Listed / HPV Target) x 100</span>
                    </span>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-hidden relative pb-1">
                  {kpis?.district_chart_data && kpis.district_chart_data.length > 0 ? (
                    <UttarakhandMap
                      data={kpis.district_chart_data.map(d => ({
                        district: d.district,
                        coveragePct: d.coveragePct,
                        lineListPct: d.lineListPct ?? 0,
                        vaccinated: d.vaccinated,
                        lineList: d.lineList ?? 0,
                        target: d.target,
                      }))}
                      selectedKpi={selectedKpi === 'both' ? 'coverage' : selectedKpi}
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400 py-8">
                      No data to display on map.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REPORTS GENERATOR */}
        {activeTab === 'reports' && (
          <div className="space-y-4 flex-1 min-h-full lg:min-h-0 flex flex-col pb-4">
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
            <div className="bg-white p-2.5 lg:px-4 lg:py-2.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 mb-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800 pb-2 lg:pb-0 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-100 lg:pr-4">
                <Filter className="w-4 h-4 text-emerald-600" /> Filters
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full">
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
                  <label className="text-xs font-bold text-slate-700">Select Area</label>
                  <select
                    value={filterLevel}
                    onChange={e => {
                      setFilterLevel(e.target.value as any);
                      setFilterDistrictId('ALL');
                      setFilterBlockId('ALL');
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    <option value="State">State</option>
                    <option value="District">District</option>
                    <option value="Block">Block</option>
                  </select>
                </div>

                {/* Conditional Field: State / District / Block */}
                <div className="flex flex-col gap-1 lg:col-span-2">
                  {filterLevel === 'State' && (
                    <SearchableSelect
                      label="State"
                      placeholder="Search state..."
                      options={[{ id: '5', name: 'Uttarakhand' }]}
                      value={{ id: '5', name: 'Uttarakhand' }}
                      onChange={() => {}}
                    />
                  )}

                  {filterLevel === 'District' && (
                    <SearchableSelect
                      label="District"
                      placeholder="Search district..."
                      options={districtsList.map(d => ({ id: String(d.id), name: `${d.name} (State: Uttarakhand)` }))}
                      value={filterDistrictId === 'ALL' ? null : { id: filterDistrictId, name: districtsList.find(d => String(d.id) === filterDistrictId)?.name + ' (State: Uttarakhand)' || '' }}
                      onChange={item => setFilterDistrictId(item ? String(item.id) : 'ALL')}
                    />
                  )}

                  {filterLevel === 'Block' && (
                    <SearchableSelect
                      label="Block"
                      placeholder="Search block..."
                      options={masterBlocks.map(b => ({ id: String(b.id), name: `${b.name} (State: Uttarakhand, District: ${b.district_name})` }))}
                      value={filterBlockId === 'ALL' ? null : { id: filterBlockId, name: masterBlocks.find(b => String(b.id) === filterBlockId) ? `${masterBlocks.find(b => String(b.id) === filterBlockId)?.name} (State: Uttarakhand, District: ${masterBlocks.find(b => String(b.id) === filterBlockId)?.district_name})` : '' }}
                      onChange={item => setFilterBlockId(item ? String(item.id) : 'ALL')}
                    />
                  )}
                </div>

                {/* Submit Action */}
                <div className="flex items-end">
                  <button
                    onClick={fetchReport}
                    className="w-full px-4 py-2 rounded-xl text-xs font-bold text-white gradient-header shadow hover:shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4 text-hpv-teal-light" />
                    <span>GENERATE REPORT</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Generated Report Output Table / Cards */}
            <div className="bg-white p-2 lg:p-3 rounded-2xl border border-slate-200 shadow-sm lg:flex-1 lg:min-h-0 flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Report Result ({reportRows.length} Rows)
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-mono font-bold">
                    Date: {filterDate}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500">Sort By:</label>
                  <select 
                    value={reportSortOrder}
                    onChange={(e) => setReportSortOrder(e.target.value)}
                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="">Default Order</option>
                    <option value="coverage_desc">% Coverage (Desc)</option>
                    <option value="coverage_asc">% Coverage (Asc)</option>
                    <option value="linelist_desc">% Line List (Desc)</option>
                    <option value="linelist_asc">% Line List (Asc)</option>
                  </select>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-1">
                <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex items-center justify-center flex-col text-center gap-1">
                  <div className="w-6 h-6 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mb-0.5">
                    <Users className="w-3 h-3" />
                  </div>
                  <p className="text-[9px] font-bold text-slate-500 line-clamp-1">Total Count</p>
                  <p className="text-sm font-extrabold text-blue-700">{totalRows}</p>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex items-center justify-center flex-col text-center gap-1">
                  <div className="w-6 h-6 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-0.5">
                    <Target className="w-3 h-3" />
                  </div>
                  <p className="text-[9px] font-bold text-slate-500 line-clamp-1">HPV Target</p>
                  <p className="text-sm font-extrabold text-emerald-700">{totalTarget.toLocaleString()}</p>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex items-center justify-center flex-col text-center gap-1">
                  <div className="w-6 h-6 bg-purple-50 rounded-full flex items-center justify-center text-purple-500 mb-0.5">
                    <FileText className="w-3 h-3" />
                  </div>
                  <p className="text-[9px] font-bold text-slate-500 line-clamp-1">Line List</p>
                  <p className="text-sm font-extrabold text-purple-700">
                    {totalLL.toLocaleString()}
                    <span className="ml-1 text-[10px] text-purple-500 font-bold">({totalTarget > 0 ? Math.round((totalLL / totalTarget) * 100) : 0}%)</span>
                  </p>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex items-center justify-center flex-col text-center gap-1">
                  <div className="w-6 h-6 bg-pink-50 rounded-full flex items-center justify-center text-pink-500 mb-0.5">
                    <Users className="w-3 h-3" />
                  </div>
                  <p className="text-[9px] font-bold text-slate-500 line-clamp-1">Vaccinated</p>
                  <p className="text-sm font-extrabold text-pink-700">
                    {totalVacc.toLocaleString()}
                    <span className="ml-1 text-[10px] text-pink-500 font-bold">({totalTarget > 0 ? Math.round((totalVacc / totalTarget) * 100) : 0}%)</span>
                  </p>
                </div>
              </div>

              {loadingReport ? (
                <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span>Generating aggregated report...</span>
                </div>
              ) : reportRows.length > 0 ? (
                  /* DESKTOP/TABLET TABLE VIEW */
                  <>
                    <div className="overflow-x-auto lg:overflow-auto lg:flex-1 rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-[#1e1b4b] text-white font-semibold uppercase tracking-wider sticky top-0 z-10">
                          <tr>
                            <th className="px-2 py-1.5">District / Block</th>
                            <th className="px-2 py-1.5 text-right">Population</th>
                            <th className="px-2 py-1.5 text-right">HPV Target</th>
                            <th className="px-2 py-1.5 text-center">Last Report Date</th>
                            <th className="px-2 py-1.5 text-right">Line List Received</th>
                            <th className="px-2 py-1.5 text-right">Beneficiaries Vaccinated</th>
                            <th className="px-2 py-1.5 text-right">% Line List</th>
                            <th className="px-2 py-1.5 text-right">% Coverage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono">
                          {paginatedReportRows.map(row => (
                            <tr key={row.id} className="hover:bg-slate-50">
                              <td className="px-2 py-1 font-sans font-bold text-slate-900">
                                {row.name}
                                {row.district_name && (
                                  <span className="block text-[10px] text-slate-400 font-normal">
                                    {row.district_name} District
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-1 text-right font-medium text-slate-700">
                                {row.population !== null ? row.population.toLocaleString() : '—'}
                              </td>
                              <td className="px-2 py-1 text-right font-bold text-slate-900">
                                {row.hpv_target !== null ? row.hpv_target.toLocaleString() : '—'}
                              </td>
                              <td className="px-2 py-1 text-center text-slate-500 font-sans text-[10px]">
                                {row.last_reporting_date}
                              </td>
                              <td className="px-2 py-1 text-right font-semibold text-hpv-teal-dark">
                                {row.line_list_received !== null ? row.line_list_received.toLocaleString() : '—'}
                              </td>
                              <td className="px-2 py-1 text-right font-extrabold text-emerald-600">
                                {row.beneficiaries_vaccinated !== null ? row.beneficiaries_vaccinated.toLocaleString() : '—'}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {row.line_list_received_pct !== null ? (
                                  <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-bold text-[11px]">
                                    {row.line_list_received_pct}%
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {row.vaccination_coverage_pct !== null ? (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                                    {row.vaccination_coverage_pct}%
                                  </span>
                                ) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Pagination Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2 pt-3 border-t border-slate-100">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <span className="text-xs text-slate-500 font-medium">Show</span>
                        <select
                          value={rowsPerPage}
                          onChange={(e) => {
                            setRowsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                        >
                          <option value={10}>10</option>
                          <option value={15}>15</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                        <span className="text-xs text-slate-500 font-medium">entries</span>
                      </div>

                      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-4">
                        <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
                          {(currentPage - 1) * rowsPerPage + 1}-{Math.min(currentPage * rowsPerPage, totalRows)} of {totalRows}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-50 hover:bg-slate-50"
                          >
                            &lt;
                          </button>
                          
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                            // Simple pagination logic to show limited pages
                            if (
                              page === 1 || 
                              page === totalPages || 
                              (page >= currentPage - 1 && page <= currentPage + 1)
                            ) {
                              return (
                                <button
                                  key={page}
                                  onClick={() => setCurrentPage(page)}
                                  className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                                    currentPage === page 
                                      ? 'bg-[#1e1b4b] text-white border border-[#1e1b4b]' 
                                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  {page}
                                </button>
                              );
                            } else if (
                              page === currentPage - 2 ||
                              page === currentPage + 2
                            ) {
                              return <span key={page} className="text-xs text-slate-400 px-1">...</span>;
                            }
                            return null;
                          })}

                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-50 hover:bg-slate-50"
                          >
                            &gt;
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  No records match selected filter criteria.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2.5: TREND */}
        {activeTab === 'trend' && (
          <AdminTrend
            statesList={statesList}
            districtsList={districtsList}
            blocksList={blocksList}
            filterLevel={filterLevel}
            setFilterLevel={setFilterLevel}
            filterStateId={filterStateId}
            setFilterStateId={setFilterStateId}
            filterDistrictId={filterDistrictId}
            setFilterDistrictId={setFilterDistrictId}
            filterBlockId={filterBlockId}
            setFilterBlockId={setFilterBlockId}
          />
        )}

        {/* TAB 3: LOCATIONS MASTER */}
        {activeTab === 'locations' && (
          <div className="space-y-4 flex-1 min-h-0 flex flex-col pb-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Master Location Registry
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                States, Districts, Blocks & Urban Bodies
              </p>
            </div>

            {/* Add New Location Panel */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold">+</span>
                Add New Location
              </h2>

              {/* Type selector tabs */}
              <div className="flex gap-2 flex-wrap">
                {(['state', 'district', 'block', 'urban'] as const).map(t => (
                  <button key={t} onClick={() => { setAddLocType(t); setAddLocMsg(''); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${addLocType === t ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {t === 'state' ? '🏛 New State' : t === 'district' ? '🗺 New District' : t === 'block' ? '🏘 New Block (Rural)' : '🏙 New Urban Body'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddLocation} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                {/* State selector for district/block/urban */}
                {(addLocType === 'district') && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">State *</label>
                    <select value={addLocStateId} onChange={e => setAddLocStateId(e.target.value)} required className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600">
                      <option value="">Select state...</option>
                      {statesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                {(addLocType === 'block' || addLocType === 'urban') && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">District *</label>
                    <select value={addLocDistrictId} onChange={e => setAddLocDistrictId(e.target.value)} required className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600">
                      <option value="">Select district...</option>
                      {allDistrictsList.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Name */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    {addLocType === 'state' ? 'State Name' : addLocType === 'district' ? 'District Name' : addLocType === 'urban' ? 'Urban Body Name' : 'Block Name'} *
                  </label>
                  <input type="text" value={addLocName} onChange={e => setAddLocName(e.target.value)} required placeholder="Enter name..."
                    className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600" />
                </div>
                {/* LGD */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">LGD Code *</label>
                  <input type="number" value={addLocLgd} onChange={e => setAddLocLgd(e.target.value)} required placeholder="LGD code..."
                    className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600" />
                </div>
                {/* Submit */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 invisible">Action</label>
                  <button type="submit" disabled={addLocLoading}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white gradient-header shadow hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                    {addLocLoading ? 'Adding...' : '+ Add Location'}
                  </button>
                </div>
              </form>
              {addLocMsg && <p className={`text-xs font-semibold ${addLocMsg.startsWith('✅') ? 'text-emerald-600' : 'text-rose-600'}`}>{addLocMsg}</p>}
            </div>

            {/* Search */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <Search className="w-5 h-5 text-slate-400 ml-1" />
              <input
                type="text"
                value={locationSearch}
                onChange={e => setLocationSearch(e.target.value)}
                placeholder="Search block, urban body, district..."
                className="w-full bg-transparent text-xs text-slate-900 focus:outline-none"
              />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden lg:flex-1 lg:min-h-0 flex flex-col">
              <div className="overflow-x-auto lg:overflow-auto lg:flex-1">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-900 text-white font-semibold uppercase sticky top-0">
                    <tr>
                      <th className="px-3 py-2">State</th>
                      <th className="px-3 py-2">District</th>
                      <th className="px-3 py-2">Block / Urban Body</th>
                      <th className="px-3 py-2">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {masterBlocks
                      .filter(b => {
                        const q = locationSearch.toLowerCase();
                        if (!q) return true;
                        return (
                          b.name.toLowerCase().includes(q) ||
                          b.district_name.toLowerCase().includes(q) ||
                          b.state_name.toLowerCase().includes(q)
                        );
                      })
                      .map(b => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-sans font-medium text-slate-600 text-[11px]">{b.state_name}</td>
                          <td className="px-3 py-2 font-sans font-bold text-slate-800">{b.district_name}</td>
                          <td className="px-3 py-2 font-sans font-bold text-hpv-teal-dark">{b.name}</td>
                          <td className="px-3 py-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.is_urban ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                              {b.is_urban ? 'Urban' : 'Rural'}
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
          <div className="space-y-5 flex-1 min-h-0 flex flex-col pb-4">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight shrink-0">Admin User Management</h1>

            {/* Add new admin form */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold">+</span>
                Add New Admin
              </h2>
              <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Full Name *</label>
                  <input type="text" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} required placeholder="Full name..."
                    className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Username *</label>
                  <input type="text" value={newAdminUsername} onChange={e => setNewAdminUsername(e.target.value)} required placeholder="username..."
                    className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Password *</label>
                  <input type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} required placeholder="Min 6 chars..."
                    className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Role</label>
                  <select value={newAdminRole} onChange={e => setNewAdminRole(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600">
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600 invisible">Action</label>
                  <button type="submit" disabled={addAdminLoading}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white gradient-header shadow hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                    {addAdminLoading ? 'Creating...' : '+ Create Admin'}
                  </button>
                </div>
              </form>
              {addAdminMsg && <p className={`text-xs font-semibold ${addAdminMsg.startsWith('✅') ? 'text-emerald-600' : 'text-rose-600'}`}>{addAdminMsg}</p>}
            </div>

            {/* Admin list */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden lg:flex-1 lg:min-h-0 flex flex-col">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Authorized System Administrators</span>
                <button onClick={fetchAdminUsers} className="text-[10px] text-blue-500 font-bold hover:underline">↻ Refresh</button>
              </div>
              <div className="overflow-x-auto lg:overflow-auto lg:flex-1">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Username</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adminUsers.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading admins...</td></tr>
                  ) : adminUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-bold text-slate-900">{u.name}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-600">@{u.username}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-[10px]">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}

        {/* TAB 5: SETTINGS — Reset Password Only */}
        {activeTab === 'settings' && (
          <div className="space-y-6 flex-1 min-h-0 overflow-y-auto pb-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Settings</h1>
              <p className="text-xs text-slate-500 mt-1">Manage your account security</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-md">
              <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">🔐</span>
                Reset My Password
              </h2>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Current Password *</label>
                  <input type="password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} required placeholder="Current password"
                    className="px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">New Password *</label>
                  <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} required placeholder="Min 6 characters"
                    className="px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Confirm New Password *</label>
                  <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} required placeholder="Repeat new password"
                    className="px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600" />
                </div>
                {pwMsg && <p className={`text-xs font-semibold ${pwMsg.startsWith('✅') ? 'text-emerald-600' : 'text-rose-600'}`}>{pwMsg}</p>}
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button type="submit" disabled={pwLoading}
                    className="px-6 py-3 rounded-xl font-bold text-xs text-white gradient-header shadow hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-60">
                    <Save className="w-4 h-4" />
                    <span>{pwLoading ? 'Changing...' : 'Change Password'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


        {/* TAB 6: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="space-y-6 flex-1 min-h-0 flex flex-col pb-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                System Audit Logs
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Complete audit trail of block reporting entries, baseline updates, and administrative actions
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden lg:flex-1 lg:min-h-0 flex flex-col">
              <div className="overflow-x-auto lg:overflow-auto lg:flex-1">
                <table className="w-full text-left text-xs whitespace-nowrap">
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
                        <td className="p-3 font-bold text-emerald-600">{log.user_id}</td>
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

        {activeTab === 'population' && (
          <AdminPopulation />
        )}
      </main>
    </div>
  );
};
