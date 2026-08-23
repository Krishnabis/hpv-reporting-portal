import re

with open('src/pages/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# 1. Update activeTab type
content = re.sub(
    r"const \[activeTab, setActiveTab\] = useState<'dashboard' \| 'reports' \| 'trend' \| 'locations' \| 'users' \| 'settings' \| 'audit' \| 'population' \| 'upload'>\('dashboard'\);",
    r"const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'trend' | 'locations' | 'users' | 'settings' | 'audit' | 'population' | 'upload' | 'activity'>('dashboard');",
    content
)

# 2. Add Activity Icon import
content = re.sub(
    r"UploadCloud,",
    r"UploadCloud, Activity,",
    content
)

# 3. Add Activity state
state_insertion = """  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);"""
content = re.sub(
    r"  const \[auditLogs, setAuditLogs\] = useState<any\[\]>\(\[\]\);\n  const \[loadingAudit, setLoadingAudit\] = useState\(false\);",
    state_insertion,
    content
)

# 4. Add fetchActivity function near fetchAuditLogs
fetch_func = """  const fetchAuditLogs = () => {
    setLoadingAudit(true);
    fetch('/api/admin/audit', { headers: { 'Authorization': `Bearer ${localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token')}` } })
      .then(r => r.json()).then(d => { setAuditLogs(d); setLoadingAudit(false); })
      .catch(() => setLoadingAudit(false));
  };

  const fetchActivityData = () => {
    setLoadingActivity(true);
    fetch('/api/admin/activity', { headers: { 'Authorization': `Bearer ${localStorage.getItem('hpv_admin_token') || sessionStorage.getItem('hpv_admin_token')}` } })
      .then(r => r.json()).then(d => { setActivityData(d); setLoadingActivity(false); })
      .catch(() => setLoadingActivity(false));
  };
"""
content = re.sub(
    r"  const fetchAuditLogs = \(\) => \{\n    setLoadingAudit\(true\);\n    fetch\('/api/admin/audit', \{ headers: \{ 'Authorization': `Bearer \$\{localStorage.getItem\('hpv_admin_token'\) \|\| sessionStorage.getItem\('hpv_admin_token'\)\}` \} \}\)\n      .then\(r => r.json\(\)\).then\(d => \{ setAuditLogs\(d\); setLoadingAudit\(false\); \}\)\n      .catch\(\(\) => setLoadingAudit\(false\)\);\n  \};",
    fetch_func,
    content
)

# 5. Call fetchActivityData when tab changes
tab_change = """      if (tab === 'audit') fetchAuditLogs();
      if (tab === 'activity') fetchActivityData();"""
content = re.sub(
    r"      if \(tab === 'audit'\) fetchAuditLogs\(\);",
    tab_change,
    content
)

# 6. Add Sidebar tab
sidebar_tab = """              {adminUser?.role === 'SUPER_ADMIN' && (
                <button
                  onClick={() => handleTabChange('activity')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    activeTab === 'activity'
                      ? 'bg-emerald-50 text-emerald-700 font-bold shadow-sm border border-emerald-100'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  <Activity className={`w-5 h-5 shrink-0 ${activeTab === 'activity' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  Activity
                </button>
              )}
"""
content = re.sub(
    r"(              \{adminUser\?\.role === 'SUPER_ADMIN' && \(\n                <button\n                  onClick=\{\(\) => handleTabChange\('audit'\)\})",
    sidebar_tab + r"\1",
    content
)

# 7. Render Activity Tab content
activity_tab_ui = """        {activeTab === 'activity' && adminUser?.role === 'SUPER_ADMIN' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Visitor Activity</h2>
                <p className="text-slate-500 mt-1">Track unique IP addresses and locations visiting the portal.</p>
              </div>
              <button onClick={fetchActivityData} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 font-semibold rounded-xl hover:bg-emerald-100 transition-colors">
                <RefreshCcw className={`w-4 h-4 ${loadingActivity ? 'animate-spin' : ''}`} /> Refresh
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
"""

content = re.sub(
    r"(        \{activeTab === 'audit' && \()",
    activity_tab_ui + r"\n\1",
    content
)

with open('src/pages/AdminDashboard.tsx', 'w') as f:
    f.write(content)

