import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, MapPin, Users, Settings as SettingsIcon,
  ShieldCheck, LogOut, Menu, X, Download, Filter, Search, Calendar,
  TrendingUp, CheckCircle, BarChart3, ChevronRight, ChevronLeft, ChevronDown, Hash, Eye, RefreshCw, Save,
  Building2, ClipboardList, FileSpreadsheet, Target, Bell,
  Syringe, Search as SearchIcon, HeartPulse, UploadCloud, Activity, Users as UsersIcon
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { SearchableSelect, OptionItem } from '../components/SearchableSelect';
import { AdminTrend } from '../components/AdminTrend';
import { SuperAdminUpload } from '../components/SuperAdminUpload';
import { StateMap, getTier } from '../components/StateMap';
import { AdminPopulation } from '../components/AdminPopulation';
import { LocationMaster } from '../components/LocationMaster';

interface KPIState {
  total_blocks: number;
  reporting_today: number;
  total_line_list: number;
  total_vaccinated: number;
  total_target: number;
  total_population?: number;
  latest_reporting_date?: string;
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
  division_name?: string;
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'trend' | 'locations' | 'users' | 'settings' | 'audit' | 'population' | 'upload' | 'activity'>('dashboard');
  

  const [usersOpen, setUsersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);

  // KPIs State
  const [kpis, setKpis] = useState<KPIState | null>(null);
  const [loadingKpis, setLoadingKpis] = useState(true);

