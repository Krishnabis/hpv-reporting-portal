import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, MapPin, Users, SettingsIcon,
  ShieldCheck, LogOut, Menu, X, Download, Filter, Search, Calendar,
  TrendingUp, CheckCircle, BarChart3, ChevronRight, ChevronLeft, ChevronDown, Hash, Eye, RefreshCw, Save,
  Building2, Edit2, Trash2, ClipboardList, FileSpreadsheet, Target, Bell,
  Syringe, SearchIcon, HeartPulse, UploadCloud, Activity, UsersIcon, Info, Clock, ShoppingCart, AlertTriangle
} from '../components/icons';
import { Logo } from '../components/Logo';
import { SearchableSelect, OptionItem } from '../components/SearchableSelect';
import { AdminTrend } from '../components/AdminTrend';
import { SuperAdminUpload } from '../components/SuperAdminUpload';
import { StateMap, getTier } from '../components/StateMap';
import { AdminPopulation } from '../components/AdminPopulation';
import { LocationMaster } from '../components/LocationMaster';
import { DailyProgressReport } from './DailyProgressReport';
import { ReportingCompleteness } from './ReportingCompleteness';
import { VaccineStockMonitoringReport } from './VaccineStockMonitoringReport';
import { VaccineStockLedger } from './VaccineStockLedger';
import { ColdChainLocations } from './ColdChainLocations';
import { getDefaultLocationForUser } from '../utils/userLocation';