  // Report Generator Filter State
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dashboardStateId, setDashboardStateId] = useState<string>('');
  const [states, setStates] = useState<any[]>([]);
  const [filterLevel, setFilterLevel] = useState<'State' | 'Division' | 'District' | 'Block'>('District');
  const [filterStateId, setFilterStateId] = useState<string>('5');
  const [filterDivisionId, setFilterDivisionId] = useState<string>('ALL');
  const [filterDistrictId, setFilterDistrictId] = useState<string>('ALL');
  const [filterBlockId, setFilterBlockId] = useState<string>('ALL');

  const [districtsList, setDistrictsList] = useState<any[]>([]);


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
  const [divisionsList, setDivisionsList] = useState<any[]>([]);
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
  const [newAdminStateId, setNewAdminStateId] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('ADMIN');
  const [addAdminMsg, setAddAdminMsg] = useState('');
  const [addAdminLoading, setAddAdminLoading] = useState(false);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Activity Data state
  const [activityData, setActivityData] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Dashboard KPI selector
  const [selectedKpi, setSelectedKpi] = useState<'coverage' | 'linelist' | 'both'>('coverage');

  // Alerts Count
  const [alertCount, setAlertCount] = useState(0);

  const [isAuthenticating, setIsAuthenticating] = useState(true);

  // Token Auth Verification
  useEffect(() => {
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    const userStr = (localStorage.getItem('hpv_admin_user') || sessionStorage.getItem('hpv_admin_user'));
    if (!token || !userStr) {
      navigate('/admin/login');
      return;
    }
    setAdminUser(JSON.parse(userStr));
    setIsAuthenticating(false);
    fetchKpis();
    fetchMasterLocations();
    fetchReport();
    fetchAlertCount();
  }, [navigate]);

  const fetchAlertCount = () => {
    fetch(`/api/admin/population?state_id=${dashboardStateId}`, {
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

  const fetchActivityData = () => {
    setLoadingActivity(true);
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    fetch('/api/admin/activity', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setActivityData(Array.isArray(data) ? data : []);
        setLoadingActivity(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingActivity(false);
      });
  };

  const fetchKpis = () => {
    setLoadingKpis(true);
    fetch(`/api/admin/kpis?date=${filterDate}&state_id=${dashboardStateId}`, {
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
  }, [filterDate, dashboardStateId]);

  const [allBlocksList, setAllBlocksList] = useState<any[]>([]);

  // Fetch locations on mount
  useEffect(() => {
    fetch('/api/locations/districts')
      .then(res => res.json())
      .then(data => setDistrictsList(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));

    fetch('/api/locations/blocks')
      .then(res => res.json())
      .then(data => setAllBlocksList(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  }, []);

  const activeStateId = adminUser?.role === 'SUPER_ADMIN' ? dashboardStateId : String(adminUser?.state_id || '');

  // Filter districts by active state
  const filteredDistricts = useMemo(() => {
    if (!activeStateId) return allDistrictsList;
    return allDistrictsList.filter(d => String(d.state_id) === activeStateId);
  }, [allDistrictsList, activeStateId]);

  // Filter divisions by active state
  const filteredDivisions = useMemo(() => {
    if (!activeStateId) return divisionsList;
    return divisionsList.filter(d => String(d.state_id) === activeStateId);
  }, [divisionsList, activeStateId]);

  // Filter blocks by active state
  const filteredBlocks = useMemo(() => {
    if (!activeStateId) return masterBlocks;
    return masterBlocks.filter(b => {
      const d = allDistrictsList.find(dist => dist.id === b.district_id);
      return d && String(d.state_id) === activeStateId;
    });
  }, [masterBlocks, allDistrictsList, activeStateId]);

  // Filter blocks when district filter changes
  const blocksList = useMemo(() => {
    if (filterDistrictId && filterDistrictId !== 'ALL') {
      return filteredBlocks.filter(b => String(b.district_id) === String(filterDistrictId));
    }
    return filteredBlocks;
  }, [filterDistrictId, filteredBlocks]);

  // Reset block filter when district changes
  useEffect(() => {
    setFilterBlockId('ALL');
  }, [filterDistrictId]);

  const fetchReport = () => {
    setLoadingReport(true);
    const params = new URLSearchParams({
      date: filterDate,
      level: filterLevel,
      divisionId: filterDivisionId,
      districtId: filterDistrictId,
      blockId: filterBlockId
    });

    fetch(`/api/admin/reports/generate?${params.toString()}&state_id=${dashboardStateId}`, {
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
      fetch('/api/locations/divisions').then(r => r.json()),
    ]).then(([blocks, states, districts, divisions]) => {
      setMasterBlocks(Array.isArray(blocks) ? blocks : []);
      setStatesList(Array.isArray(states) ? states : []);
      setStates(Array.isArray(states) ? states : []);
      setAllDistrictsList(Array.isArray(districts) ? districts : []);
      setDivisionsList(Array.isArray(divisions) ? divisions : []);
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          username: newAdminUsername, 
          name: newAdminName, 
          password: newAdminPassword, 
          role: newAdminRole, 
          state_id: newAdminStateId || undefined 
        })
      });
      const data = await res.json();
      if (!res.ok) { setAddAdminMsg(`❌ ${data.error}`); } else {
        setAddAdminMsg('✅ Admin created successfully!');
        setNewAdminName(''); setNewAdminUsername(''); setNewAdminPassword(''); setNewAdminStateId('');
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

    if (tab === 'users' || tab === 'activity') setUsersOpen(true);
    if (tab === 'upload' || tab === 'settings') setSettingsOpen(true);
    if (tab === 'reports' || tab === 'trend') setAnalyticsOpen(true);
    if (tab === 'locations') fetchMasterLocations();
    if (tab === 'users') fetchAdminUsers();
    if (tab === 'audit') fetchAuditLogs();
    if (tab === 'activity') fetchActivityData();
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
      'Division',
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

  const isInitialLoading = isAuthenticating || (kpis === null && loadingKpis) || (reportRows.length === 0 && loadingReport);
  if (isInitialLoading) {
    return (
      <div className="h-[100dvh] w-full bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-sm font-bold text-slate-500">
            {isAuthenticating ? 'Checking authentication...' : 'Loading Dashboard...'}
          </div>
        </div>
      </div>
    );
  }

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
            {/* Dashboard */}
            <button
              onClick={() => handleTabChange('dashboard')}
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

            {/* Alerts */}
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
              {!sidebarCollapsed && (
                <span className={`ml-auto py-0.5 px-2 rounded-full text-[10px] font-bold ${alertCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                  {alertCount}
                </span>
              )}
            </button>

            {/* Analytics Group */}
            <div className="pt-2">
              <button 
                onClick={() => { if (!sidebarCollapsed) setAnalyticsOpen(!analyticsOpen) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
                title="Analytics"
              >
                <span className={sidebarCollapsed ? 'hidden' : ''}>Analytics</span>
                {!sidebarCollapsed && (
                  <ChevronDown className={`w-4 h-4 transition-transform ${analyticsOpen ? '' : '-rotate-90'}`} />
                )}
              </button>
              
              {(analyticsOpen || sidebarCollapsed) && (
                <div className={`mt-1 space-y-1 ${sidebarCollapsed ? '' : 'pl-2 border-l-2 border-slate-100 ml-3'}`}>
                  {/* Reports */}
                  <button
                    onClick={() => handleTabChange('reports')}
                    title="Reports"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'reports' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'reports' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Reports</span>
                  </button>

                  {/* Trend */}
                  <button
                    onClick={() => handleTabChange('trend')}
                    title="Trend"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'trend' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className={`w-4 h-4 shrink-0 ${activeTab === 'trend' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Trend</span>
                  </button>
                </div>
              )}
            </div>

            {/* User Management */}
            {adminUser?.role === 'SUPER_ADMIN' && (
              <div className="pt-2">
                <button 
                  onClick={() => { if (!sidebarCollapsed) setUsersOpen(!usersOpen) }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
                  title="User Management"
                >
                  <span className={sidebarCollapsed ? 'hidden' : ''}>User Management</span>
                  {!sidebarCollapsed && (
                    <ChevronDown className={`w-4 h-4 transition-transform ${usersOpen ? '' : '-rotate-90'}`} />
                  )}
                </button>
                
                {(usersOpen || sidebarCollapsed) && (
                  <div className={`mt-1 space-y-1 ${sidebarCollapsed ? '' : 'pl-2 border-l-2 border-slate-100 ml-3'}`}>
                    <button
                      onClick={() => handleTabChange('users')}
                      title="Admin Users"
                      className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                        activeTab === 'users' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <UsersIcon className={`w-4 h-4 shrink-0 ${activeTab === 'users' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Admin Users</span>
                    </button>
                    <button
                      onClick={() => handleTabChange('activity')}
                      title="Activity"
                      className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                        activeTab === 'activity' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Activity className={`w-4 h-4 shrink-0 ${activeTab === 'activity' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Activity</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Settings */}
            {adminUser?.role === 'SUPER_ADMIN' && (
              <div className="pt-2">
                <button 
                  onClick={() => { if (!sidebarCollapsed) setSettingsOpen(!settingsOpen) }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
                  title="Settings"
                >
                  <span className={sidebarCollapsed ? 'hidden' : ''}>Settings</span>
                  {!sidebarCollapsed && (
                    <ChevronDown className={`w-4 h-4 transition-transform ${settingsOpen ? '' : '-rotate-90'}`} />
                  )}
                </button>
                
                {(settingsOpen || sidebarCollapsed) && (
                  <div className={`mt-1 space-y-1 ${sidebarCollapsed ? '' : 'pl-2 border-l-2 border-slate-100 ml-3'}`}>
                    <button
                      onClick={() => handleTabChange('upload')}
                      title="Upload CSV"
                      className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                        activeTab === 'upload' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <UploadCloud className={`w-4 h-4 shrink-0 ${activeTab === 'upload' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Upload CSV</span>
                    </button>
                    <button
                      onClick={() => handleTabChange('settings')}
                      title="Update Password"
                      className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                        activeTab === 'settings' ? 'bg-emerald-50 text-emerald-600 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <SettingsIcon className={`w-4 h-4 shrink-0 ${activeTab === 'settings' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Update Password</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
        {/* Slogan Badge */}
        <div className={`mx-3 mt-auto mb-2 flex items-center justify-between gap-2 bg-blue-50/50 px-3 py-2 rounded-xl border border-blue-100/50 shrink-0 ${sidebarCollapsed ? 'hidden' : 'flex'}`}>
          <div className="text-right flex-1">
            <span className="text-[10px] font-semibold text-slate-500 block">Together, we can build</span>
            <span className="text-[11px] font-bold text-blue-600 block">a healthier {adminUser?.role === 'SUPER_ADMIN' ? (dashboardStateId ? statesList.find(s => String(s.id) === dashboardStateId)?.name : 'India') : (adminUser?.state_name || (adminUser?.state_id ? statesList.find(s => String(s.id) === String(adminUser.state_id))?.name : '') || 'State')}</span>
          </div>
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0 border border-blue-200 shadow-sm">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
        </div>

        {/* User Info & Logout */}
        <div className={`mx-3 mb-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer group flex items-center ${sidebarCollapsed ? 'p-2 justify-center lg:mx-2 lg:mb-2 mt-auto' : 'p-4 justify-between'}`} onClick={() => { setMobileMenuOpen(false); handleLogout(); }} title="Logout">
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
              HPV Vaccination Monitoring Portal<br/>Version: 1.0 • UK 2026
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
              <div className="flex flex-col gap-0.5">
                {kpis?.latest_reporting_date && (
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Last Updated On: {new Date(kpis.latest_reporting_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, ' ')}
                  </span>
                )}
                <div className="flex items-center gap-2 group relative">
                  <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-1.5">
                    <span className="text-[#188E94]">Monitoring Dashboard:</span>
                    {adminUser?.role === 'SUPER_ADMIN' ? (
                      <select 
                        value={dashboardStateId} 
                        onChange={(e) => setDashboardStateId(e.target.value)}
                        className="text-purple-900 bg-transparent outline-none cursor-pointer border-b-2 border-transparent hover:border-purple-300 ml-1 pb-0.5 text-lg"
                      >
                        <option value="">All States</option>
                        {statesList.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                      </select>
                    ) : (
                      <span className="text-purple-900 ml-1">{adminUser?.state_name || 'Assigned State'}</span>
                    )}
                  </h1>
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 cursor-help hover:bg-slate-200 hover:text-slate-600 transition-colors shrink-0 relative">
                    <span className="text-xs font-bold italic font-serif">i</span>
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-max max-w-[200px] bg-slate-800 text-white text-[10px] p-2 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 font-medium">
                      (Track progress and performance for timely action.)
                      <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-800" />
                    </div>
                  </div>
                </div>
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
                      {kpis?.total_population ? kpis.total_population.toLocaleString('en-IN') : '—'}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between z-10 relative">
                  <span className="text-[9px] text-slate-400">HPV Target population (1%)</span>
                  <span className="text-[10px] font-bold font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{kpis?.total_target?.toLocaleString('en-IN') || '—'}</span>
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
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-2xl font-extrabold font-mono text-slate-900 leading-none">
                        {kpis ? kpis.total_blocks : '—'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Blocks/Cities
                      </span>
                    </div>
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
                  <span className="text-[10px] font-bold font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{kpis?.total_line_list?.toLocaleString('en-IN') || '—'}</span>
                </div>
              </div>

              {/* Card 4: Total Vaccinated */}
              <div className="bg-[#fff0f5] p-3 rounded-xl border border-pink-200 shadow-sm relative overflow-hidden border-t-4 border-t-pink-500 flex flex-col justify-between">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-500 flex items-center justify-center shrink-0 shadow-inner shadow-white/20">
                    <ShieldCheck className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate">
                      ELIGIBLE GIRLS VACCINATED
                    </span>
                    <span className="text-2xl font-extrabold font-mono text-pink-600 leading-none mt-1">
                      {kpis ? kpis.overall_coverage_pct : 0}%
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-pink-200/60 flex items-center justify-between gap-2">
                  <span className="text-[9px] text-slate-500">Count:</span>
                  <span className="text-[10px] font-bold font-mono text-pink-700 bg-pink-100 px-1.5 py-0.5 rounded">{kpis?.total_vaccinated?.toLocaleString('en-IN') || '—'}</span>
                </div>
              </div>
            </div>

            {/* Split Layout: Ranking & Map — flex-1 fills remaining height */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-2 flex-none lg:flex-1 lg:min-h-0">
              {/* Left Column: District Ranking + Banner */}
              <div className="lg:col-span-1 flex flex-col gap-2 lg:min-h-0">
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
                    <option value="coverage">Vaccination Coverage (%)</option>
                    <option value="linelist">Line Listed (%)</option>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 sm:gap-y-1.5 pb-2">
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
                              <span className="text-[9px] font-semibold text-slate-400">({primaryVal.toLocaleString('en-IN')}/{d.target.toLocaleString('en-IN')})</span>
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

              {/* Bottom Banner - Global Strategy */}
              <div className="bg-[#fff0f5] border-2 border-[#fbcfe8] rounded-xl shadow-sm overflow-hidden shrink-0 flex flex-col sm:flex-row items-stretch relative">
                {/* 3 Boxes Area */}
                <div className="flex-1 p-1.5 sm:p-2.5">
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 h-full">
                    {/* Pink Box */}
                    <div className="flex flex-col p-2 bg-white/80 border border-[#fbcfe8] border-b-[4px] sm:border-b-[6px] border-b-[#f472b6] rounded-xl relative overflow-hidden group h-full shadow-sm backdrop-blur-sm">
                      <div className="flex justify-between items-center z-10 w-full mb-1 sm:mb-2">
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-xl sm:text-2xl font-black text-[#e93c7a] leading-none tracking-tighter">90</span>
                          <span className="text-sm sm:text-base font-black text-[#e93c7a] leading-none">%</span>
                        </div>
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-pink-50 rounded-full flex items-center justify-center border border-pink-100 shadow-sm shrink-0">
                          <Syringe className="w-3 h-3 sm:w-4 sm:h-4 text-[#e93c7a] transform -rotate-45" />
                        </div>
                      </div>
                      <div className="h-px bg-[#fbcfe8] w-2/3 my-1.5" />
                      <p className="text-[9px] sm:text-[11px] text-[#021a40] font-bold leading-snug z-10 [text-wrap:pretty]">
                        of Girls Vaccinated Against HPV by Age 15
                      </p>
                    </div>
                    {/* Teal Box */}
                    <div className="flex flex-col p-2 bg-white/80 border border-[#ccfbf1] border-b-[4px] sm:border-b-[6px] border-b-[#2dd4bf] rounded-xl relative overflow-hidden group h-full shadow-sm backdrop-blur-sm">
                      <div className="flex justify-between items-center z-10 w-full mb-1 sm:mb-2">
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-xl sm:text-2xl font-black text-[#0d9488] leading-none tracking-tighter">70</span>
                          <span className="text-sm sm:text-base font-black text-[#0d9488] leading-none">%</span>
                        </div>
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-teal-50 rounded-full flex items-center justify-center border border-teal-100 shadow-sm shrink-0">
                          <SearchIcon className="w-3 h-3 sm:w-4 sm:h-4 text-[#0d9488]" />
                        </div>
                      </div>
                      <div className="h-px bg-[#ccfbf1] w-2/3 my-1.5" />
                      <p className="text-[9px] sm:text-[11px] text-[#021a40] font-bold leading-snug z-10 [text-wrap:pretty]">
                        of Women Screened with a high-performance test by Ages 35 and 45
                      </p>
                    </div>
                    {/* Purple Box */}
                    <div className="flex flex-col p-2 bg-white/80 border border-[#e9d5ff] border-b-[4px] sm:border-b-[6px] border-b-[#a855f7] rounded-xl relative overflow-hidden group h-full shadow-sm backdrop-blur-sm">
                      <div className="flex justify-between items-center z-10 w-full mb-1 sm:mb-2">
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-xl sm:text-2xl font-black text-[#7e22ce] leading-none tracking-tighter">90</span>
                          <span className="text-sm sm:text-base font-black text-[#7e22ce] leading-none">%</span>
                        </div>
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-purple-50 rounded-full flex items-center justify-center border border-purple-100 shadow-sm shrink-0">
                          <HeartPulse className="w-3 h-3 sm:w-4 sm:h-4 text-[#7e22ce]" />
                        </div>
                      </div>
                      <div className="h-px bg-[#e9d5ff] w-2/3 my-1.5" />
                      <p className="text-[9px] sm:text-[11px] text-[#021a40] font-bold leading-snug z-10 [text-wrap:pretty]">
                        of Women identified with Cervical Disease Receive Treatment
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Side Strategy Text */}
                <div className="w-full sm:w-[140px] lg:w-[160px] p-3 sm:p-4 flex flex-col justify-center items-end text-right border-t sm:border-t-0 sm:border-l border-[#fbcfe8] bg-[#fff0f5] shrink-0 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-pink-100 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none opacity-50"></div>
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-[#e93c7a] drop-shadow-sm mb-2 relative z-10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.69 2 6 4.69 6 8c0 2.21 1.2 4.14 3.03 5.25L4.44 21.4c-.22.39.06.88.51.88h2.39l3.52-6.28 1.14-.65c.34.15.71.24 1.09.24.38 0 .75-.09 1.09-.24l1.14.65 3.52 6.28h2.39c.45 0 .73-.49.51-.88l-4.59-8.15C19.8 12.14 21 10.21 21 8c0-3.31-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
                  </svg>
                  <h3 className="text-[12px] sm:text-[13px] lg:text-[14px] font-bold text-[#b81d5b] tracking-tight leading-snug relative z-10 [text-wrap:balance]">
                    Global Strategy to Eliminate Cervical Cancer by 2030
                  </h3>
                </div>
              </div>
            </div>

              {/* Right: Uttarakhand Interactive Map */}
              <div className="lg:col-span-1 bg-white p-2 lg:p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:overflow-hidden lg:min-h-0 min-h-[400px]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-500" /> {adminUser?.role === 'SUPER_ADMIN' ? (dashboardStateId ? statesList.find(s => String(s.id) === dashboardStateId)?.name || 'India' : 'India') : (adminUser?.state_name || (adminUser?.state_id ? statesList.find(s => String(s.id) === String(adminUser.state_id))?.name : '') || 'State')} Overview
                  </h3>
                  <span className="text-xs font-semibold text-slate-500">13 Districts</span>
                </div>

                <div className="text-[10px] text-left text-slate-500 mb-2 mt-1 flex items-center flex-wrap gap-1">
                  <span className="font-bold bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded">Showing:</span>
                  {selectedKpi === 'coverage' || selectedKpi === 'both' ? (
                    <div className="flex items-center gap-1 group relative">
                      <span className="text-purple-900 font-semibold">Vaccination Coverage (%)</span>
                      <div className="w-3.5 h-3.5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 cursor-help hover:bg-slate-200 hover:text-purple-900 transition-colors shrink-0">
                        <span className="text-[9px] font-bold italic font-serif">i</span>
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1.5 w-max bg-slate-800 text-white text-[9px] px-2 py-1.5 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 font-medium whitespace-nowrap">
                          Vaccination Coverage (%) = (Vaccinated / HPV Target) x 100
                          <div className="absolute top-1/2 -left-[4px] -translate-y-1/2 border-y-[4px] border-y-transparent border-r-[4px] border-r-slate-800" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group relative">
                      <span className="text-purple-900 font-semibold">Line Listed (%)</span>
                      <div className="w-3.5 h-3.5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 cursor-help hover:bg-slate-200 hover:text-purple-900 transition-colors shrink-0">
                        <span className="text-[9px] font-bold italic font-serif">i</span>
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1.5 w-max bg-slate-800 text-white text-[9px] px-2 py-1.5 rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 font-medium whitespace-nowrap">
                          Line Listed (%) = (Line Listed / HPV Target) x 100
                          <div className="absolute top-1/2 -left-[4px] -translate-y-1/2 border-y-[4px] border-y-transparent border-r-[4px] border-r-slate-800" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-hidden relative pb-1">
                  <StateMap
                    stateName={adminUser?.role === 'SUPER_ADMIN' ? (dashboardStateId ? statesList.find(s => String(s.id) === dashboardStateId)?.name || 'India' : 'India') : (adminUser?.state_name || (adminUser?.state_id ? statesList.find(s => String(s.id) === String(adminUser.state_id))?.name : '') || 'India')}
                    data={(kpis?.district_chart_data || []).map(d => ({
                      district: d.district,
                      coveragePct: d.coveragePct,
                      lineListPct: d.lineListPct ?? 0,
                      vaccinated: d.vaccinated,
                      lineList: d.lineList ?? 0,
                      target: d.target,
                    }))}
                    selectedKpi={selectedKpi === 'both' ? 'coverage' : selectedKpi}
                  />
                </div>

                {/* Map Tier Legend */}
                <div className="flex flex-wrap justify-center gap-2 mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-100 text-red-700">Aspirational 0-30%</span>
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-yellow-100 text-yellow-700">Progressing 30-70%</span>
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-blue-100 text-blue-700">High Performance 70-90%</span>
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-100 text-emerald-700">Champion 90%+</span>
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
                    <option value="Division">Division</option>
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
                      options={adminUser?.role === 'SUPER_ADMIN' ? statesList.map(s => ({ id: String(s.id), name: s.name })) : ((adminUser?.state_name || (adminUser?.state_id ? statesList.find(s => String(s.id) === String(adminUser.state_id))?.name : '')) ? [{ id: String(adminUser?.state_id), name: (adminUser?.state_name || statesList.find(s => String(s.id) === String(adminUser?.state_id))?.name || '') }] : [])}
                      value={dashboardStateId ? { id: dashboardStateId, name: statesList.find(s => String(s.id) === dashboardStateId)?.name || '' } : ((adminUser?.state_name || (adminUser?.state_id ? statesList.find(s => String(s.id) === String(adminUser.state_id))?.name : '')) ? { id: String(adminUser?.state_id), name: (adminUser?.state_name || statesList.find(s => String(s.id) === String(adminUser?.state_id))?.name || '') } : null)}
                      onChange={() => {}}
                    />
                  )}

                  {filterLevel === 'Division' && (
                    <SearchableSelect
                      label="Division"
                      placeholder="Search division..."
                      options={filteredDivisions.map(d => ({ id: String(d.id), name: `${d.name} (State: ${statesList.find(s => s.id === d.state_id)?.name || 'Unknown'})` }))}
                      value={filterDivisionId === 'ALL' ? null : { id: filterDivisionId, name: filteredDivisions.find(d => String(d.id) === filterDivisionId) ? `${filteredDivisions.find(d => String(d.id) === filterDivisionId)?.name} (State: ${statesList.find(s => s.id === filteredDivisions.find(d => String(d.id) === filterDivisionId)?.state_id)?.name || 'Unknown'})` : '' }}
                      onChange={item => setFilterDivisionId(item ? String(item.id) : 'ALL')}
                    />
                  )}

                  {filterLevel === 'District' && (
                    <SearchableSelect
                      label="District"
                      placeholder="Search district..."
                      options={filteredDistricts.map(d => ({ id: String(d.id), name: `${d.name} (State: ${statesList.find(s => s.id === d.state_id)?.name || 'Unknown'})` }))}
                      value={filterDistrictId === 'ALL' ? null : { id: filterDistrictId, name: filteredDistricts.find(d => String(d.id) === filterDistrictId) ? `${districtsList.find(d => String(d.id) === filterDistrictId)?.name} (State: ${statesList.find(s => s.id === filteredDistricts.find(d => String(d.id) === filterDistrictId)?.state_id)?.name || 'Unknown'})` : '' }}
                      onChange={item => setFilterDistrictId(item ? String(item.id) : 'ALL')}
                    />
                  )}

                  {filterLevel === 'Block' && (
                    <SearchableSelect
                      label="Block"
                      placeholder="Search block..."
                      options={filteredBlocks.map(b => ({ id: String(b.id), name: `${b.name} (State: ${b.state_name || statesList.find(s => s.id === allDistrictsList.find(d => d.id === b.district_id)?.state_id)?.name}, District: ${b.district_name})` }))}
                      value={filterBlockId === 'ALL' ? null : { id: filterBlockId, name: filteredBlocks.find(b => String(b.id) === filterBlockId) ? `${masterBlocks.find(b => String(b.id) === filterBlockId)?.name} (State: ${masterBlocks.find(b => String(b.id) === filterBlockId)?.state_name || 'Unknown'}, District: ${masterBlocks.find(b => String(b.id) === filterBlockId)?.district_name})` : '' }}
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
                    <SearchIcon className="w-4 h-4 text-hpv-teal-light" />
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
                  <p className="text-sm font-extrabold text-emerald-700">{totalTarget.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex items-center justify-center flex-col text-center gap-1">
                  <div className="w-6 h-6 bg-purple-50 rounded-full flex items-center justify-center text-purple-500 mb-0.5">
                    <FileText className="w-3 h-3" />
                  </div>
                  <p className="text-[9px] font-bold text-slate-500 line-clamp-1">Line List</p>
                  <p className="text-sm font-extrabold text-purple-700">
                    {totalLL.toLocaleString('en-IN')}
                    <span className="ml-1 text-[10px] text-purple-500 font-bold">({totalTarget > 0 ? Math.round((totalLL / totalTarget) * 100) : 0}%)</span>
                  </p>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex items-center justify-center flex-col text-center gap-1">
                  <div className="w-6 h-6 bg-pink-50 rounded-full flex items-center justify-center text-pink-500 mb-0.5">
                    <Users className="w-3 h-3" />
                  </div>
                  <p className="text-[9px] font-bold text-slate-500 line-clamp-1">Vaccinated</p>
                  <p className="text-sm font-extrabold text-pink-700">
                    {totalVacc.toLocaleString('en-IN')}
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
                                {row.population !== null ? row.population.toLocaleString('en-IN') : '—'}
                              </td>
                              <td className="px-2 py-1 text-right font-bold text-slate-900">
                                {row.hpv_target !== null ? row.hpv_target.toLocaleString('en-IN') : '—'}
                              </td>
                              <td className="px-2 py-1 text-center text-slate-500 font-sans text-[10px]">
                                {row.last_reporting_date}
                              </td>
                              <td className="px-2 py-1 text-right font-semibold text-hpv-teal-dark">
                                {row.line_list_received !== null ? row.line_list_received.toLocaleString('en-IN') : '—'}
                              </td>
                              <td className="px-2 py-1 text-right font-extrabold text-emerald-600">
                                {row.beneficiaries_vaccinated !== null ? row.beneficiaries_vaccinated.toLocaleString('en-IN') : '—'}
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
            divisionsList={filteredDivisions}
            districtsList={filteredDistricts}
            blocksList={blocksList}
            filterLevel={filterLevel}
            setFilterLevel={setFilterLevel}
            filterStateId={filterStateId}
            setFilterStateId={setFilterStateId}
            filterDivisionId={filterDivisionId}
            setFilterDivisionId={setFilterDivisionId}
            filterDistrictId={filterDistrictId}
            setFilterDistrictId={setFilterDistrictId}
            filterBlockId={filterBlockId}
            setFilterBlockId={setFilterBlockId}
          />
        )}

        {/* TAB 3: LOCATIONS MASTER */}
        {activeTab === 'locations' && (
          <LocationMaster />
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
                {newAdminRole === 'ADMIN' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">State *</label>
                    <select value={newAdminStateId} onChange={e => setNewAdminStateId(e.target.value)} required
                      className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600">
                      <option value="">Select State</option>
                      {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
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
                    <th className="px-4 py-2">State</th>
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
                      <td className="px-4 py-2.5 font-semibold text-slate-500">
                        {u.state_name || '-'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-[10px]">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-IN') : 'Never'}
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
        {activeTab === 'activity' && adminUser?.role === 'SUPER_ADMIN' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Visitor Activity</h2>
                <p className="text-slate-500 mt-1">Track unique IP addresses and locations visiting the portal.</p>
              </div>
              <button onClick={fetchActivityData} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 font-semibold rounded-xl hover:bg-emerald-100 transition-colors">
                <RefreshCw className={`w-4 h-4 ${loadingActivity ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {loadingActivity ? (
                <div className="flex justify-center items-center py-12">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-4 font-semibold text-slate-600">IP Address</th>
                        <th className="p-4 font-semibold text-slate-600">Location</th>
                        <th className="p-4 font-semibold text-slate-600">Last Page Visited</th>
                        <th className="p-4 font-semibold text-slate-600">Last Visit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activityData.length === 0 ? (
                        <tr><td colSpan={4} className="p-8 text-center text-slate-500">No activity recorded yet.</td></tr>
                      ) : activityData.map((act: any) => (
                        <tr key={act.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 text-slate-800 font-mono text-sm">{act.ip_address}</td>
                          <td className="p-4 text-slate-600">{act.location}</td>
                          <td className="p-4 text-blue-600 font-medium">{act.last_page_visited}</td>
                          <td className="p-4 text-slate-500 text-sm">{new Date(act.updated_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

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
                        <td className="p-3 text-slate-500">{new Date(log.created_at).toLocaleString('en-IN')}</td>
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
          <AdminPopulation activeStateId={activeStateId} />
        )}

        {activeTab === 'upload' && adminUser?.role === 'SUPER_ADMIN' && (
          <SuperAdminUpload />
        )}
      </main>
    </div>
  );
};