// ─── Coming Soon Placeholder Component ─────────────────────────────────────────
const ComingSoonCard: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center flex-1 h-full p-12 bg-slate-50 text-slate-600 border border-slate-200 rounded-2xl shadow-xs min-h-[450px]">
    <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
      <Clock className="w-8 h-8" />
    </div>
    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{title}</h2>
    <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1 max-w-md text-center">{description}</p>
    <div className="mt-6 px-4 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-extrabold rounded-full border border-indigo-200">
      Feature Coming Soon
    </div>
  </div>
);

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
    district_id?: string;
    vaccinated: number;
    lineList: number;
    target: number;
    coveragePct: number;
    lineListPct: number;
  }>;
  block_chart_data?: Array<{
    district: string;
    block: string;
    block_id?: string;
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

type Tab = 
  | 'dashboard' 
  | 'vaccine-management' 
  | 'stock-receiving' 
  | 'stock-issuing' 
  | 'month-end-balance' 
  | 'monthly-report' 
  | 'reports' 
  | 'trend' 
  | 'locations' 
  | 'users' 
  | 'settings' 
  | 'audit' 
  | 'population' 
  | 'upload' 
  | 'activity' 
  | 'ccl-management' 
  | 'daily-progress' 
  | 'completeness-report' 
  | 'stock-monitoring'
  | 'monitoring'
  | 'due-list-report'
  | 'cold-chain-locations'
  | 'stock-ledger'
  | 'feedback';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>((sessionStorage.getItem('hpv_admin_active_tab') as Tab) || 'dashboard');
  

  const [usersOpen, setUsersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [programMgmtOpen, setProgramMgmtOpen] = useState(true);
  const [vaccineMgmtOpen, setVaccineMgmtOpen] = useState(true);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [reportingOpen, setReportingOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);
  
  // CCL Management state
  const [cclList, setCclList] = useState<any[]>([]);
  const [cclSearchTerm, setCclSearchTerm] = useState('');
  const [cclLoading, setCclLoading] = useState(false);

  // Carousel State
  const [carouselSlide, setCarouselSlide] = useState(0);

  useEffect(() => {
    // Auto-moving removed per user request
  }, []);

  const [cclEditModalOpen, setCclEditModalOpen] = useState(false);
  const [editingCcl, setEditingCcl] = useState<any>(null);

  
  
  const handleEditCcl = async () => {
    if (!editingCcl) return;
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const res = await fetch(`/api/superadmin/ccl/${editingCcl.id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editingCcl)
      });
      if (res.ok) {
        setCclEditModalOpen(false);
        fetchCclList();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update');
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteCcl = async (id: number) => {
    if (!confirm('Are you sure you want to delete this facility? This action cannot be undone.')) return;
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const res = await fetch(`/api/superadmin/ccl/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchCclList();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete');
      }
    } catch (err) { console.error(err); }
  };

  
  const handleExportCcl = () => {
    if (!cclList.length) return;
    const headers = [
      'State Name', 'LGD State Code', 
      'District Name', 'LGD District Code', 
      'Block Name', 'LGD Block Code',
      'Facility Name', 'Sub District Name', 'Facility Acronym', 'Hospital Facility ID',
      'ABDM Org Facility ID', 'Pin Code', 'Address', 'Latitude', 'Longitude', 'Altitude',
      'Contact Number', 'Health Facility Group', 'Health Facility Type', 'Setting',
      'ULB Code'
    ];
    
    const rows = cclList.map(c => [
      c.states?.name || '', c.lgd_state_code || '',
      c.districts?.name || '', c.lgd_district_code || '',
      c.blocks?.name || '', c.lgd_block_code || '',
      c.facility_name || '', c.sub_district_name || '', c.facility_acronym || '', c.hospital_facility_id || '',
      c.abdm_org_facility_id || '', c.pin_code || '', c.address || '', c.latitude || '', c.longitude || '', c.altitude || '',
      c.contact_number || '', c.health_facility_group || '', c.health_facility_type || '', c.setting || '',
      c.ulb_code || ''
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.map(f => `"${String(f).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "CCL_Facilities_Export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchCclList = async () => {
    setCclLoading(true);
    try {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      const res = await fetch('/api/superadmin/ccl-list', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setCclList(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    setCclLoading(false);
  };


  // KPIs State
  const [kpis, setKpis] = useState<KPIState | null>(null);
  const [loadingKpis, setLoadingKpis] = useState(true);

  // Report Generator Filter State
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dashboardStateId, setDashboardStateId] = useState<string>('');
  const defaultStateSet = useRef(false);

  const [statesList, setStatesList] = useState<any[]>([]);
  const [allDistrictsList, setAllDistrictsList] = useState<any[]>([]);
  const [divisionsList, setDivisionsList] = useState<any[]>([]);
  // Location add form
  const [addLocType, setAddLocType] = useState<'state' | 'district' | 'block' | 'urban'>('block');
  const [addLocName, setAddLocName] = useState('');
  const [addLocLgd, setAddLocLgd] = useState('');
  const [addLocStateId, setAddLocStateId] = useState('');
  const [addLocDistrictId, setAddLocDistrictId] = useState('');

  const [states, setStates] = useState<any[]>([]);
  const [filterLevel, setFilterLevel] = useState<'State' | 'Division' | 'District' | 'Block'>('District');
  const [filterStateId, setFilterStateId] = useState<string>('5');
  const [filterDivisionId, setFilterDivisionId] = useState<string>('ALL');
  const [filterDistrictId, setFilterDistrictId] = useState<string>('ALL');
  const [filterBlockId, setFilterBlockId] = useState<string>('ALL');

  const [districtsList, setDistrictsList] = useState<any[]>([]);

  useEffect(() => {
    if (statesList.length > 0 && adminUser && !defaultStateSet.current) {
      const defLoc = getDefaultLocationForUser(adminUser, statesList, allDistrictsList.length ? allDistrictsList : districtsList);
      if (defLoc.stateId) {
        setDashboardStateId(defLoc.stateId);
        setFilterStateId(defLoc.stateId);
      }
      if (defLoc.districtId) {
        setFilterDistrictId(defLoc.districtId);
      }
      defaultStateSet.current = true;
    }
  }, [statesList, allDistrictsList, districtsList, adminUser]);

  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [reportSortOrder, setReportSortOrder] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportViewMode, setReportViewMode] = useState<'table' | 'card'>('table');

  // Master Locations state
  const [masterBlocks, setMasterBlocks] = useState<any[]>([]);
  const [locationSearch, setLocationSearch] = useState('');

  const [addLocMsg, setAddLocMsg] = useState('');
  const [addLocLoading, setAddLocLoading] = useState(false);

  // Settings state — password change only
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const stateName = adminUser?.role === 'SUPER_ADMIN' ? (dashboardStateId ? statesList.find(s => String(s.id) === dashboardStateId)?.name || 'India' : 'India') : (adminUser?.state_name || (adminUser?.state_id ? statesList.find(s => String(s.id) === String(adminUser.state_id))?.name : '') || 'India');

  // Users state
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('ADMIN');
  const [newAdminStateId, setNewAdminStateId] = useState('');
  const [newAdminDistrictId, setNewAdminDistrictId] = useState('');
  const [newAdminCclId, setNewAdminCclId] = useState('');
  const [managerFacilities, setManagerFacilities] = useState<any[]>([]);

  useEffect(() => {
    if (newAdminRole === 'VACCINE_MANAGER' && newAdminStateId) {
      const token = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      Promise.all([
        fetch(`/api/vaccine/facilities?unit_level=1`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(`/api/vaccine/facilities?unit_level=2`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      ]).then(([l1, l2]) => {
        setManagerFacilities([...(Array.isArray(l1) ? l1 : []), ...(Array.isArray(l2) ? l2 : [])]);
      }).catch(err => console.error(err));
    } else {
      setManagerFacilities([]);
    }
  }, [newAdminRole, newAdminStateId]);
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

  // HPV Vaccine Dashboard state
  const [vaccDashboard, setVaccDashboard] = useState<any>(null);
  const [loadingVaccDashboard, setLoadingVaccDashboard] = useState(false);
  const [vaccFacilities, setVaccFacilities] = useState<any[]>([]);
  const [stockDate, setStockDate] = useState(new Date().toISOString().split('T')[0]);
  const [stockQty, setStockQty] = useState('');
  
  // Batch states
  const [receiveBatchNo, setReceiveBatchNo] = useState('');
  const [receiveManufacturer, setReceiveManufacturer] = useState('');
  const [receiveBatchExpiry, setReceiveBatchExpiry] = useState('');
  const [issueBatchNo, setIssueBatchNo] = useState('');
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);
  
  const [issueToLevel, setIssueToLevel] = useState<number>(2);
  const [issueFacilityId, setIssueFacilityId] = useState('');
  const [monthEndMonth, setMonthEndMonth] = useState('');
  const [monthEndQty, setMonthEndQty] = useState('');
  const [monthEndBatch, setMonthEndBatch] = useState('');
  const [stockRemarks, setStockRemarks] = useState('');
  const [reportingPersonName, setReportingPersonName] = useState('');
  const [reportingPersonMobile, setReportingPersonMobile] = useState('');
  const [stockMsg, setStockMsg] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockHistory, setStockHistory] = useState<any[]>([]);

  // Block Monthly Report States
  const [reportMonth, setReportMonth] = useState('');
  const [ccpStatusList, setCcpStatusList] = useState<any[]>([]);
  const [selectedCcp, setSelectedCcp] = useState<any>(null);
  const [monthlyReportBatch, setMonthlyReportBatch] = useState('');
  const [monthlyReportQty, setMonthlyReportQty] = useState('');
  const [monthlyReportRemarks, setMonthlyReportRemarks] = useState('');
  const [fetchingCcpStatus, setFetchingCcpStatus] = useState(false);

  const handleAuthError = (res: Response) => {
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('hpv_admin_token');
      localStorage.removeItem('hpv_admin_user');
      sessionStorage.removeItem('hpv_admin_token');
      sessionStorage.removeItem('hpv_admin_user');
      navigate('/admin/login');
      return true;
    }
    return false;
  };

  // Token Auth Verification
  useEffect(() => {
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    const userStr = (localStorage.getItem('hpv_admin_user') || sessionStorage.getItem('hpv_admin_user'));
    if (!token || !userStr) {
      navigate('/admin/login');
      return;
    }
    const parsedUser = JSON.parse(userStr);
    setAdminUser(parsedUser);
    
    // Automatically fetch latest user details to ensure missing metadata (like district name) is populated
    fetch('/api/admin/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setAdminUser(data.user);
          if (localStorage.getItem('hpv_admin_user')) localStorage.setItem('hpv_admin_user', JSON.stringify(data.user));
          if (sessionStorage.getItem('hpv_admin_user')) sessionStorage.setItem('hpv_admin_user', JSON.stringify(data.user));
        }
      }).catch(err => console.error(err));

    setIsAuthenticating(false);
    fetchKpis();
    fetchMasterLocations();
    fetchReport();
    fetchAlertCount();
  }, [navigate]);

  // Pre-load data in the background
  useEffect(() => {
    if (adminUser) {
      const tab = activeTab;
      if (tab === 'users' || tab === 'activity') setUsersOpen(true);
      if (tab === 'upload' || tab === 'settings' || tab === 'ccl-management') setSettingsOpen(true);
      if (tab === 'reports' || tab === 'trend') setAnalyticsOpen(true);

      // Preload data conditionally in the background
      fetchMasterLocations();
      fetchVaccineDashboard();
      fetchStockHistory();

      if (adminUser?.role === 'SUPER_ADMIN') {
        fetchAdminUsers();
        fetchAuditLogs();
        fetchActivityData();
        fetchCclList();
      }

      const isLvl2 = adminUser.district_id || String(adminUser.ccl_unit_level) === '2';
      // Only fetch batches conditionally to avoid state overwrite conflicts for shared state variables
      if (tab === 'stock-receiving') { fetchBatches(); }
      if (tab === 'stock-issuing') { fetchVaccFacilities(isLvl2 ? 3 : 2); fetchBatches(isLvl2 ? '2' : '1'); }
      if (tab === 'month-end-balance') { fetchBatches(isLvl2 ? '2' : '1'); }
      if (tab === 'monthly-report') { fetchBatches('3'); }
    }
  }, [adminUser]);

  const fetchAlertCount = () => {
    fetch(`/api/admin/population?state_id=${dashboardStateId}`, {
      headers: { 'Authorization': `Bearer ${(localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'))}` }
    })
      .then(res => {
        if (handleAuthError(res)) return [];
        return res.json();
      })
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
      .then(res => {
        if (handleAuthError(res)) return [];
        return res.json();
      })
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
        if (handleAuthError(res)) throw new Error('Auth failed');
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

  // Re-fetch when date changes or state/district filters update
  useEffect(() => {
    if (adminUser) {
      fetchKpis();
      fetchReport();
    }
  }, [filterDate, dashboardStateId, filterDistrictId]);

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
        if (handleAuthError(res)) throw new Error('Auth failed');
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
      .then(data => {
        if (Array.isArray(data)) {
          setAdminUsers(data);
        } else {
          console.error('Failed to fetch admin users:', data);
          setAdminUsers([]);
        }
      })
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
          role: newAdminRole === 'ADMIN' && newAdminDistrictId ? 'DISTRICT_ADMIN' : newAdminRole, 
          state_id: newAdminStateId || undefined,
          district_id: newAdminDistrictId || undefined,
          ccl_id: newAdminCclId || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add admin');
      setAddAdminMsg('✅ Admin added successfully!');
      setNewAdminName(''); setNewAdminUsername(''); setNewAdminPassword('');
      fetchAdminUsers();
    } catch (err: any) { setAddAdminMsg(`❌ ${err.message}`); }
    setAddAdminLoading(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      fetchAdminUsers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus ? 'disable' : 'enable'} this user?`)) return;
    try {
      const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
      const res = await fetch(`/api/admin/users/${userId}/toggle-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle status');
      fetchAdminUsers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSaveEditedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editingUser.name,
          username: editingUser.username,
          password: editingUser.password || undefined, // only send if provided
          role: editingUser.role,
          state_id: editingUser.state_id || undefined,
          district_id: editingUser.district_id || undefined,
          status: editingUser.status || (editingUser.is_active ? 'ACTIVE' : 'DISABLED')
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');
      setEditingUser(null);
      fetchAdminUsers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
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

  const fetchVaccineDashboard = () => {
    setLoadingVaccDashboard(true);
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    fetch(`/api/vaccine/dashboard?state_id=${activeStateId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          console.error('Backend returned error:', data.error);
          setVaccDashboard(null); // Prevents crash
        } else {
          setVaccDashboard(data);
        }
        setLoadingVaccDashboard(false);
      })
      .catch(err => { console.error('Failed to fetch vaccine dashboard:', err); setLoadingVaccDashboard(false); });
  };

  const fetchVaccFacilities = (level: number) => {
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    const params = new URLSearchParams({ unit_level: String(level) });
    if (activeStateId) params.set('state_id', activeStateId);
    if (adminUser?.district_id) params.set('district_id', String(adminUser.district_id));
    fetch(`/api/vaccine/facilities?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { setVaccFacilities(Array.isArray(data) ? data : []); })
      .catch(err => console.error(err));
  };

  const fetchStockHistory = () => {
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    fetch('/api/vaccine/stock', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setStockHistory(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  };

  const fetchBatches = (level?: string) => {
    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
    let url = '/api/vaccine/batches';
    if (level) url += `?level=${level}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setAvailableBatches(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  };

  const fetchBlockMonthlyReport = async (month: string) => {
    if (!month) return;
    setFetchingCcpStatus(true);
    setStockMsg(null);
    try {
      const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
      const res = await fetch(`/api/vaccine/monthly-report/status?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch CCP status');
      setCcpStatusList(data.ccps || []);
    } catch (err: any) {
      setStockMsg({ type: 'error', text: err.message });
      setCcpStatusList([]);
    }
    setFetchingCcpStatus(false);
  };

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    sessionStorage.setItem('hpv_admin_active_tab', tab);
    setMobileMenuOpen(false);
    setStockMsg(null);

    if (tab === 'users' || tab === 'activity') setUsersOpen(true);
    if (tab === 'upload' || tab === 'settings') setSettingsOpen(true);
    if (tab === 'reports' || tab === 'trend') setAnalyticsOpen(true);
    if (tab === 'locations') fetchMasterLocations();
    if (tab === 'users') fetchAdminUsers();
    if (tab === 'audit') fetchAuditLogs();
    if (tab === 'activity') fetchActivityData();
    if (tab === 'dashboard' || tab === 'vaccine-management') fetchVaccineDashboard();
    const isLvl2 = adminUser?.district_id || String(adminUser?.ccl_unit_level) === '2';
    if (tab === 'stock-receiving') { fetchStockHistory(); fetchBatches(); }
    if (tab === 'stock-issuing') { fetchVaccFacilities(isLvl2 ? 3 : 2); fetchStockHistory(); fetchBatches(isLvl2 ? '2' : '1'); }
    if (tab === 'month-end-balance') { fetchStockHistory(); fetchBatches(isLvl2 ? '2' : '1'); }
    if (tab === 'monthly-report') { fetchBatches('3'); }
    if (tab === 'ccl-management') { fetchCclList(); setSettingsOpen(true); }
  };

  const handleLogout = async () => {
    try {
      const t = localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token');
      if (t) {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${t}` }
        });
      }
    } catch (e) { console.error('Logout error', e); }
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
      <div className="h-[100dvh] w-full bg-[#f4f7fe] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-sm font-bold text-indigo-600">
            {isAuthenticating ? 'Checking authentication...' : 'Loading Dashboard...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-[#f4f7fe] flex flex-col lg:flex-row font-sans overflow-hidden relative text-slate-800">
      {/* Mobile Topbar */}
      <div className="lg:hidden bg-white shadow-sm border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-40 relative">
        <div className="bg-white/10 rounded-[2rem] px-3 py-1 flex items-center justify-center shadow-sm shrink-0 border border-white/10 backdrop-blur-md">
          <img src="/headinglogo.png" alt="HPV Kavach Login Logo" className="h-10 w-auto object-contain brightness-0 invert" />
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-md"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-white shadow-sm border-r border-slate-100 text-slate-500 flex flex-col justify-between transition-all duration-300 lg:sticky lg:top-0 lg:h-[100dvh] lg:shrink-0 ${
        mobileMenuOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full w-64'
      } ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} lg:translate-x-0 relative`}>
        <div className="flex flex-col flex-1 min-h-0">
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
            {/* 1. Dashboard */}
            <button
              onClick={() => handleTabChange('dashboard')}
              title="Dashboard"
              className={`w-full flex items-center ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} gap-3 px-4 py-2.5 rounded-xl transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
              }`}
            >
              <LayoutDashboard className={`w-5 h-5 shrink-0 ${activeTab === 'dashboard' ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'text-slate-400'}`} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Dashboard</span>
            </button>

            {/* 2. Monitoring (Coming Soon) */}
            <button
              onClick={() => handleTabChange('monitoring')}
              title="Monitoring"
              className={`w-full flex items-center ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} gap-3 px-4 py-2.5 rounded-xl transition-all ${
                activeTab === 'monitoring'
                  ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
              }`}
            >
              <Activity className={`w-5 h-5 shrink-0 ${activeTab === 'monitoring' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Monitoring</span>
            </button>

            {/* 3. PROGRAM MANAGEMENT */}
            <div className="pt-2">
              <button 
                onClick={() => { if (!sidebarCollapsed) setProgramMgmtOpen(!programMgmtOpen) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
                title="Program Management"
              >
                <span className={sidebarCollapsed ? 'hidden' : ''}>Program Management</span>
                {!sidebarCollapsed && (
                  <ChevronDown className={`w-4 h-4 transition-transform ${programMgmtOpen ? '' : '-rotate-90'}`} />
                )}
              </button>
              
              {(programMgmtOpen || sidebarCollapsed) && (
                <div className={`mt-1 space-y-1 ${sidebarCollapsed ? '' : 'pl-2 border-l-2 border-slate-100 ml-3'}`}>
                  {/* Block Units */}
                  <button
                    onClick={() => handleTabChange('locations')}
                    title="Block Units"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'locations' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                    }`}
                  >
                    <Building2 className={`w-4 h-4 shrink-0 ${activeTab === 'locations' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Block Units</span>
                  </button>

                  {/* Daily Progress */}
                  <button
                    onClick={() => handleTabChange('daily-progress')}
                    title="Daily Progress"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'daily-progress' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                    }`}
                  >
                    <BarChart3 className={`w-4 h-4 shrink-0 ${activeTab === 'daily-progress' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Daily Progress</span>
                  </button>

                  {/* Due List Report (Coming Soon) */}
                  <button
                    onClick={() => handleTabChange('due-list-report')}
                    title="Due List Report"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'due-list-report' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                    }`}
                  >
                    <ClipboardList className={`w-4 h-4 shrink-0 ${activeTab === 'due-list-report' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Due List Report</span>
                  </button>

                  {/* Reporting (%) */}
                  <button
                    onClick={() => handleTabChange('completeness-report')}
                    title="Reporting (%)"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'completeness-report' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                    }`}
                  >
                    <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'completeness-report' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Reporting (%)</span>
                  </button>

                  {/* Stock Availability (%) */}
                  <button
                    onClick={() => handleTabChange('stock-monitoring')}
                    title="Stock Availability (%)"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'stock-monitoring' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                    }`}
                  >
                    <Activity className={`w-4 h-4 shrink-0 ${activeTab === 'stock-monitoring' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm whitespace-nowrap'}>Stock Availability (%)</span>
                  </button>

                  {/* Trends */}
                  <button
                    onClick={() => handleTabChange('trend')}
                    title="Trends"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'trend' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                    }`}
                  >
                    <TrendingUp className={`w-4 h-4 shrink-0 ${activeTab === 'trend' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Trends</span>
                  </button>
                </div>
              )}
            </div>

            {/* 4. VACCINE MANAGEMENT */}
            <div className="pt-2">
              <button 
                onClick={() => { if (!sidebarCollapsed) setVaccineMgmtOpen(!vaccineMgmtOpen) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
                title="Vaccine Management"
              >
                <span className={sidebarCollapsed ? 'hidden' : ''}>Vaccine Management</span>
                {!sidebarCollapsed && (
                  <ChevronDown className={`w-4 h-4 transition-transform ${vaccineMgmtOpen ? '' : '-rotate-90'}`} />
                )}
              </button>
              
              {(vaccineMgmtOpen || sidebarCollapsed) && (
                <div className={`mt-1 space-y-1 ${sidebarCollapsed ? '' : 'pl-2 border-l-2 border-slate-100 ml-3'}`}>
                  {/* Cold Chain Locations (Coming Soon) */}
                  <button
                    onClick={() => handleTabChange('cold-chain-locations')}
                    title="Cold Chain Locations"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'cold-chain-locations' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                    }`}
                  >
                    <MapPin className={`w-4 h-4 shrink-0 ${activeTab === 'cold-chain-locations' ? 'text-pink-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm whitespace-nowrap'}>Cold Chain Locations</span>
                  </button>

                  {/* Stock Receipt (ONLY State, Level 1, Superadmin) */}
                  {(['SUPER_ADMIN', 'STATE_ADMIN'].includes(adminUser?.role) || (adminUser?.role === 'ADMIN' && !adminUser?.district_id)) && (
                    <button
                      onClick={() => handleTabChange('stock-receiving')}
                      title="Stock Receipt"
                      className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                        activeTab === 'stock-receiving' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                      }`}
                    >
                      <FileSpreadsheet className={`w-4 h-4 shrink-0 ${activeTab === 'stock-receiving' ? 'text-pink-600' : 'text-slate-400'}`} />
                      <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Stock Receipt</span>
                    </button>
                  )}

                  {/* Stock Issue */}
                  <button
                    onClick={() => handleTabChange('stock-issuing')}
                    title="Stock Issue"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'stock-issuing' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                    }`}
                  >
                    <Syringe className={`w-4 h-4 shrink-0 ${activeTab === 'stock-issuing' ? 'text-pink-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Stock Issue</span>
                  </button>

                  {/* Month-End Balance */}
                  <button
                    onClick={() => handleTabChange('month-end-balance')}
                    title="Month-End Balance"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'month-end-balance' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                    }`}
                  >
                    <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'month-end-balance' ? 'text-pink-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Month-End Balance</span>
                  </button>

                  {/* Stock Ledger (New page coming soon) */}
                  <button
                    onClick={() => handleTabChange('stock-ledger')}
                    title="Stock Ledger"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'stock-ledger' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                    }`}
                  >
                    <ClipboardList className={`w-4 h-4 shrink-0 ${activeTab === 'stock-ledger' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Stock Ledger</span>
                  </button>

                </div>
              )}
            </div>

            {/* 5. USER MANAGEMENT (Only Superadmin) */}
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
                        activeTab === 'users' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                      }`}
                    >
                      <UsersIcon className={`w-4 h-4 shrink-0 ${activeTab === 'users' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Admin Users</span>
                    </button>
                    <button
                      onClick={() => handleTabChange('activity')}
                      title="Activity"
                      className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                        activeTab === 'activity' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                      }`}
                    >
                      <Activity className={`w-4 h-4 shrink-0 ${activeTab === 'activity' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Activity</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 6. SETTINGS */}
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
                  {/* Upload CSV (Only Superadmin) */}
                  {adminUser?.role === 'SUPER_ADMIN' && (
                    <button
                      onClick={() => handleTabChange('upload')}
                      title="Upload CSV"
                      className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                        activeTab === 'upload' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                      }`}
                    >
                      <UploadCloud className={`w-4 h-4 shrink-0 ${activeTab === 'upload' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Upload CSV</span>
                    </button>
                  )}

                  {/* Update Password (All) */}
                  <button
                    onClick={() => handleTabChange('settings')}
                    title="Update Password"
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 rounded-lg transition-all ${
                      activeTab === 'settings' ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
                    }`}
                  >
                    <SettingsIcon className={`w-4 h-4 shrink-0 ${activeTab === 'settings' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={sidebarCollapsed ? 'hidden' : 'text-sm'}>Update Password</span>
                  </button>
                </div>
              )}
            </div>

            {/* 7. FEEDBACK (All) */}
            <button
              onClick={() => handleTabChange('feedback')}
              title="Feedback"
              className={`w-full flex items-center ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''} gap-3 px-4 py-2.5 rounded-xl transition-all ${
                activeTab === 'feedback'
                  ? 'bg-[#3A0088] text-white font-bold rounded-xl shadow-[0_0_15px_rgba(91,88,199,0.6)]'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-all'
              }`}
            >
              <HeartPulse className={`w-5 h-5 shrink-0 ${activeTab === 'feedback' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Feedback</span>
            </button>
          </nav>
        </div>


        {/* Slogan Badge */}
        <div className={`mx-3 mt-auto mb-2 flex items-center justify-between gap-2 bg-blue-50/50 px-3 py-2 rounded-xl border border-blue-100/50 shrink-0 ${sidebarCollapsed ? 'hidden' : 'flex'}`}>
          <div className="text-right flex-1">
            <span className="text-[10px] font-semibold text-slate-500 block">Together, we can build</span>
            <span className="text-[11px] font-bold text-blue-600 block">a healthier {adminUser?.role === 'SUPER_ADMIN' ? (dashboardStateId ? statesList.find(s => String(s.id) === dashboardStateId)?.name : 'India') : (adminUser?.district_name ? `${adminUser.district_name}, ` : '') + (adminUser?.state_name || (adminUser?.state_id ? statesList.find(s => String(s.id) === String(adminUser.state_id))?.name : '') || 'State')}</span>
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
        <div className={activeTab === 'dashboard' ? 'contents' : 'hidden'}>
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
                    <span className="text-[#188E94]">
                      Monitoring Dashboard:
                    </span>
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
                      <span className="text-purple-900 ml-1">
                        {adminUser?.state_name || 'Assigned State'}
                        {adminUser?.role === 'VACCINE_MANAGER' ? (
                          <span>
                            {adminUser.district_name ? ` - ${adminUser.district_name}` : ''}
                            {adminUser.ccl_facility_name ? ` - ${adminUser.ccl_facility_name}` : ''}
                          </span>
                        ) : adminUser?.role === 'DISTRICT_ADMIN' || adminUser?.district_name ? (
                          <span> - {adminUser.district_name || 'District'} Admin</span>
                        ) : (
                          <span> - State Admin</span>
                        )}
                      </span>
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Total Population */}
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                  <div className="flex gap-3 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                      <img src="/target_icon.svg" alt="Target" className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate">
                          HPV VACC. TARGET
                        </span>
                      </div>
                      <span className="text-2xl font-extrabold font-mono text-slate-900 leading-none mt-1">
                        {kpis?.total_target?.toLocaleString('en-IN') || '—'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between z-10 relative">
                    <span className="text-[9px] text-slate-400">Total population</span>
                    <span className="text-[10px] font-bold font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                      {kpis?.total_population ? kpis.total_population.toLocaleString('en-IN') : '—'}
                    </span>
                  </div>
                </div>

                {/* Card 2: Reporting Today */}
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate">
                        REPORTING SITES
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
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 truncate">
                        GIRLS LINE LISTED
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
                        GIRLS VACCINATED
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
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <img src="/favicon.jpg" className="w-5 h-5 object-contain" alt="Ranking" />
                    <span>{selectedDistrict ? 'Block Ranking' : 'District Ranking'}</span>
                    {selectedDistrict && (
                      <button 
                        onClick={() => setSelectedDistrict(null)}
                        className="text-[9px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 bg-blue-50 px-1.5 py-0.5 rounded transition-colors ml-1"
                      >
                        ← Back
                      </button>
                    )}
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
                <div className="flex items-center gap-1.5 mt-2 mb-3 pb-2 border-b border-slate-100">
                  <span className="font-extrabold text-base text-slate-800">{selectedDistrict ? selectedDistrict : stateName}</span>
                  <span className="text-xs font-semibold text-slate-500">
                    ({(selectedDistrict 
                        ? (kpis?.district_chart_data.find((d: any) => d.district === selectedDistrict)?.[selectedKpi === 'linelist' ? 'lineList' : 'vaccinated']?.toLocaleString('en-IN') || 0)
                        : ((selectedKpi === 'linelist' ? kpis?.total_line_list : kpis?.total_vaccinated)?.toLocaleString('en-IN') || 0))} 
                     {' / '}
                     {(selectedDistrict 
                        ? (kpis?.district_chart_data.find((d: any) => d.district === selectedDistrict)?.target?.toLocaleString('en-IN') || 0)
                        : (kpis?.total_target?.toLocaleString('en-IN') || 0))})
                  </span>
                  {selectedKpi === 'coverage' && (
                    <span className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded text-[11px] leading-none">
                      ({selectedDistrict ? (kpis?.district_chart_data.find((d: any) => d.district === selectedDistrict)?.coveragePct || 0) : (kpis?.overall_coverage_pct || 0)}%)
                    </span>
                  )}
                  {selectedKpi === 'linelist' && (
                    <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[11px] leading-none">
                      ({selectedDistrict ? (kpis?.district_chart_data.find((d: any) => d.district === selectedDistrict)?.lineListPct || 0) : (kpis?.overall_linelist_pct || 0)}%)
                    </span>
                  )}
                  {selectedKpi === 'both' && (
                    <>
                      <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[11px] leading-none">
                        LL: {selectedDistrict ? (kpis?.district_chart_data.find((d: any) => d.district === selectedDistrict)?.lineListPct || 0) : (kpis?.overall_linelist_pct || 0)}%
                      </span>
                      <span className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded text-[11px] leading-none">
                        Cov: {selectedDistrict ? (kpis?.district_chart_data.find((d: any) => d.district === selectedDistrict)?.coveragePct || 0) : (kpis?.overall_coverage_pct || 0)}%
                      </span>
                    </>
                  )}
                  <div title="Ranks districts and reporting units (Blocks/Cities) by the selected indicator and shows cumulative progress against the relevant benchmark (e.g., annual target, vaccine supply, or other applicable denominator). Legend: Aspirational <30%, Progressing 30-70%, High Performing 70-90%, Champions >90%" className="cursor-help inline-flex items-center">
                    <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
                  </div>
                </div>





                {((!selectedDistrict && kpis?.district_chart_data && kpis.district_chart_data.length > 0) || 
                  (selectedDistrict && kpis?.block_chart_data && kpis.block_chart_data.some((b: any) => b.district === selectedDistrict))) ? (
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 sm:gap-y-1.5 pb-2">
                    {(!selectedDistrict ? [...(kpis?.district_chart_data || [])] : [...(kpis?.block_chart_data || []).filter((b: any) => b.district === selectedDistrict)])
                       .sort((a, b) => {
                        const pa = selectedKpi === 'linelist' ? a.lineListPct : a.coveragePct;
                        const pb = selectedKpi === 'linelist' ? b.lineListPct : b.coveragePct;
                        return pb - pa;
                      })
                      .map((d: any, idx: number) => {
                        const covPct = d.coveragePct;
                        const llPct = d.lineListPct ?? 0;
                        const primaryPct = selectedKpi === 'linelist' ? llPct : covPct;
                        const primaryVal = selectedKpi === 'linelist' ? d.lineList : d.vaccinated;
                        const tier = getTier(primaryPct);
                        const isBlock = !!selectedDistrict;
                        const rowName = isBlock ? d.block : d.district;
                        return (
                          <div 
                            key={isBlock ? d.block_id : d.district_id} 
                            onClick={() => {
                              if (isBlock) return;
                              if (adminUser?.role === 'DISTRICT_ADMIN' && d.district !== adminUser.district_name) return;
                              setSelectedDistrict(d.district);
                            }}
                            className={`flex items-center py-1 sm:py-1.5 rounded hover:bg-slate-50 transition-colors border-b border-slate-100 gap-1.5 ${(!isBlock && (adminUser?.role !== 'DISTRICT_ADMIN' || d.district === adminUser.district_name)) ? 'cursor-pointer hover:bg-blue-50/50' : ''} ${(!isBlock && adminUser?.role === 'DISTRICT_ADMIN' && d.district !== adminUser.district_name) ? 'opacity-70 grayscale' : ''}`}
                          >
                            <span className="text-[10px] font-bold text-slate-400 w-4 shrink-0 text-center">{idx + 1}</span>
                            <div className="flex-1 min-w-0 flex items-baseline gap-1 truncate">
                              <span className="text-[11px] font-bold text-slate-800 truncate">
                                {rowName}
                                {!isBlock && rowName.toLowerCase() === 'chamoli' && (
                                  <span title="Vaccine Active"><Syringe className="w-3 h-3 text-pink-500 inline-block ml-1 -mt-0.5" /></span>
                                )}
                                {isBlock && d.is_urban && (
                                  <span className="text-slate-400 font-medium ml-1">
                                    Urban
                                  </span>
                                )}
                              </span>
                              <span className="text-[9px] font-semibold text-slate-400 shrink-0 flex items-center gap-0.5">
                                (<Target className="w-2.5 h-2.5 inline-block" /> {d.target.toLocaleString('en-IN')})
                              </span>
                              {(selectedKpi === 'linelist' ? d.deltaLineList : d.deltaVaccinated) > 0 && (
                                <span className="flex items-center text-emerald-500 font-bold text-[9px] shrink-0 ml-1 bg-emerald-50 px-1 rounded" title={`+${selectedKpi === 'linelist' ? d.deltaLineList : d.deltaVaccinated} since last report`}>
                                  <TrendingUp className="w-2.5 h-2.5" />
                                  <span className="ml-0.5">{(selectedKpi === 'linelist' ? d.deltaLineList : d.deltaVaccinated).toLocaleString('en-IN')}</span>
                                </span>
                              )}
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
                    {selectedDistrict ? `No block data available for ${selectedDistrict}.` : 'No district data — blocks need population setup.'}
                  </div>
                )}
              </div>

              {/* Bottom Left Carousel (Moved inside Left Column) */}
              <div className="relative bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200 flex-shrink-0 group">
                <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${carouselSlide * 100}%)` }}>
                  {/* Slide 1: Global Strategy */}
                  <div className="min-w-full w-full shrink-0">
                    <div className="p-2 sm:p-2.5 bg-[#14233c] border-b border-slate-200 flex items-center justify-center gap-2">
                      <HeartPulse className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400 shrink-0" />
                      <h3 className="text-[12px] sm:text-sm font-bold text-white tracking-wide text-center">Global Strategy to Eliminate Cervical Cancer by 2030</h3>
                    </div>
                    <div className="p-2 sm:p-3 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                      {/* 90% Vaccinated */}
                      <div className="bg-pink-50/50 rounded-xl border border-pink-200 p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-1.5 transition-colors hover:shadow-md">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl sm:text-3xl font-black text-[#e81c6a] tracking-tighter">90%</span>
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-pink-100">
                            <Syringe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#e81c6a]" />
                          </div>
                        </div>
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-800 leading-tight">
                          of Girls Vaccinated<br />Against HPV by Age 15
                        </p>
                      </div>
                      {/* 70% Screened */}
                      <div className="bg-teal-50/50 rounded-xl border border-teal-200 p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-1.5 transition-colors hover:shadow-md">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl sm:text-3xl font-black text-[#438392] tracking-tighter">70%</span>
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-teal-100">
                            <SearchIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#438392]" />
                          </div>
                        </div>
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-800 leading-tight">
                          of Women Screened with a<br />high-performance test by<br />Ages 35 and 45
                        </p>
                      </div>
                      {/* 90% Treated */}
                      <div className="bg-purple-50/50 rounded-xl border border-purple-200 p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-1.5 transition-colors hover:shadow-md">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl sm:text-3xl font-black text-[#694b8c] tracking-tighter">90%</span>
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-purple-100">
                            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#694b8c]" />
                          </div>
                        </div>
                        <p className="text-[9px] sm:text-[10px] font-bold text-slate-800 leading-tight">
                          of Women identified with<br />Cervical Disease<br />Receive Treatment
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Slide 2: Vaccine Stock Alert */}
                  <div className="min-w-full w-full shrink-0 flex items-center justify-center p-2 pb-4 gap-2 bg-white">
                    
                    {/* Left Header */}
                    <div className="bg-indigo-50/50 rounded-xl border border-indigo-100 p-2 flex flex-col items-center justify-center gap-1.5 shadow-sm relative h-full flex-1">
                      <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full border border-indigo-200 flex items-center justify-center text-indigo-400 text-[9px] italic font-serif bg-white cursor-help" title="Based on total stock balance across districts and blocks">i</div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-indigo-900" />
                      </div>
                      <h3 className="text-xs font-extrabold text-indigo-900 leading-tight text-center">Vaccine<br/>Stock Alert</h3>
                    </div>

                    {/* Middle: Critical */}
                    <div className="bg-red-50/50 rounded-xl border border-red-100 p-2 flex flex-col justify-center shadow-sm h-full flex-[1.5]">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-extrabold text-red-600">Critical</span>
                          <span className="text-[8px] font-bold text-red-500 bg-red-100/80 px-1.5 py-0.5 rounded-full">Replenish Now</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-around mt-1">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-red-600 leading-none">13</span>
                          <span className="text-[9px] text-red-500 font-medium">Districts</span>
                        </div>
                        <div className="w-px h-5 bg-red-200"></div>
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-red-600 leading-none">116</span>
                          <span className="text-[9px] text-red-500 font-medium">Blocks</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Re-Order */}
                    <div className="bg-orange-50/50 rounded-xl border border-orange-100 p-2 flex flex-col justify-center shadow-sm h-full flex-[1.5]">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                          <ShoppingCart className="w-3.5 h-3.5 text-orange-500" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-extrabold text-orange-700">Re-Order</span>
                          <span className="text-[8px] font-bold text-orange-600 bg-orange-100/80 px-1.5 py-0.5 rounded-full">Re-order stock</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-around mt-1">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-orange-600 leading-none">0</span>
                          <span className="text-[9px] text-orange-500 font-medium">Districts</span>
                        </div>
                        <div className="w-px h-5 bg-orange-200"></div>
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-bold text-orange-600 leading-none">1</span>
                          <span className="text-[9px] text-orange-500 font-medium">Blocks</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
                
                {/* Navigation Arrows */}
                <button 
                  onClick={() => setCarouselSlide(0)} 
                  className={`absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors z-20 ${carouselSlide === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                >
                  <ChevronLeft className="w-4 h-4 ml-[-1px]" />
                </button>
                <button 
                  onClick={() => setCarouselSlide(1)} 
                  className={`absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors z-20 ${carouselSlide === 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                >
                  <ChevronRight className="w-4 h-4 mr-[-1px]" />
                </button>

                {/* Dots */}
                <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-1.5 z-10">
                  <button onClick={() => setCarouselSlide(0)} className={`w-1.5 h-1.5 rounded-full transition-all ${carouselSlide === 0 ? 'bg-indigo-500 w-3' : 'bg-slate-300'}`}></button>
                  <button onClick={() => setCarouselSlide(1)} className={`w-1.5 h-1.5 rounded-full transition-all ${carouselSlide === 1 ? 'bg-indigo-500 w-3' : 'bg-slate-300'}`}></button>
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
                        <div className="absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 w-max bg-slate-800 text-white p-2.5 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] font-medium shadow-xl">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-slate-200">Vaccination Coverage (%) =</span>
                            <div className="flex flex-col items-center">
                              <span className="text-[9px]">Beneficiaries Vaccinated</span>
                              <div className="w-full h-px bg-slate-500 my-1"></div>
                              <span className="text-[9px]">HPV Target</span>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-200">× 100</span>
                          </div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[4px] border-x-transparent border-t-[4px] border-t-slate-800" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group relative">
                      <span className="text-purple-900 font-semibold">Line Listed (%)</span>
                      <div className="w-3.5 h-3.5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 cursor-help hover:bg-slate-200 hover:text-purple-900 transition-colors shrink-0">
                        <span className="text-[9px] font-bold italic font-serif">i</span>
                        <div className="absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 w-max bg-slate-800 text-white p-2.5 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] font-medium shadow-xl">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-slate-200">Line Listed (%) =</span>
                            <div className="flex flex-col items-center">
                              <span className="text-[9px]">Beneficiaries Line Listed</span>
                              <div className="w-full h-px bg-slate-500 my-1"></div>
                              <span className="text-[9px]">HPV Target</span>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-200">× 100</span>
                          </div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[4px] border-x-transparent border-t-[4px] border-t-slate-800" />
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
                    selectedDistrict={selectedDistrict}
                    onDistrictClick={(d) => {
                      if (adminUser?.role === 'DISTRICT_ADMIN' && d !== adminUser.district_name) return;
                      setSelectedDistrict(d);
                    }}
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
        </div>
        <div className={activeTab === 'vaccine-management' ? 'contents' : 'hidden'}>
          <div className="flex flex-col min-h-full lg:h-full gap-2 lg:min-h-0 max-w-7xl mx-auto w-full pb-10 lg:pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  Last Updated On: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, ' ')}
                </div>
                <div className="flex items-center gap-2 group relative">
                  <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-1.5 flex-wrap">
                    <span className="text-[#188E94]">
                      HPV Vaccine Monitoring Dashboard:
                    </span>
                    {adminUser?.role === 'SUPER_ADMIN' ? (
                      <select 
                        value={dashboardStateId} 
                        onChange={(e) => { setDashboardStateId(e.target.value); }}
                        className="text-purple-900 bg-transparent outline-none cursor-pointer border-b-2 border-transparent hover:border-purple-300 ml-1 pb-0.5 text-lg"
                      >
                        <option value="">All States</option>
                        {statesList.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                      </select>
                    ) : (
                      <span className="text-purple-900 ml-1">
                        {adminUser?.state_name || 'Assigned State'}
                        {adminUser?.role === 'VACCINE_MANAGER' ? (
                          <span>
                            {adminUser.district_name ? ` - ${adminUser.district_name}` : ''}
                            {adminUser.ccl_facility_name ? ` - ${adminUser.ccl_facility_name}` : ''}
                          </span>
                        ) : adminUser?.role === 'DISTRICT_ADMIN' || adminUser?.district_name ? (
                          <span> - {adminUser.district_name || 'District'} Admin</span>
                        ) : (
                          <span> - State Admin</span>
                        )}
                      </span>
                    )}
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchVaccineDashboard}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-blue-600 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>
            </div>

            {loadingVaccDashboard && !vaccDashboard ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-sm font-semibold text-slate-400 animate-pulse">Loading vaccine dashboard...</div>
              </div>
            ) : (
              <>
                {/* KPI Cards Grid — 4 cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {/* Card 1: State / Divisional Level */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden border-t-4 border-t-blue-500 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">State / Divisional Level</span>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{vaccDashboard?.state?.stores || 0} Stores</span>
                    </div>
                    <div className="flex items-stretch gap-0 mb-2">
                      <div className="flex-1 pr-2">
                        <span className="text-[9px] text-slate-400 block">Vaccine Received</span>
                        <span className="text-lg font-extrabold font-mono text-slate-900 leading-tight">{(vaccDashboard?.state?.received || 0).toLocaleString('en-IN')}</span>
                        <span className="text-[9px] text-slate-400 ml-1">doses</span>
                      </div>
                      <div className="w-px bg-slate-200 self-stretch mx-1"></div>
                      <div className="flex-1 pl-2">
                        <span className="text-[9px] text-slate-400 block">Stock Balance</span>
                        <span className="text-lg font-extrabold font-mono text-slate-900 leading-tight">{(vaccDashboard?.state?.stockBalance || 0).toLocaleString('en-IN')}</span>
                        <span className="text-[9px] text-slate-400 ml-1">doses</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[8px] text-slate-400 block">Month End Balance</span>
                        <span className="text-[10px] font-bold font-mono text-blue-700">{(vaccDashboard?.state?.monthEndBalance || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] text-slate-400 block">VWF</span>
                        <span className="text-[10px] font-bold font-mono text-blue-700">{vaccDashboard?.state?.vwf?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: District Level */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden border-t-4 border-t-purple-500 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">District Level</span>
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{vaccDashboard?.district?.stores || 0} Stores</span>
                    </div>
                    <div className="flex items-stretch gap-0 mb-2">
                      <div className="flex-1 pr-2">
                        <span className="text-[9px] text-slate-400 block">Vaccine Issued</span>
                        <span className="text-lg font-extrabold font-mono text-slate-900 leading-tight">{(vaccDashboard?.district?.issued || 0).toLocaleString('en-IN')}</span>
                        <span className="text-[9px] text-slate-400 ml-1">doses</span>
                      </div>
                      <div className="w-px bg-slate-200 self-stretch mx-1"></div>
                      <div className="flex-1 pl-2">
                        <span className="text-[9px] text-slate-400 block">Stock Balance</span>
                        <span className="text-lg font-extrabold font-mono text-slate-900 leading-tight">{(vaccDashboard?.district?.stockBalance || 0).toLocaleString('en-IN')}</span>
                        <span className="text-[9px] text-slate-400 ml-1">doses</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[8px] text-slate-400 block">Month End Balance</span>
                        <span className="text-[10px] font-bold font-mono text-purple-700">{(vaccDashboard?.district?.monthEndBalance || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] text-slate-400 block">VWF</span>
                        <span className="text-[10px] font-bold font-mono text-purple-700">{vaccDashboard?.district?.vwf?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Block Level */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden border-t-4 border-t-emerald-500 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Block Level</span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{vaccDashboard?.block?.coldChainPoints || 0} CCPs</span>
                    </div>
                    <div className="flex items-stretch gap-0 mb-2">
                      <div className="flex-1 pr-2">
                        <span className="text-[9px] text-slate-400 block">Vaccine Received</span>
                        <span className="text-lg font-extrabold font-mono text-slate-900 leading-tight">{(vaccDashboard?.block?.received || 0).toLocaleString('en-IN')}</span>
                        <span className="text-[9px] text-slate-400 ml-1">doses</span>
                      </div>
                      <div className="w-px bg-slate-200 self-stretch mx-1"></div>
                      <div className="flex-1 pl-2">
                        <span className="text-[9px] text-slate-400 block">Stock Balance</span>
                        <span className="text-lg font-extrabold font-mono text-slate-900 leading-tight">{(vaccDashboard?.block?.stockBalance || 0).toLocaleString('en-IN')}</span>
                        <span className="text-[9px] text-slate-400 ml-1">doses</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[8px] text-slate-400 block">Month End Balance</span>
                        <span className="text-[10px] font-bold font-mono text-emerald-700">{(vaccDashboard?.block?.monthEndBalance || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] text-slate-400 block">VWF</span>
                        <span className="text-[10px] font-bold font-mono text-emerald-700">{vaccDashboard?.block?.vwf?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: District Vaccine Utilisation % */}
                  <div className="bg-[#fff0f5] p-3 rounded-xl border border-pink-200 shadow-sm relative overflow-hidden border-t-4 border-t-pink-500 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">District Vaccine Utilisation</span>
                    <span className="text-4xl font-extrabold font-mono text-pink-600 leading-none">
                      {vaccDashboard?.utilization?.toFixed(1) || '0.0'}%
                    </span>
                    <div className="flex items-center gap-1.5 mt-2 text-slate-400">
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] leading-tight text-center font-medium">Total Beneficiaries Vaccinated</span>
                        <div className="w-full h-px bg-slate-300 my-0.5"></div>
                        <span className="text-[8px] leading-tight text-center font-medium">Total Vaccines Issued <strong className="text-purple-600 font-extrabold uppercase tracking-wide">TO</strong> District</span>
                      </div>
                      <span className="text-[10px] font-bold">× 100</span>
                    </div>
                  </div>
                </div>

                {/* Split Layout: Ranking & Map */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-2 flex-none lg:flex-1 lg:min-h-0">
                  {/* Left Column: District Ranking */}
                  <div className="lg:col-span-1 flex flex-col gap-2 lg:min-h-0">
                    <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 p-2 sm:p-3 sm:pb-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <img src="/favicon.jpg" className="w-5 h-5 object-contain" alt="Ranking" />
                          <span>{selectedDistrict ? 'Block Ranking' : 'District Ranking'}</span>
                          {selectedDistrict && (
                            <button 
                              onClick={() => setSelectedDistrict(null)}
                              className="text-[9px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 bg-blue-50 px-1.5 py-0.5 rounded transition-colors ml-1"
                            >
                              ← Back
                            </button>
                          )}
                        </h3>
                        <div className="text-[10px] sm:text-xs font-semibold text-slate-500 bg-slate-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-slate-200">
                          Vaccine Utilization (%)
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 mb-3 pb-2 border-b border-slate-100">
                        <span className="font-extrabold text-base text-slate-800">{selectedDistrict ? selectedDistrict : stateName}</span>
                        <span className="text-xs font-semibold text-slate-500">
                          ({selectedDistrict 
                            ? (vaccDashboard?.blockUtilization.filter((b: any) => b.district === selectedDistrict).reduce((acc: number, curr: any) => acc + (curr.vaccinated || 0), 0)?.toLocaleString('en-IN') || 0)
                            : (vaccDashboard?.districtUtilization.reduce((acc: number, curr: any) => acc + (curr.vaccinated || 0), 0)?.toLocaleString('en-IN') || 0)}
                           {' / '}
                           {selectedDistrict 
                            ? (vaccDashboard?.blockUtilization.filter((b: any) => b.district === selectedDistrict).reduce((acc: number, curr: any) => acc + (curr.issued || 0), 0)?.toLocaleString('en-IN') || 0)
                            : (vaccDashboard?.districtUtilization.reduce((acc: number, curr: any) => acc + (curr.issued || 0), 0)?.toLocaleString('en-IN') || 0)})
                        </span>
                        <span className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded text-[11px] leading-none">
                          ({selectedDistrict ? (vaccDashboard?.districtUtilization.find((d: any) => d.district === selectedDistrict)?.utilizationPct?.toFixed(1) || '0.0') : (vaccDashboard?.utilization?.toFixed(1) || '0.0')}%)
                        </span>
                        <div title="Ranks districts and reporting units (Blocks/Cities) by the selected indicator and shows cumulative progress against the relevant benchmark (e.g., annual target, vaccine supply, or other applicable denominator). Legend: Aspirational <30%, Progressing 30-70%, High Performing 70-90%, Champions >90%" className="cursor-help inline-flex items-center">
                          <Info className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
                        </div>
                      </div>





                      {((!selectedDistrict && vaccDashboard?.districtUtilization && vaccDashboard.districtUtilization.length > 0) || 
                        (selectedDistrict && vaccDashboard?.blockUtilization && vaccDashboard.blockUtilization.some((b: any) => b.district === selectedDistrict))) ? (
                        <div className="flex-1 min-h-0 overflow-y-auto">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 sm:gap-y-1.5 pb-2">
                            {(!selectedDistrict ? [...vaccDashboard.districtUtilization] : [...vaccDashboard.blockUtilization.filter((b: any) => b.district === selectedDistrict)]).map((d: any, idx: number) => {
                              const pct = d.utilizationPct;
                              const isBlock = !!selectedDistrict;
                              const rowName = isBlock ? d.block : d.district;
                              const isCrit = isBlock ? d.isCriticalStock : d.hasCriticalStockBlock;
                              const isLow = isBlock ? d.isLowStock : d.hasLowStockBlock;
                              
                              return (
                                <div 
                                  key={isBlock ? d.block_id : d.district_id} 
                                  onClick={() => {
                                    if (isBlock) return;
                                    if (adminUser?.role === 'DISTRICT_ADMIN' && d.district !== adminUser.district_name) return;
                                    setSelectedDistrict(d.district);
                                  }}
                                  className={`flex items-center py-1 sm:py-1.5 rounded hover:bg-slate-50 transition-colors border-b border-slate-100 gap-1.5 ${(!isBlock && (adminUser?.role !== 'DISTRICT_ADMIN' || d.district === adminUser.district_name)) ? 'cursor-pointer hover:bg-blue-50/50' : ''} ${(!isBlock && adminUser?.role === 'DISTRICT_ADMIN' && d.district !== adminUser.district_name) ? 'opacity-70 grayscale' : ''}`}
                                >
                                  <span className="text-[10px] font-bold text-slate-400 w-4 shrink-0 text-center">{idx + 1}</span>
                                  <div className="flex-1 min-w-0 flex items-center gap-1.5 truncate">
                                    <span className={`text-[11px] font-bold truncate shrink-0 ${isCrit ? 'text-red-700 bg-red-100 px-1 rounded' : isLow ? 'text-orange-600' : 'text-slate-800'}`}>
                                      {rowName}
                                      {!isBlock && rowName.toLowerCase() === 'chamoli' && (
                                        <span title="Vaccine Active"><Syringe className="w-3 h-3 text-pink-500 inline-block ml-1 -mt-0.5" /></span>
                                      )}
                                      {isBlock && d.is_urban && (
                                        <span className="text-slate-400 font-medium ml-1">Urban</span>
                                      )}
                                    </span>
                                    
                                    <div className="flex-1 border-b border-dashed border-slate-200 mx-1"></div>
                                    
                                    <div className="flex items-center gap-2 shrink-0">
                                      <div className="flex items-center gap-0.5" title="Total Issued">
                                        <Syringe className="w-3 h-3 text-blue-500" />
                                        <span className="text-[9px] font-bold text-slate-700">{d.issued?.toLocaleString('en-IN') || 0}</span>
                                      </div>
                                      <div className="flex items-center gap-1" title="Estimated Stock Balance">
                                        <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">Est. Bal:</span>
                                        <span className={`text-[10px] font-bold ${isCrit ? 'text-red-600' : isLow ? 'text-orange-500' : 'text-emerald-600'}`}>
                                          {d.stockBalance?.toLocaleString('en-IN') || 0}
                                        </span>
                                      </div>
                                      <div className="flex items-center" title="Utilization Percentage">
                                        <span className="text-[9px] font-bold text-pink-700 bg-pink-100 px-1.5 py-0.5 rounded shrink-0">
                                          {pct?.toFixed(1) || '0.0'}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-[10px] text-slate-400">
                          No utilization data available for this selection.
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Right: Uttarakhand Interactive Map */}
                  <div className="lg:col-span-1 bg-white p-2 lg:p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:overflow-hidden lg:min-h-0 min-h-[400px]">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-blue-500" /> {adminUser?.role === 'SUPER_ADMIN' ? (dashboardStateId ? statesList.find(s => String(s.id) === dashboardStateId)?.name || 'India' : 'India') : (adminUser?.state_name || 'State')} Overview
                      </h3>
                      <span className="text-xs font-semibold text-slate-500">{vaccDashboard?.district?.stores || 0} Districts</span>
                    </div>

                    <div className="text-[10px] text-left text-slate-500 mb-2 mt-1 flex items-center flex-wrap gap-1">
                      <span className="font-bold bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded">Showing:</span>
                      <div className="flex items-center gap-1 group relative">
                        <span className="text-purple-900 font-semibold">Vaccine Utilization (%)</span>
                        <div className="w-3.5 h-3.5 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 cursor-help hover:bg-slate-200 hover:text-purple-900 transition-colors shrink-0">
                          <span className="text-[9px] font-bold italic font-serif">i</span>
                          <div className="absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 w-max bg-slate-800 text-white p-2.5 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] font-medium shadow-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-slate-200">Vaccine Utilization (%) =</span>
                              <div className="flex flex-col items-center">
                                <span className="text-[9px]">Total Beneficiaries Vaccinated</span>
                                <div className="w-full h-px bg-slate-500 my-1"></div>
                                <span className="text-[9px]">Total Vaccines Issued <strong>TO</strong> District</span>
                              </div>
                              <span className="text-[10px] font-semibold text-slate-200">× 100</span>
                            </div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[4px] border-x-transparent border-t-[4px] border-t-slate-800" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-hidden relative pb-1">
                      <StateMap
                        stateName={adminUser?.role === 'SUPER_ADMIN' ? (dashboardStateId ? statesList.find(s => String(s.id) === dashboardStateId)?.name || 'India' : 'India') : (adminUser?.state_name || 'India')}
                        data={(vaccDashboard?.districtUtilization || []).map((d: any) => ({
                          district: d.district,
                          coveragePct: d.utilizationPct,
                          lineListPct: 0,
                          vaccinated: d.vaccinated,
                          lineList: 0,
                          target: d.issued || 1,
                        }))}
                        selectedKpi={'coverage'}
                        selectedDistrict={selectedDistrict}
                        onDistrictClick={(d) => {
                          if (adminUser?.role === 'DISTRICT_ADMIN' && d !== adminUser.district_name) return;
                          setSelectedDistrict(d);
                        }}
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
              </>
            )}
          </div>
        </div>

        {/* Stock Receiving Tab */}
        <div className={activeTab === 'stock-receiving' ? 'contents' : 'hidden'}>
          <div className="max-w-2xl mx-auto w-full space-y-6 pb-10">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Stock Receiving</h1>
              <p className="text-slate-500 text-sm mt-1">Record HPV Vaccine receipts at State level.</p>
            </div>
            {stockMsg && (
              <div className={`p-4 rounded-xl border text-sm font-semibold ${stockMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                {stockMsg.text}
              </div>
            )}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Date Received</label>
                <input type="date" value={stockDate} onChange={e => setStockDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Batch Number</label>
                <input type="text" value={receiveBatchNo} onChange={e => setReceiveBatchNo(e.target.value)} placeholder="Enter Batch No"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Manufacturer</label>
                  <input type="text" value={receiveManufacturer} onChange={e => setReceiveManufacturer(e.target.value)} placeholder="Manufacturer"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Batch Expiry</label>
                  <input type="date" value={receiveBatchExpiry} onChange={e => setReceiveBatchExpiry(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Vaccine</label>
                <input type="text" value="HPV Vaccine (Pre Filled)" disabled
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none cursor-not-allowed text-slate-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Quantity Received (Doses)</label>
                <input type="number" min="1" value={stockQty} onChange={e => setStockQty(e.target.value)} placeholder="Enter total number of doses received"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Remarks (Optional)</label>
                <textarea value={stockRemarks} onChange={e => setStockRemarks(e.target.value)} placeholder="Add any relevant comments, if required" rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button
                disabled={stockLoading || !stockQty || !stockDate || !receiveBatchNo}
                onClick={async () => {
                  setStockLoading(true); setStockMsg(null);
                  try {
                    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
                    const res = await fetch('/api/vaccine/stock/receive', {
                      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ 
                        date: stockDate, 
                        quantity: Number(stockQty), 
                        notes: stockRemarks,
                        batch_no: receiveBatchNo,
                        manufacture_name: receiveManufacturer,
                        batch_expiry_date: receiveBatchExpiry
                      })
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || 'Failed');
                    setStockMsg({ type: 'success', text: `Successfully received ${Number(stockQty).toLocaleString('en-IN')} doses for batch ${receiveBatchNo}` });
                    setStockQty(''); setStockRemarks(''); setReceiveBatchNo(''); setReceiveManufacturer(''); setReceiveBatchExpiry('');
                    fetchStockHistory();
                  } catch (err: any) { setStockMsg({ type: 'error', text: err.message }); }
                  setStockLoading(false);
                }}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stockLoading ? 'Submitting...' : 'Submit Stock Receipt'}
              </button>
            </div>

          </div>
        </div>

        {/* Stock Issuing Tab */}
        <div className={activeTab === 'stock-issuing' ? 'contents' : 'hidden'}>
          <div className="max-w-2xl mx-auto w-full space-y-6 pb-10">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Stock Issuing</h1>
              <p className="text-slate-500 text-sm mt-1">Issue HPV Vaccine to {adminUser?.district_id ? 'Block / Cold Chain Points' : 'facilities'}.</p>
            </div>
            {stockMsg && (
              <div className={`p-4 rounded-xl border text-sm font-semibold ${stockMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                {stockMsg.text}
              </div>
            )}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Date of Issue</label>
                <input type="date" value={stockDate} onChange={e => setStockDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Vaccine</label>
                <input type="text" value="HPV Vaccine" disabled
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none cursor-not-allowed text-slate-500" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Batch</label>
                <select value={issueBatchNo} onChange={e => setIssueBatchNo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Select a Batch --</option>
                  {availableBatches.map((b: any) => (
                    <option key={b.id} value={b.batch_no}>{b.batch_no} (Available: {b.quantity})</option>
                  ))}
                </select>
              </div>

              {/* Issue To level selector — State admin only */}
              {!adminUser?.district_id && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Issued To Level</label>
                  <select value={issueToLevel} onChange={e => { setIssueToLevel(Number(e.target.value)); setIssueFacilityId(''); fetchVaccFacilities(Number(e.target.value)); }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value={2}>District</option>
                    <option value={1}>State / Divisional</option>
                    <option value={3}>Block</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Issued To
                </label>
                <select value={issueFacilityId} onChange={e => setIssueFacilityId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select the receiving facility / storage location...</option>
                  {vaccFacilities.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.display_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Quantity Issued (Doses)</label>
                <input type="number" min="1" value={stockQty} onChange={e => setStockQty(e.target.value)} placeholder="Enter the number of doses issued"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Remarks (Optional)</label>
                <textarea value={stockRemarks} onChange={e => setStockRemarks(e.target.value)} placeholder="Add any relevant comments" rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <button
                disabled={stockLoading || !stockQty || !stockDate || !issueFacilityId || !issueBatchNo}
                onClick={async () => {
                  setStockLoading(true); setStockMsg(null);
                  try {
                    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
                    const destLevel = adminUser?.district_id ? 3 : issueToLevel;
                    const res = await fetch('/api/vaccine/stock/issue', {
                      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ 
                        date: stockDate, 
                        quantity: Number(stockQty), 
                        destination_level: destLevel, 
                        destination_facility_id: Number(issueFacilityId), // Actually issueFacilityId is a UUID string now but we leave as is if backend handles it
                        notes: stockRemarks,
                        batch_no: issueBatchNo
                      })
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || 'Failed');
                    setStockMsg({ type: 'success', text: `Successfully issued ${Number(stockQty).toLocaleString('en-IN')} doses for batch ${issueBatchNo}` });
                    setStockQty(''); setIssueFacilityId(''); setStockRemarks(''); setIssueBatchNo(''); 
                    fetchStockHistory();
                    fetchBatches(adminUser?.district_id || String(adminUser?.ccl_unit_level) === '2' ? '2' : '1');
                  } catch (err: any) { setStockMsg({ type: 'error', text: err.message }); }
                  setStockLoading(false);
                }}
                className="w-full py-2.5 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stockLoading ? 'Submitting...' : 'Submit Stock Issue'}
              </button>
            </div>

          </div>
        </div>

        {/* Month End Balance Tab */}
        <div className={activeTab === 'month-end-balance' ? 'contents' : 'hidden'}>
          <div className="max-w-2xl mx-auto w-full space-y-6 pb-10">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Month End Balance</h1>
              <p className="text-slate-500 text-sm mt-1">Record month-end HPV Vaccine stock balance.</p>
            </div>
            {stockMsg && (
              <div className={`p-4 rounded-xl border text-sm font-semibold ${stockMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                {stockMsg.text}
              </div>
            )}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reporting Month</label>
                <input type="month" value={monthEndMonth} onChange={e => setMonthEndMonth(e.target.value)}
                  max={(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })()}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Vaccine</label>
                <input type="text" value="HPV Vaccine (Pre Filled)" disabled
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none cursor-not-allowed text-slate-500" />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Batch Number</label>
                <select value={monthEndBatch} onChange={e => setMonthEndBatch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">-- Select Batch --</option>
                  {availableBatches.map((b: any) => (
                    <option key={b.id} value={b.batch_no}>{b.batch_no} (Estimated Balance = {b.quantity}, Exp: {b.batch_expiry_date ? new Date(b.batch_expiry_date).toLocaleDateString('en-GB') : 'N/A'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">HPV Vaccine Stock Balance (Doses)</label>

                <input type="number" min="0" value={monthEndQty} onChange={e => setMonthEndQty(e.target.value)} placeholder="Enter the actual physical balance available"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reporting Person Name</label>
                <input type="text" value={reportingPersonName} onChange={e => setReportingPersonName(e.target.value)} placeholder="Incharge of the Vaccine Storage Location"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reporting Person Mobile Number</label>
                <input type="tel" value={reportingPersonMobile} onChange={e => setReportingPersonMobile(e.target.value)} placeholder="Mobile number"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Remarks (Optional)</label>
                <textarea value={stockRemarks} onChange={e => setStockRemarks(e.target.value)} placeholder="Any relevant comments" rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button
                disabled={stockLoading || !monthEndQty || !monthEndMonth || !reportingPersonName || !reportingPersonMobile || !monthEndBatch}
                onClick={async () => {
                  setStockLoading(true); setStockMsg(null);
                  try {
                    const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
                    const res = await fetch('/api/vaccine/stock/month-end', {
                      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ month: monthEndMonth, quantity: Number(monthEndQty), reportingPersonName, reportingPersonMobile, notes: stockRemarks, batch_no: monthEndBatch })
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || 'Failed');
                    setStockMsg({ type: 'success', text: `Month-end balance recorded: ${Number(monthEndQty).toLocaleString('en-IN')} doses` });
                    setMonthEndQty(''); setMonthEndMonth(''); setReportingPersonName(''); setReportingPersonMobile(''); setStockRemarks(''); setMonthEndBatch(''); fetchStockHistory();
                  } catch (err: any) { setStockMsg({ type: 'error', text: err.message }); }
                  setStockLoading(false);
                }}
                className="w-full py-2.5 rounded-xl bg-pink-600 text-white font-bold text-sm hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stockLoading ? 'Submitting...' : 'Submit Month End Balance'}
              </button>
            </div>
            {/* Recent month-end balances */}
            {stockHistory.filter(t => t.transaction_type === 'MONTH_END_BALANCE').length > 0 && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-700 mb-3">Recent Month End Balances</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {stockHistory.filter(t => t.transaction_type === 'MONTH_END_BALANCE' || t.display_type === 'MONTH_END_BALANCE').slice(0, 10).map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <span className="text-xs text-slate-600">{(t.balance_month || t.transaction_date) ? new Date(t.balance_month || t.transaction_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—'}</span>
                      <span className="text-xs font-bold text-pink-700">{t.batch_no ? `[${t.batch_no}] ` : ''}{Number(t.quantity_doses || t.qty_doses).toLocaleString('en-IN')} doses</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Block Monthly Report Tab */}
        <div className={activeTab === 'monthly-report' ? 'contents' : 'hidden'}>
          <div className="max-w-4xl mx-auto w-full space-y-6 pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Monthly Report</h1>
                <p className="text-slate-500 text-sm mt-1">View and submit monthly stock balances for all CCPs in your Block.</p>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="month" 
                  value={reportMonth} 
                  onChange={e => {
                    setReportMonth(e.target.value);
                    if (e.target.value) fetchBlockMonthlyReport(e.target.value);
                  }}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white" 
                />
                <button 
                  onClick={() => fetchBlockMonthlyReport(reportMonth)}
                  disabled={!reportMonth || fetchingCcpStatus}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg text-sm font-bold hover:bg-pink-700 transition-colors disabled:opacity-50"
                >
                  {fetchingCcpStatus ? 'Loading...' : 'Fetch'}
                </button>
              </div>
            </div>

            {stockMsg && (
              <div className={`p-4 rounded-xl border text-sm font-semibold ${stockMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                {stockMsg.text}
              </div>
            )}

            {reportMonth && ccpStatusList.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Facility Name</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Manager / Contact</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ccpStatusList.map((ccp: any) => (
                      <tr key={ccp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-800">{ccp.facility_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          <div>{ccp.ccl_manager_handler_name || 'N/A'}</div>
                          <div className="text-xs text-slate-500">{ccp.ccl_manager_handler_mobile_no || 'N/A'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${ccp.status === 'Entered' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {ccp.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedCcp(ccp);
                              setMonthlyReportQty('');
                              setMonthlyReportRemarks('');
                              setMonthlyReportBatch('');
                            }}
                            className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            Submit Balance
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {reportMonth && ccpStatusList.length === 0 && !fetchingCcpStatus && (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
                <p className="text-slate-500 text-sm">No CCPs found for this block or unable to fetch.</p>
              </div>
            )}
          </div>
        </div>

        {/* TAB: MONITORING (COMING SOON) */}
        <div className={activeTab === 'monitoring' ? 'contents' : 'hidden'}>
          <ComingSoonCard 
            title="Monitoring Dashboard" 
            description="Real-time monitoring analytics and key performance indicators will be available here." 
          />
        </div>

        {/* TAB: DUE LIST REPORT (COMING SOON) */}
        <div className={activeTab === 'due-list-report' ? 'contents' : 'hidden'}>
          <ComingSoonCard 
            title="Due List Report" 
            description="Comprehensive beneficiary due lists and upcoming vaccination tracking report." 
          />
        </div>

        {/* TAB: COLD CHAIN LOCATIONS */}
        <div className={(activeTab === 'cold-chain-locations' || activeTab === 'ccl-management') ? 'contents' : 'hidden'}>
          <ColdChainLocations 
            states={statesList}
            allDistricts={allDistrictsList}
            masterBlocks={masterBlocks}
            divisions={divisionsList}
            adminUser={adminUser}
          />
        </div>

        {/* TAB: STOCK LEDGER */}
        <div className={activeTab === 'stock-ledger' ? 'contents' : 'hidden'}>
          <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
            <VaccineStockLedger 
              adminUser={adminUser}
              districts={allDistrictsList}
              states={statesList}
            />
          </div>
        </div>

        {/* TAB: DAILY PROGRESS REPORT */}
        <div className={activeTab === 'daily-progress' ? 'contents' : 'hidden'}>
          <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
            <DailyProgressReport 
              states={statesList}
              allDistricts={allDistrictsList}
              masterBlocks={masterBlocks}
              divisions={divisionsList}
              adminUser={adminUser}
            />
          </div>
        </div>

        {/* TAB: STOCK MONITORING REPORT */}
        <div className={activeTab === 'stock-monitoring' ? 'contents' : 'hidden'}>
          <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
            <VaccineStockMonitoringReport 
              adminUser={adminUser} 
              divisions={divisionsList}
              allDistricts={allDistrictsList}
              masterBlocks={masterBlocks}
              states={statesList}
            />
          </div>
        </div>

        {/* TAB: COMPLETENESS REPORT */}
        <div className={activeTab === 'completeness-report' ? 'contents' : 'hidden'}>
          <div className="flex flex-col flex-1 min-h-0 h-full overflow-auto bg-slate-50">
            <ReportingCompleteness
              states={statesList}
              allDistricts={allDistrictsList}
              masterBlocks={masterBlocks}
              divisions={divisionsList}
              adminUser={adminUser}
            />
          </div>
        </div>

        {/* TAB 2: REPORTS GENERATOR */}
        <div className={activeTab === 'reports' ? 'contents' : 'hidden'}>
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
                        <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
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
                                      ? 'bg-slate-100 text-slate-800 font-bold border border-slate-200 shadow-sm' 
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
        </div>

        {/* TAB 2.5: TREND */}
        <div className={activeTab === 'trend' ? 'contents' : 'hidden'}>
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
        </div>

        {/* TAB 3: LOCATIONS MASTER */}
        <div className={activeTab === 'locations' ? 'contents' : 'hidden'}>
          <LocationMaster 
            states={statesList}
            allDistricts={allDistrictsList}
            masterBlocks={masterBlocks}
            divisions={divisionsList}
            adminUser={adminUser}
          />
        </div>

        {/* TAB 4: USERS MANAGEMENT */}
        <div className={activeTab === 'users' ? 'contents' : 'hidden'}>
          <>
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
                    <option value="ADMIN">State Admin</option>
                    <option value="VACCINE_MANAGER">Vaccine Manager</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                {(newAdminRole === 'ADMIN' || newAdminRole === 'VACCINE_MANAGER') && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">State *</label>
                    <select value={newAdminStateId} onChange={e => { setNewAdminStateId(e.target.value); setNewAdminDistrictId(''); setNewAdminCclId(''); }} required
                      className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600">
                      <option value="">Select State</option>
                      {statesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                {newAdminRole === 'ADMIN' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">District (Optional)</label>
                    <select value={newAdminDistrictId} onChange={e => setNewAdminDistrictId(e.target.value)} disabled={!newAdminStateId}
                      className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600 disabled:opacity-50">
                      <option value="">{newAdminStateId ? 'State-level only' : 'Select State first'}</option>
                      {newAdminStateId && districtsList.filter(d => String(d.state_id) === String(newAdminStateId)).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                {newAdminRole === 'VACCINE_MANAGER' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Facility *</label>
                    <select value={newAdminCclId} onChange={e => setNewAdminCclId(e.target.value)} required
                      className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600 disabled:opacity-50">
                      <option value="">Select Facility</option>
                      {managerFacilities.filter(c => !c.state_id || String(c.state_id) === String(newAdminStateId)).map(c => (
                        <option key={c.ccl_id || c.id} value={c.ccl_id || c.id}>{c.display_name || c.facility_name || c.ccl_name || c.ccl_id || 'Unnamed Facility'}</option>
                      ))}
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
                    <th className="px-4 py-2">District</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Last Login</th>
                    <th className="px-4 py-2">Actions</th>
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
                      <td className="px-4 py-2.5 font-semibold text-slate-500">{u.state_name || '-'}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-500">
                        {u.role === 'VACCINE_MANAGER' && u.ccl_facility_name 
                          ? `${u.district_name || '-'} - ${u.ccl_facility_name}` 
                          : (u.district_name || '-')}
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                            u.is_active 
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200' 
                              : 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200'
                          }`}
                          title={`Click to ${u.is_active ? 'disable' : 'enable'} access`}
                        >
                          {u.status || (u.is_active ? 'Active' : 'Disabled')}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-[10px]">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-IN') : 'Never'}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-2">
                          <button onClick={() => setEditingUser(u)} className="text-[10px] font-bold px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors">Edit</button>
                          <button onClick={() => handleDeleteUser(u.id)} className="text-[10px] font-bold px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded transition-colors">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-800">Edit Admin User</h3>
                <button onClick={() => setEditingUser(null)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSaveEditedUser} className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Full Name *</label>
                  <input type="text" value={editingUser.name || ''} onChange={e => setEditingUser({...editingUser, name: e.target.value})} required
                    className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Username *</label>
                  <input type="text" value={editingUser.username || ''} onChange={e => setEditingUser({...editingUser, username: e.target.value})} required
                    className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Password (Leave blank to keep current)</label>
                  <input type="password" value={editingUser.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})} placeholder="New password"
                    className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Role</label>
                  <select value={editingUser.role || ''} onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                    className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600">
                    <option value="ADMIN">State Admin</option>
                    <option value="VACCINE_MANAGER">Vaccine Manager</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                {(editingUser.role === 'ADMIN' || editingUser.role === 'VACCINE_MANAGER') && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">State</label>
                    <select value={editingUser.state_id || ''} onChange={e => setEditingUser({...editingUser, state_id: e.target.value, district_id: ''})} required
                      className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600">
                      <option value="">Select State</option>
                      {statesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                {editingUser.role === 'ADMIN' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">District (Optional)</label>
                    <select value={editingUser.district_id || ''} onChange={e => setEditingUser({...editingUser, district_id: e.target.value})} disabled={!editingUser.state_id}
                      className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600 disabled:opacity-50">
                      <option value="">{editingUser.state_id ? 'State-level only' : 'Select State first'}</option>
                      {editingUser.state_id && districtsList.filter(d => String(d.state_id) === String(editingUser.state_id)).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Status</label>
                  <select value={editingUser.status || (editingUser.is_active ? 'ACTIVE' : 'DISABLED')} onChange={e => setEditingUser({...editingUser, status: e.target.value})}
                    className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600">
                    <option value="ACTIVE">Active</option>
                    <option value="DISABLED">Disabled</option>
                    <option value="ON_LEAVE">On Leave</option>
                  </select>
                </div>
              </form>
              <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 mt-auto">
                <button type="button" onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={handleSaveEditedUser}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white gradient-header shadow hover:shadow-md transition-all">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
        </>
        </div>

        {/* TAB 5: SETTINGS — Reset Password Only */}
        <div className={activeTab === 'settings' ? 'contents' : 'hidden'}>
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
        </div>


        {/* TAB 6: AUDIT LOGS */}
        {adminUser?.role === 'SUPER_ADMIN' && (<div className={activeTab === 'activity' ? 'contents' : 'hidden'}>
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
        </div>)}

        <div className={activeTab === 'audit' ? 'contents' : 'hidden'}>
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
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">User</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Entity</th>
                      <th className="p-3">Device Info</th>
                      <th className="p-3">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-500">{new Date(log.created_at).toLocaleString('en-IN')}</td>
                        <td className="p-3 font-bold text-emerald-600">{log.user_id}</td>
                        <td className="p-3 font-bold text-slate-900">
                          {log.action === 'LOGOUT' ? (
                            <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[10px]">LOGOUT</span>
                          ) : (
                            log.action
                          )}
                        </td>
                        <td className="p-3 text-slate-600">{log.entity_type}</td>
                        <td className="p-3 text-slate-400 max-w-[200px] truncate" title={log.device_info || 'Unknown'}>{log.device_info || '-'}</td>
                        <td className="p-3 text-slate-400">{log.ip_address || '127.0.0.1'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className={activeTab === 'population' ? 'contents' : 'hidden'}>
          <AdminPopulation activeStateId={activeStateId} />
        </div>

        {adminUser?.role === 'SUPER_ADMIN' && (<div className={activeTab === 'upload' ? 'contents' : 'hidden'}>
          <SuperAdminUpload />
        </div>)}

        {/* Modal for Monthly Report Submission */}
        {selectedCcp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-full">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-800">Submit Balance: {selectedCcp.facility_name}</h3>
                <button onClick={() => setSelectedCcp(null)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-5 space-y-4 overflow-y-auto">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                  <p className="text-xs text-blue-800">
                    <strong>Month:</strong> {reportMonth ? new Date(reportMonth + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : ''}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Select Batch</label>
                  <select 
                    value={monthlyReportBatch} 
                    onChange={e => setMonthlyReportBatch(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select a Batch --</option>
                    {availableBatches.filter((b: any) => b.facility_id === selectedCcp.id).map((b: any) => (
                      <option key={b.id} value={b.batch_no}>{b.batch_no} (System Qty: {b.quantity})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Actual Physical Balance (Doses)</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={monthlyReportQty} 
                    onChange={e => setMonthlyReportQty(e.target.value)} 
                    placeholder="Enter physical count"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Handler Name</label>
                  <input 
                    type="text" 
                    defaultValue={selectedCcp.ccl_manager_handler_name}
                    id="handler_name"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Handler Mobile</label>
                  <input 
                    type="tel" 
                    defaultValue={selectedCcp.ccl_manager_handler_mobile_no}
                    id="handler_mobile"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Remarks (Optional)</label>
                  <textarea 
                    value={monthlyReportRemarks} 
                    onChange={e => setMonthlyReportRemarks(e.target.value)} 
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button 
                  onClick={() => setSelectedCcp(null)}
                  className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={stockLoading || !monthlyReportBatch || !monthlyReportQty}
                  onClick={async () => {
                    setStockLoading(true); setStockMsg(null);
                    try {
                      const hName = (document.getElementById('handler_name') as HTMLInputElement).value;
                      const hMobile = (document.getElementById('handler_mobile') as HTMLInputElement).value;
                      
                      const token = (localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token'));
                      const res = await fetch('/api/vaccine/monthly-report/submit', {
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ 
                          month: reportMonth,
                          facility_id: selectedCcp.id,
                          facility_name: selectedCcp.facility_name,
                          batch_no: monthlyReportBatch,
                          quantity: Number(monthlyReportQty),
                          handler_name: hName,
                          handler_mobile: hMobile,
                          remarks: monthlyReportRemarks
                        })
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error || 'Failed');
                      
                      setStockMsg({ type: 'success', text: `Successfully submitted balance for ${selectedCcp.facility_name}` });
                      setSelectedCcp(null);
                      fetchBlockMonthlyReport(reportMonth);
                      fetchBatches('3'); // Refresh batches
                    } catch (err: any) { 
                      setStockMsg({ type: 'error', text: err.message }); 
                      setSelectedCcp(null);
                    }
                    setStockLoading(false);
                  }}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {stockLoading ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}


        {/* CCL Management Tab */}
        <div className={activeTab === 'ccl-management' ? 'contents' : 'hidden'}>
          <div className="max-w-7xl mx-auto w-full flex flex-col h-[calc(100vh-100px)] pb-6 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <Building2 className="w-7 h-7 text-indigo-600" />
                  CCL Management
                </h1>
                <p className="text-slate-500 text-sm mt-1">Manage and track all Level 1-3 Cold Chain Points.</p>
              
                <button onClick={handleExportCcl} className="ml-3 inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-sm font-bold transition-colors">
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
              <div className="relative">

                <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search facility name or CCL ID..."
                  value={cclSearchTerm}
                  onChange={e => setCclSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full sm:w-64 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0 mt-6">
              {[
                { label: 'Total CCL', count: cclList.length, color: 'indigo' },
                { label: 'Level 1', count: cclList.filter(c => c.unit_level === '1').length, color: 'blue' },
                { label: 'Level 2', count: cclList.filter(c => c.unit_level === '2').length, color: 'amber' },
                { label: 'Level 3', count: cclList.filter(c => c.unit_level === '3').length, color: 'emerald' },
                { label: 'Level 3 (BVS)', count: cclList.filter(c => c.unit_level === '3' && c.ccl_block_hq_yes === 'Y').length, color: 'pink' },
              ].map((kpi, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{kpi.label}</p>
                  <p className={`text-3xl font-black text-${kpi.color}-600`}>{cclLoading ? '-' : kpi.count}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-0 mt-6">
              <div className="overflow-x-auto overflow-y-auto flex-1">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-12 text-center">S.No</th>
                      <th className="px-4 py-3 font-semibold">District Name</th>
                      <th className="px-4 py-3 font-semibold">Block / City Name</th>
                      <th className="px-4 py-3 font-semibold">Facility Name</th>
                      <th className="px-4 py-3 font-semibold text-center">Mobile No.</th>
                      <th className="px-4 py-3 font-semibold text-center">Unit Level</th>
                      <th className="px-4 py-3 font-semibold text-center">Unit ID (CCL)</th>
                      <th className="px-4 py-3 font-semibold">Manager / Handler</th>
                      <th className="px-4 py-3 font-semibold text-center">Status</th>
                      <th className="px-4 py-3 font-semibold text-right sticky right-0 bg-slate-50 border-l border-slate-200 shadow-sm z-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cclLoading ? (
                      <tr><td colSpan={10} className="p-12 text-center text-slate-500">Loading facilities...</td></tr>
                    ) : cclList.filter(c => 
                        !cclSearchTerm || 
                        c.facility_name?.toLowerCase().includes(cclSearchTerm.toLowerCase()) || 
                        c.ccl_id?.toLowerCase().includes(cclSearchTerm.toLowerCase())
                      ).length === 0 ? (
                      <tr><td colSpan={10} className="p-12 text-center text-slate-500">No facilities found.</td></tr>
                    ) : (
                      cclList.filter(c => 
                        !cclSearchTerm || 
                        c.facility_name?.toLowerCase().includes(cclSearchTerm.toLowerCase()) || 
                        c.ccl_id?.toLowerCase().includes(cclSearchTerm.toLowerCase())
                      ).map((c: any, index: number) => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-4 py-3 text-center text-slate-400 text-xs font-mono">{index + 1}</td>
                          <td className="px-4 py-3 text-slate-700">{c.districts?.name || c.district_id || '-'}</td>
                          <td className="px-4 py-3 text-slate-700">{c.blocks?.name || c.block_id || '-'}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{c.facility_name}</td>
                          <td className="px-4 py-3 text-center text-slate-600">{c.contact_number || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                              c.unit_level === '1' ? 'bg-blue-100 text-blue-700' :
                              c.unit_level === '2' ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {c.unit_level}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-slate-500 text-xs">{c.ccl_id || '-'}</td>
                          <td className="px-4 py-3 text-slate-600">{c.name_of_unit_incharge || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              c.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {c.status || 'Active'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right sticky right-0 bg-white group-hover:bg-slate-50 border-l border-slate-100 transition-colors">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => { setEditingCcl(c); setCclEditModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Edit">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteCcl(c.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CCL Edit Modal */}
            {cclEditModalOpen && editingCcl && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
                    <div>
                      <h3 className="font-extrabold text-xl text-slate-900">Edit Facility Details</h3>
                      <p className="text-slate-500 text-sm mt-1">Modify any database field for this Cold Chain Point.</p>
                    </div>
                    <button onClick={() => setCclEditModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-white p-2 rounded-full shadow-sm hover:shadow transition-all">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
                      {/* Standard Fields */}
                      {[
                        { label: 'Facility Name', key: 'facility_name', type: 'text' },
                        { label: 'CCL ID', key: 'ccl_id', type: 'text' },
                        { label: 'Unit Level', key: 'unit_level', type: 'select', options: ['1', '2', '3'] },
                        { label: 'State ID', key: 'state_id', type: 'number' },
                        { label: 'District ID', key: 'district_id', type: 'number' },
                        { label: 'Block ID', key: 'block_id', type: 'number' },
                        { label: 'LGD State Code', key: 'lgd_state_code', type: 'number' },
                        { label: 'LGD District Code', key: 'lgd_district_code', type: 'number' },
                        { label: 'LGD Block Code', key: 'lgd_block_code', type: 'number' },
                        { label: 'Sub District Name', key: 'sub_district_name', type: 'text' },
                        { label: 'Facility Acronym', key: 'facility_acronym', type: 'text' },
                        { label: 'Hospital Facility ID', key: 'hospital_facility_id', type: 'text' },
                        { label: 'ABDM Org Facility ID', key: 'abdm_org_facility_id', type: 'text' },
                        { label: 'Pin Code', key: 'pin_code', type: 'number' },
                        { label: 'Latitude', key: 'latitude', type: 'number', step: 'any' },
                        { label: 'Longitude', key: 'longitude', type: 'number', step: 'any' },
                        { label: 'Altitude', key: 'altitude', type: 'number', step: 'any' },
                        { label: 'Name of Unit Incharge', key: 'name_of_unit_incharge', type: 'text' },
                        { label: 'Contact Number', key: 'contact_number', type: 'text' },
                        { label: 'Health Facility Group', key: 'health_facility_group', type: 'text' },
                        { label: 'Health Facility Type', key: 'health_facility_type', type: 'text' },
                        { label: 'Setting', key: 'setting', type: 'text' },
                        { label: 'ULB Code', key: 'ulb_code', type: 'text' },
                        { label: 'ULB Type', key: 'ulb_type', type: 'text' },
                        { label: 'Ownership', key: 'ownership', type: 'text' },
                        { label: 'Parent Organization', key: 'parent_organization', type: 'text' },
                        { label: 'Department Name', key: 'department_name', type: 'text' },
                        { label: 'Department Type', key: 'department_type', type: 'text' },
                        { label: 'Service Domain', key: 'service_domain', type: 'text' },
                        { label: 'Service Category', key: 'service_category', type: 'text' },
                        { label: 'Service', key: 'service', type: 'text' },
                        { label: 'Service Unit', key: 'service_unit', type: 'text' },
                        { label: 'Unit Sub Level', key: 'unit_sub_level', type: 'text' },
                        { label: 'Unit Type', key: 'unit_type', type: 'text' },
                        { label: 'CCL Block HQ (Yes/No)', key: 'ccl_block_hq_yes', type: 'select', options: ['Y', 'N'] },
                        { label: 'Status', key: 'status', type: 'select', options: ['Active', 'Inactive'] },
                      ].map((field) => (
                        <div key={field.key} className="flex flex-col">
                          <label className="text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">{field.label}</label>
                          {field.type === 'select' ? (
                            <select 
                              value={editingCcl[field.key] || ''} 
                              onChange={e => setEditingCcl({...editingCcl, [field.key]: e.target.value})}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow shadow-sm"
                            >
                              <option value="">- Select -</option>
                              {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : (
                            <input 
                              type={field.type} 
                              step={(field as any).step}
                              value={editingCcl[field.key] || ''} 
                              onChange={e => setEditingCcl({...editingCcl, [field.key]: e.target.type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value})}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow shadow-sm"
                            />
                          )}
                        </div>
                      ))}
                      <div className="flex flex-col md:col-span-3">
                        <label className="text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Address</label>
                        <textarea 
                          value={editingCcl.address || ''} 
                          onChange={e => setEditingCcl({...editingCcl, address: e.target.value})}
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow shadow-sm resize-none"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5 bg-white border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <button onClick={() => setCclEditModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                    <button onClick={handleEditCcl} className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-500/20 rounded-xl transition-all">Save Changes</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>


      </main>
    </div>
  );
};
